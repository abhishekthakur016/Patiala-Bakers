import { Enquiry } from '../models/Enquiry.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { ContactMessage } from '../models/misc.js';
import { Settings } from '../models/Settings.js';
import { CATEGORIES } from '../config/constants.js';
import { badRequest, conflict, escapeRegex, notFound, paginate, r2 } from '../utils/http.js';
import { getSettings, invalidateSettings } from '../services/settings.service.js';
import { applyPayment, newOrderNumber } from '../services/order.service.js';
import { assertPickupValid, reserveSlot } from '../services/slots.service.js';
import { enquiryQuoteEmail, sendMail } from '../services/email.service.js';
import { bestsellers, categoryMix, dashboard, outstanding, paymentMix, rangeFor, revenueSeries, totals } from '../services/stats.service.js';
import { STAFF_SUGGESTIONS, staffAnswer } from '../services/assistant.service.js';

// ── Dashboard & reports ──
export async function getDashboard(_req, res) {
  const s = await getSettings();
  res.json(await dashboard(s.timezone));
}

export async function getReports(req, res) {
  const s = await getSettings();
  const r = rangeFor(req.query.range, s.timezone);
  const from = req.query.from || r.from;
  const to = req.query.to || r.to;
  const [series, cur, prev, best, cats, pay, out, sources] = await Promise.all([
    revenueSeries(from, to), totals(from, to), totals(r.prevFrom, r.prevTo), bestsellers(from, to, 10), categoryMix(from, to), paymentMix(from, to), outstanding(),
    Order.aggregate([{ $match: { status: { $ne: 'Cancelled' }, pickupDate: { $gte: from, $lte: to } } }, { $group: { _id: '$source', n: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
  ]);
  res.json({
    from, to, series, totals: cur, previous: prev, bestsellers: best,
    categories: cats.map((c) => ({ ...c, name: CATEGORIES.find((x) => x.id === c.category)?.name || c.category })),
    payments: pay, outstanding: { count: out.count, due: out.due }, sources: sources.map((x) => ({ source: x._id, orders: x.n, revenue: r2(x.revenue) })),
  });
}

// ── Enquiries ──
export async function listEnquiries(req, res) {
  const f = {};
  if (req.query.status && req.query.status !== 'all') f.status = req.query.status;
  if (req.query.q) { const rx = { $regex: escapeRegex(req.query.q), $options: 'i' }; f.$or = [{ reference: rx }, { name: rx }, { email: rx }, { occasion: rx }]; }
  const [items, counts] = await Promise.all([Enquiry.find(f).sort({ createdAt: -1 }).limit(200), Enquiry.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])]);
  res.json({ items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
}
export async function getEnquiry(req, res) {
  const e = await Enquiry.findById(req.params.id);
  if (!e) throw notFound('Enquiry not found');
  res.json({ enquiry: e });
}
export async function patchEnquiry(req, res) {
  const e = await Enquiry.findById(req.params.id);
  if (!e) throw notFound('Enquiry not found');
  if (req.body.status && req.body.status !== e.status) {
    if (e.status === 'Converted') throw conflict('This enquiry has already been converted to an order.');
    e.history.push({ text: `Status changed ${e.status} → ${req.body.status}`, by: req.user.name });
    e.status = req.body.status;
  }
  await e.save();
  res.json({ enquiry: e });
}
export async function addEnquiryNote(req, res) {
  const e = await Enquiry.findById(req.params.id);
  if (!e) throw notFound('Enquiry not found');
  e.internalNotes.push({ text: req.body.text, by: req.user.name });
  await e.save();
  res.json({ enquiry: e });
}
export async function quoteEnquiry(req, res) {
  const e = await Enquiry.findById(req.params.id);
  if (!e) throw notFound('Enquiry not found');
  if (e.status === 'Converted') throw conflict('This enquiry has already been converted to an order.');
  const total = r2(req.body.lines.reduce((s, l) => s + l.amount, 0));
  e.quote = { lines: req.body.lines, depositPercent: req.body.depositPercent, note: req.body.note, total, sentAt: req.body.send ? new Date() : undefined };
  if (['New', 'Quoted'].includes(e.status)) e.status = 'Quoted';
  e.history.push({ text: `Quote ${req.body.send ? 'sent' : 'saved'} · $${total.toFixed(2)}`, by: req.user.name });
  await e.save();
  let emailed = false;
  if (req.body.send) emailed = (await sendMail({ to: e.email, ...enquiryQuoteEmail(e, await getSettings()) })).sent;
  res.json({ enquiry: e, emailed });
}
export async function convertEnquiry(req, res) {
  const e = await Enquiry.findById(req.params.id);
  if (!e) throw notFound('Enquiry not found');
  if (e.order) throw conflict(`Already converted to order ${e.orderNumber}.`);
  if (!e.quote?.lines?.length) throw badRequest('Create a quote before converting this enquiry to an order.');
  const s = await getSettings();
  const date = req.body.pickupDate || e.requiredDate;
  await assertPickupValid(date, req.body.pickupTime, s, 0);
  if (!(await reserveSlot(date, req.body.pickupTime, s.slotCapacity))) throw conflict('That pickup slot is full.');
  const total = e.quote.total;
  const depositDue = r2(total * (e.quote.depositPercent ?? s.payments.depositPercent) / 100);
  const order = new Order({
    orderNumber: await newOrderNumber(),
    user: e.user,
    customer: { name: e.name, email: e.email, phone: e.phone },
    items: [{
      name: `Custom cake · ${e.occasion}`, category: 'custom-cakes', variant: req.body.variant || e.size || `${e.servings} serves`,
      image: e.referenceImages?.[0]?.url || '', diet: e.diet, options: { instructions: e.description.slice(0, 500) },
      priceBreakdown: e.quote.lines, qty: 1, unitPrice: total, lineTotal: total,
    }],
    pickupDate: date, pickupTime: req.body.pickupTime, notes: `From custom enquiry ${e.reference}.`,
    subtotal: total, total, depositPercent: e.quote.depositPercent, depositDue,
    status: req.body.depositPaid ? 'Confirmed' : 'Pending', priority: 'High', source: 'Enquiry', enquiry: e._id, enquiryRef: e.reference,
    history: [{ text: `Created from enquiry ${e.reference}`, by: req.user.name }],
  });
  if (req.body.depositPaid) applyPayment(order, { amount: depositDue, method: 'bank_transfer', by: req.user.name, note: 'Deposit' });
  await order.save();
  e.order = order._id; e.orderNumber = order.orderNumber; e.status = 'Converted';
  e.history.push({ text: `Converted to order ${order.orderNumber}${req.body.depositPaid ? ' · deposit received' : ''}`, by: req.user.name });
  await e.save();
  res.status(201).json({ enquiry: e, order });
}

// ── Customers (registered accounts merged with guest checkouts by email) ──
export async function listCustomers(req, res) {
  const { page, limit, skip } = paginate(req.query);
  const q = req.query.q ? escapeRegex(req.query.q) : null;
  const orderAgg = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$customer.email', name: { $first: '$customer.name' }, phone: { $first: '$customer.phone' }, orders: { $sum: 1 }, spend: { $sum: '$total' }, lastOrder: { $max: '$pickupDate' }, firstOrder: { $min: '$createdAt' } } },
  ]);
  const users = await User.find({ role: 'customer' });
  const map = new Map(orderAgg.map((o) => [o._id, { email: o._id, name: o.name, phone: o.phone, orders: o.orders, spend: r2(o.spend), lastOrder: o.lastOrder, since: o.firstOrder, registered: false }]));
  for (const u of users) {
    const ex = map.get(u.email) || { email: u.email, orders: 0, spend: 0, lastOrder: null };
    map.set(u.email, { ...ex, id: u._id, name: u.name, phone: u.phone || ex.phone, registered: true, dietaryPref: u.dietaryPref, since: u.createdAt < (ex.since || Infinity) ? u.createdAt : ex.since });
  }
  let list = [...map.values()];
  if (q) { const rx = new RegExp(q, 'i'); list = list.filter((c) => rx.test(c.name) || rx.test(c.email) || rx.test(c.phone || '')); }
  const sort = req.query.sort || '-spend';
  const key = sort.replace('-', ''); const dir = sort.startsWith('-') ? -1 : 1;
  list.sort((a, b) => ((a[key] ?? '') > (b[key] ?? '') ? dir : (a[key] ?? '') < (b[key] ?? '') ? -dir : 0));
  res.json({ items: list.slice(skip, skip + limit), total: list.length, page, pages: Math.ceil(list.length / limit) });
}
export async function getCustomer(req, res) {
  const email = String(req.params.email).toLowerCase();
  const [user, orders, enquiries] = await Promise.all([
    User.findOne({ email, role: 'customer' }),
    Order.find({ 'customer.email': email }).sort({ createdAt: -1 }).limit(100),
    Enquiry.find({ email }).sort({ createdAt: -1 }),
  ]);
  if (!user && !orders.length && !enquiries.length) throw notFound('Customer not found');
  const live = orders.filter((o) => o.status !== 'Cancelled');
  res.json({
    customer: { email, name: user?.name || orders[0]?.customer.name || enquiries[0]?.name, phone: user?.phone || orders[0]?.customer.phone || '', registered: Boolean(user), id: user?._id, dietaryPref: user?.dietaryPref || '', adminNotes: user?.adminNotes || '', spend: r2(live.reduce((s, o) => s + o.total, 0)), orderCount: live.length },
    orders, enquiries,
  });
}
export async function patchCustomer(req, res) {
  const u = await User.findOneAndUpdate({ email: String(req.params.email).toLowerCase(), role: 'customer' }, req.body, { new: true });
  if (!u) throw notFound('Only registered customers can have saved notes.');
  res.json({ ok: true });
}

// ── AI assistant ──
export async function aiAsk(req, res) {
  const s = await getSettings();
  res.json({ reply: await staffAnswer(req.body.message, s), suggestions: STAFF_SUGGESTIONS });
}
export function aiSuggestions(_req, res) { res.json({ suggestions: STAFF_SUGGESTIONS }); }

// ── Settings & staff ──
export async function getAdminSettings(_req, res) {
  res.json({ settings: await getSettings({ fresh: true }), categories: CATEGORIES });
}
export async function updateSettings(req, res) {
  const s = await Settings.findOne({ key: 'main' });
  for (const [k, v] of Object.entries(req.body)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object') {
      s.set(k, { ...(s[k].toObject ? s[k].toObject() : s[k]), ...v });
    } else s.set(k, v);
  }
  await s.save();
  invalidateSettings();
  res.json({ settings: s });
}
export async function blockDate(req, res) {
  const s = await Settings.findOne({ key: 'main' });
  const { date, time, reason } = req.body;
  if (time) {
    if (!s.blockedSlots.some((b) => b.date === date && b.time === time)) s.blockedSlots.push({ date, time, reason });
  } else if (!s.blockedDates.some((b) => b.date === date)) s.blockedDates.push({ date, reason });
  await s.save(); invalidateSettings();
  res.json({ blockedDates: s.blockedDates, blockedSlots: s.blockedSlots });
}
export async function unblockDate(req, res) {
  const s = await Settings.findOne({ key: 'main' });
  const { date, time } = req.body;
  if (time) s.blockedSlots = s.blockedSlots.filter((b) => !(b.date === date && b.time === time));
  else s.blockedDates = s.blockedDates.filter((b) => b.date !== date);
  await s.save(); invalidateSettings();
  res.json({ blockedDates: s.blockedDates, blockedSlots: s.blockedSlots });
}
export async function listStaff(_req, res) {
  const items = await User.find({ role: 'staff' }).sort({ createdAt: 1 });
  res.json({ items: items.map((u) => ({ ...u.toSafeJSON(), active: u.active, lastLoginAt: u.lastLoginAt })) });
}
export async function createStaff(req, res) {
  if (!req.body.password) throw badRequest('Set a temporary password for the new staff member.', { fields: { password: 'Required' } });
  if (await User.exists({ email: req.body.email })) throw conflict('That email is already registered.', { fields: { email: 'Already registered' } });
  const u = new User({ ...req.body, role: 'staff' });
  await u.setPassword(req.body.password);
  await u.save();
  res.status(201).json({ staff: u.toSafeJSON() });
}
export async function updateStaff(req, res) {
  const u = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!u) throw notFound('Staff member not found');
  const { password, ...rest } = req.body;
  if (u._id.equals(req.user._id) && (rest.active === false || (rest.staffRole && rest.staffRole !== 'owner' && u.staffRole === 'owner'))) throw conflict('You cannot deactivate or demote your own account.');
  Object.assign(u, rest);
  if (password) await u.setPassword(password);
  await u.save();
  res.json({ staff: u.toSafeJSON() });
}
export async function listMessages(_req, res) {
  res.json({ items: await ContactMessage.find().sort({ createdAt: -1 }).limit(100) });
}
export async function markMessage(req, res) {
  await ContactMessage.updateOne({ _id: req.params.id }, { handled: true });
  res.json({ ok: true });
}
