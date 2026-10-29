import { Product } from '../models/Product.js';
import { PriceAudit, ScheduledPrice } from '../models/misc.js';
import { conflict, escapeRegex, notFound } from '../utils/http.js';
import { lowStockSync } from '../services/order.service.js';
import { applyChanges, describeRule, previewCsv, previewRule, rollbackAudit } from '../services/bulkPricing.service.js';
import { deleteImage, storeImage } from '../services/upload.service.js';

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

export async function listAdminProducts(req, res) {
  const { q, category, avail, archived } = req.query;
  const f = { archived: archived === '1' };
  if (q) f.name = { $regex: escapeRegex(q), $options: 'i' };
  if (category && category !== 'all') f.category = category;
  if (avail === 'available') f.available = true;
  if (avail === 'hidden') f.available = false;
  if (avail === 'attention') f.$or = [{ available: false }, { stockStatus: { $in: ['Low stock', 'Sold out', 'Unavailable'] } }];
  const items = await Product.find(f).sort({ category: 1, sortOrder: 1, name: 1 });
  res.json({ items });
}

export async function createProduct(req, res) {
  const body = { ...req.body };
  body.slug = body.slug || slugify(body.name);
  if (await Product.exists({ slug: body.slug })) body.slug = `${body.slug}-${Date.now().toString(36)}`;
  const p = await Product.create(body);
  await lowStockSync([p._id]);
  res.status(201).json({ product: p });
}

export async function updateProduct(req, res) {
  const p = await Product.findById(req.params.id);
  if (!p) throw notFound('Product not found');
  const before = new Map(p.variants.map((v) => [v.key, v.price]));
  Object.assign(p, req.body);
  await p.save();
  // Price edits made in the product editor are audited too
  const changes = p.variants.filter((v) => before.has(v.key) && before.get(v.key) !== v.price).map((v) => ({ product: p._id, name: p.name, variant: v.key, oldPrice: before.get(v.key), newPrice: v.price }));
  if (changes.length) {
    const { nextSeq } = await import('../models/misc.js');
    await PriceAudit.create({ ref: `A-${await nextSeq('audit', 101)}`, source: 'Product editor', description: `${p.name} price edit`, by: req.user.name, changes });
  }
  await lowStockSync([p._id]);
  res.json({ product: await Product.findById(p._id) });
}

export async function archiveProduct(req, res) {
  const p = await Product.findByIdAndUpdate(req.params.id, { archived: req.body?.restore ? false : true }, { new: true });
  if (!p) throw notFound('Product not found');
  res.json({ product: p });
}

export async function uploadImages(req, res) {
  if (!req.files?.length) throw conflict('Choose at least one image.');
  const out = [];
  for (const f of req.files) out.push(await storeImage(f, 'patiala-bakers/products'));
  res.status(201).json({ images: out });
}

export async function removeImage(req, res) {
  await deleteImage(String(req.body.publicId || ''));
  res.json({ ok: true });
}

// ── Bulk pricing ──
export async function pricingPreview(req, res) {
  res.json(await previewRule(req.body));
}
export async function pricingApply(req, res) {
  const audit = await applyChanges(req.body.changes, { source: req.body.source, description: req.body.description, by: req.user.name });
  res.status(201).json({ audit });
}
export async function pricingAudit(_req, res) {
  res.json({ items: await PriceAudit.find().sort({ createdAt: -1 }).limit(100) });
}
export async function pricingRollback(req, res) {
  res.json({ audit: await rollbackAudit(req.params.id, req.user.name) });
}
export async function listSchedules(_req, res) {
  res.json({ items: await ScheduledPrice.find().sort({ runAt: 1 }) });
}
export async function createSchedule(req, res) {
  if (req.body.runAt <= new Date()) throw conflict('Choose a date and time in the future.');
  const item = await ScheduledPrice.create({ ...req.body, description: describeRule(req.body.rule), by: req.user.name });
  res.status(201).json({ item });
}
export async function cancelSchedule(req, res) {
  const item = await ScheduledPrice.findOneAndUpdate({ _id: req.params.id, status: 'Scheduled' }, { status: 'Cancelled' }, { new: true });
  if (!item) throw notFound('Scheduled change not found or already run');
  res.json({ item });
}
export async function csvPreview(req, res) {
  res.json({ rows: await previewCsv(req.body.csv) });
}
