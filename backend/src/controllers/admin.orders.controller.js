import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { ORDER_TRANSITIONS } from '../config/constants.js';
import { badRequest, conflict, escapeRegex, notFound, paginate, r2 } from '../utils/http.js';
import { getSettings } from '../services/settings.service.js';
import { applyPayment, createOrder, lowStockSync } from '../services/order.service.js';
import { assertPickupValid, releaseSlot, syncSlot } from '../services/slots.service.js';
import { orderStatusEmail, sendMail } from '../services/email.service.js';
import { addDays, nowParts } from '../utils/time.js';

const SORTS = { pickup: { pickupDate: 1, pickupTime: 1 }, '-pickup': { pickupDate: -1, pickupTime: -1 }, created: { createdAt: 1 }, '-created': { createdAt: -1 }, total: { total: 1 }, '-total': { total: -1 } };

export async function listOrders(req, res) {
  const s = await getSettings();
  const today = nowParts(s.timezone).date;
  const { q, status, payment, priority, date, from, to, time, sort } = req.query;
  const f = {};
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    f.$or = [{ orderNumber: rx }, { 'customer.name': rx }, { 'customer.email': rx }, { 'customer.phone': rx }, { 'items.name': rx }];
  }
  if (status && status !== 'all') f.status = status === 'active' ? { $nin: ['Collected', 'Cancelled'] } : status;
  if (payment && payment !== 'all') f.paymentStatus = payment === 'outstanding' ? { $in: ['Unpaid', 'Deposit paid'] } : payment;
  if (priority && priority !== 'all') f.priority = priority;
  if (time) f.pickupTime = time;
  if (date && date !== 'all') {
    if (date === 'today') f.pickupDate = today;
    else if (date === 'tomorrow') f.pickupDate = addDays(today, 1);
    else if (date === 'week') f.pickupDate = { $gte: today, $lte: addDays(today, 6) };
    else if (date === 'upcoming') f.pickupDate = { $gte: today };
    else if (date === 'past') f.pickupDate = { $lt: today };
    else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) f.pickupDate = date;
  }
  if (from || to) f.pickupDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const { page, limit, skip } = paginate(req.query);
  const [items, total, counts] = await Promise.all([
    Order.find(f).sort(SORTS[sort] || SORTS['-created']).skip(skip).limit(limit),
    Order.countDocuments(f),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit), statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
}

export async function getOrder(req, res) {
  const o = await Order.findById(req.params.id).populate('user', 'name email');
  if (!o) throw notFound('Order not found');
  res.json({ order: o });
}

export async function updateStatus(req, res) {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  const { status, note, notify } = req.body;
  if (o.status === status) return res.json({ order: o });
  if (!ORDER_TRANSITIONS[o.status]?.includes(status)) throw conflict(`An order cannot move from ${o.status} to ${status}.`);
  const prev = o.status;
  o.status = status;
  o.history.push({ text: `Status changed ${prev} → ${status}${note ? ` · ${note}` : ''}`, by: req.user.name });
  await o.save();
  if (status === 'Cancelled' || prev === 'Cancelled') {
    await syncSlot(o.pickupDate, o.pickupTime);
    // Return tracked stock when cancelled, take it again when reinstated
    const sign = status === 'Cancelled' ? 1 : -1;
    for (const i of o.items) if (i.product) await Product.updateOne({ _id: i.product, stockQty: { $ne: null } }, { $inc: { stockQty: sign * i.qty } });
    await lowStockSync(o.items.map((i) => i.product).filter(Boolean));
  }
  if (notify && ['Ready', 'Cancelled', 'Confirmed'].includes(status)) {
    const s = await getSettings();
    sendMail({ to: o.customer.email, ...orderStatusEmail(o, s) }).catch(() => {});
  }
  res.json({ order: o });
}

export async function patchOrder(req, res) {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  const b = req.body;
  const changes = [];
  if (b.pickupDate || b.pickupTime) {
    const date = b.pickupDate || o.pickupDate;
    const time = b.pickupTime || o.pickupTime;
    if (date !== o.pickupDate || time !== o.pickupTime) {
      const s = await getSettings();
      await assertPickupValid(date, time, s, 0);
      const [od, ot] = [o.pickupDate, o.pickupTime];
      o.pickupDate = date; o.pickupTime = time;
      changes.push(`Pickup moved from ${od} ${ot} to ${date} ${time}`);
      await o.save();
      await syncSlot(od, ot); await syncSlot(date, time);
    }
  }
  if (b.priority && b.priority !== o.priority) { o.priority = b.priority; changes.push(`Priority set to ${b.priority}`); }
  if (b.baker !== undefined && b.baker !== o.baker) { o.baker = b.baker; changes.push(b.baker ? `Assigned to ${b.baker}` : 'Baker unassigned'); }
  if (b.internalNotes !== undefined) o.internalNotes = b.internalNotes;
  if (b.notes !== undefined) o.notes = b.notes;
  if (b.customer) { Object.assign(o.customer, b.customer); changes.push('Customer details updated'); }
  for (const c of changes) o.history.push({ text: c, by: req.user.name });
  await o.save();
  res.json({ order: o });
}

