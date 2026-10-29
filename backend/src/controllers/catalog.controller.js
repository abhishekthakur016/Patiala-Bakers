import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { CATEGORIES } from '../config/constants.js';
import { escapeRegex, notFound, paginate } from '../utils/http.js';
import { getSettings, publicSettings } from '../services/settings.service.js';
import { availableDates, slotsForDate } from '../services/slots.service.js';
import { leadHoursFor, priceItems } from '../services/pricing.service.js';
import { chatAnswer } from '../services/assistant.service.js';
import { ContactMessage } from '../models/misc.js';
import { sendMail } from '../services/email.service.js';
import { onlinePaymentsAvailable } from '../services/payment.service.js';
import { isDateStr } from '../utils/time.js';

export async function getPublicSettings(_req, res) {
  const s = await getSettings();
  res.json({ settings: { ...publicSettings(s), payments: { ...publicSettings(s).payments, onlineAvailable: onlinePaymentsAvailable(s) } }, categories: CATEGORIES });
}

const SORTS = {
  featured: { bestseller: -1, featured: -1, sortOrder: 1, name: 1 },
  'price-asc': { minPrice: 1, name: 1 },
  'price-desc': { minPrice: -1, name: 1 },
  name: { name: 1 },
  newest: { createdAt: -1 },
};

export async function listProducts(req, res) {
  const { page, limit, skip } = paginate({ page: req.query.page, limit: req.query.limit || 24 });
  const match = { archived: false };
  const { category, q, eggless, vegan, glutenFree, inStock, maxPrice, minPrice, bestseller } = req.query;
  if (category && category !== 'all') match.category = String(category);
  if (q) match.$or = [{ name: { $regex: escapeRegex(String(q).slice(0, 60)), $options: 'i' } }, { description: { $regex: escapeRegex(String(q).slice(0, 60)), $options: 'i' } }];
  if (eggless === '1') match['dietary.eggless'] = true;
  if (vegan === '1') match.$and = [...(match.$and || []), { $or: [{ 'dietary.vegan': true }, { 'upgrades.vegan': true }] }];
  if (glutenFree === '1') match.$and = [...(match.$and || []), { $or: [{ 'dietary.glutenFree': true }, { 'upgrades.glutenFree': true }] }];
  if (inStock === '1') { match.available = true; match.stockStatus = { $nin: ['Sold out', 'Unavailable'] }; }
  if (bestseller === '1') match.bestseller = true;

  const priceMatch = {};
  if (minPrice) priceMatch.$gte = Number(minPrice);
  if (maxPrice) priceMatch.$lte = Number(maxPrice);

  const pipeline = [
    { $match: match },
    { $addFields: { minPrice: { $min: '$variants.price' } } },
    ...(Object.keys(priceMatch).length ? [{ $match: { minPrice: priceMatch } }] : []),
    { $sort: SORTS[req.query.sort] || SORTS.featured },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ];
  const [r] = await Product.aggregate(pipeline);
  const total = r.total[0]?.n || 0;
  const items = r.items.map((p) => ({
    ...p,
    id: p._id,
    fromPrice: p.minPrice,
    orderable: p.available && !p.archived && !['Sold out', 'Unavailable'].includes(p.stockStatus),
  }));
  res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
}

export async function getProduct(req, res) {
  const { idOrSlug } = req.params;
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
  const p = await Product.findOne({ ...query, archived: false });
  if (!p) throw notFound('Product not found');
  const s = await getSettings();
  const related = await Product.find({ category: p.category, _id: { $ne: p._id }, archived: false, available: true }).limit(4);
  res.json({ product: { ...p.toJSON(), leadHours: leadHoursFor(p, s) }, related });
}

export async function quoteCart(req, res) {
  const s = await getSettings();
  const priced = await priceItems(req.body.items, s);
  res.json({
    lines: priced.lines.map(({ product, ...l }) => ({ ...l, productId: product })),
    issues: priced.issues,
    subtotal: priced.subtotal,
    fees: priced.fees,
    feeLabel: priced.feeLabel,
    total: priced.total,
    leadHours: priced.maxLeadHours,
    depositRequired: priced.depositRequired,
    depositPercent: s.payments.depositPercent,
    depositAmount: Math.round(priced.total * s.payments.depositPercent) / 100,
  });
}

export async function getAvailability(req, res) {
  const s = await getSettings();
  const lead = Math.max(0, Math.min(720, Number(req.query.leadHours) || 0));
  if (req.query.date && isDateStr(req.query.date)) {
    return res.json({ date: req.query.date, slots: await slotsForDate(req.query.date, s, lead) });
  }
  res.json({ dates: await availableDates(s, lead, Math.min(Number(req.query.days) || 21, 60)) });
}

export async function chat(req, res) {
  const s = await getSettings();
  res.json(await chatAnswer(req.body.message, s));
}

export async function contact(req, res) {
  const msg = await ContactMessage.create(req.body);
  const s = await getSettings();
  if (s.notifications.staffEmail) {
    sendMail({ to: s.notifications.staffEmail, subject: `Website message from ${msg.name}`, html: `<p>${msg.name} (${msg.email} ${msg.phone || ''}) wrote:</p><p>${String(msg.message).replace(/</g, '&lt;')}</p>` }).catch(() => {});
  }
  res.status(201).json({ ok: true });
}