export async function addPayment(req, res) {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  if (o.status === 'Cancelled') throw conflict('Cannot record a payment on a cancelled order.');
  const balance = r2(o.total - o.amountPaid);
  if (req.body.amount > balance + 0.005) throw badRequest(`Amount is more than the balance due ($${balance.toFixed(2)}).`);
  applyPayment(o, { ...req.body, by: req.user.name });
  if (o.status === 'Pending' && o.amountPaid >= (o.depositDue || 0)) o.status = 'Confirmed';
  o.history.push({ text: `Payment recorded · $${req.body.amount.toFixed(2)} (${req.body.method.replace(/_/g, ' ')})`, by: req.user.name });
  await o.save();
  res.json({ order: o });
}

export async function refund(req, res) {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  if (!o.amountPaid) throw conflict('Nothing has been paid on this order.');
  o.paymentStatus = 'Refunded';
  o.history.push({ text: `Marked refunded · $${o.amountPaid.toFixed(2)}${req.body.note ? ` · ${req.body.note}` : ''}. Process the refund with your payment provider.`, by: req.user.name });
  await o.save();
  res.json({ order: o });
}

export async function createManualOrder(req, res) {
  const s = await getSettings();
  const { paymentStatus, ...rest } = req.body;
  const { order } = await createOrder({ ...rest, paymentMethod: 'pay_at_pickup', settings: s, by: req.user.name });
  if (paymentStatus === 'Paid') { applyPayment(order, { amount: order.total, method: 'card_in_store', by: req.user.name }); await order.save(); }
  res.status(201).json({ order });
}

export async function deleteOrder(req, res) {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  if (o.status !== 'Cancelled') throw conflict('Cancel the order before deleting it.');
  await o.deleteOne();
  await releaseSlot(o.pickupDate, o.pickupTime);
  await syncSlot(o.pickupDate, o.pickupTime);
  res.json({ ok: true });
}

export async function exportOrdersCsv(req, res) {
  const { from, to } = req.query;
  const f = {};
  if (from || to) f.pickupDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const rows = await Order.find(f).sort({ pickupDate: 1, pickupTime: 1 });
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Order', 'Created', 'Pickup date', 'Pickup time', 'Customer', 'Email', 'Phone', 'Items', 'Total', 'Paid', 'Payment', 'Status', 'Source'].join(',')];
  for (const o of rows) lines.push([o.orderNumber, o.createdAt.toISOString(), o.pickupDate, o.pickupTime, o.customer.name, o.customer.email, o.customer.phone, o.items.map((i) => `${i.qty}x ${i.name} ${i.variant}`).join('; '), o.total, o.amountPaid, o.paymentStatus, o.status, o.source].map(q).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${from || 'all'}-${to || 'all'}.csv"`);
  res.send(lines.join('\n'));
}

// ── Production board / calendar ──
export async function production(req, res) {
  const s = await getSettings();
  const date = req.query.date || nowParts(s.timezone).date;
  const orders = await Order.find({ pickupDate: date, status: { $nin: ['Cancelled', 'Pending'] } }).sort({ priority: 1, pickupTime: 1 });
  res.json({ date, orders, bakers: s.bakers });
}

export async function calendar(req, res) {
  const s = await getSettings();
  const { slotsForDate, slotTimesFor } = await import('../services/slots.service.js');
  const date = req.query.date || nowParts(s.timezone).date;
  if (req.query.view === 'week') {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(date, i);
      const slots = await slotsForDate(d, s, 0);
      days.push({ date: d, closed: !slotTimesFor(d, s).length, blocked: s.blockedDates.find((b) => b.date === d) || null, slots });
    }
    return res.json({ view: 'week', start: date, capacity: s.slotCapacity, days });
  }
  const [slots, orders] = await Promise.all([
    slotsForDate(date, s, 0),
    Order.find({ pickupDate: date, status: { $ne: 'Cancelled' } }).select('orderNumber customer pickupTime status paymentStatus items priority total').sort({ pickupTime: 1 }),
  ]);
  res.json({ view: 'day', date, capacity: s.slotCapacity, blocked: s.blockedDates.find((b) => b.date === date) || null, blockedSlots: s.blockedSlots.filter((b) => b.date === date), slots, orders });
}
