import crypto from 'node:crypto';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { nextSeq } from '../models/misc.js';
import { AppError, conflict, r2 } from '../utils/http.js';
import { logger } from '../config/logger.js';
import { priceItems } from './pricing.service.js';
import { assertPickupValid, releaseSlot, reserveSlot } from './slots.service.js';
import { onlinePaymentsAvailable } from './payment.service.js';
import { orderConfirmationEmail, sendMail, staffNewOrderEmail } from './email.service.js';

export const newOrderNumber = async () => `PB-${await nextSeq('order', 10418)}`;

/**
 * Validates and creates an order. All prices, lead times and slot capacity are checked server-side.
 * Returns { order, accessToken, created } — created=false when an idempotent retry matched an existing order.
 */
export async function createOrder({ items, customer, pickupDate, pickupTime, notes, paymentMethod, idempotencyKey, user, source = 'Online', settings, by }) {
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).select('+accessToken');
    if (existing) return { order: existing, accessToken: existing.accessToken, created: false };
  }

  const priced = await priceItems(items, settings);
  if (priced.issues.length) throw new AppError(422, 'Some items in your cart need attention.', { issues: priced.issues });
  if (!priced.lines.length) throw new AppError(422, 'Your cart is empty.');

  await assertPickupValid(pickupDate, pickupTime, settings, source === 'Online' ? priced.maxLeadHours : 0);

  const online = onlinePaymentsAvailable(settings);
  const depositPct = settings.payments.depositPercent;
  let method = paymentMethod || 'pay_at_pickup';
  if ((method === 'card_online' || method === 'deposit_online') && !online) throw conflict('Online payment is not available right now. Please choose pay at pickup.');
  if (method === 'pay_at_pickup' && !settings.payments.payAtPickup && source === 'Online') throw conflict('Pay at pickup is not available. Please pay online.');

  const depositDue = priced.depositRequired || method === 'deposit_online' ? r2(priced.total * depositPct / 100) : 0;
  // Orders awaiting an online payment, or a required deposit, stay Pending until paid
  const awaitingPayment = method === 'card_online' || method === 'deposit_online' || (priced.depositRequired && source === 'Online');
  const status = awaitingPayment ? 'Pending' : 'Confirmed';

  const reserved = await reserveSlot(pickupDate, pickupTime, settings.slotCapacity);
  if (!reserved) throw conflict('That pickup slot has just filled up. Please choose another time.', { field: 'pickup' });

  // Reserve tracked stock atomically; roll back on any failure
  const decremented = [];
  try {
    for (const l of priced.lines) {
      const res = await Product.updateOne({ _id: l.product, stockQty: { $ne: null, $gte: l.qty } }, { $inc: { stockQty: -l.qty } });
      if (res.modifiedCount) decremented.push(l);
      else {
        const p = await Product.findById(l.product).select('stockQty name');
        if (p && p.stockQty != null) throw new AppError(422, `Only ${p.stockQty} × ${p.name} left in stock.`, { issues: [{ id: l.id, message: `Only ${p.stockQty} left.` }] });
      }
    }

    const accessToken = crypto.randomBytes(24).toString('hex');
    const methodLabel = { pay_at_pickup: 'pay at pickup', card_online: 'awaiting online payment', deposit_online: 'awaiting online deposit', cash: 'cash', card_in_store: 'card in store', bank_transfer: 'bank transfer' }[method] || method;
    const order = await Order.create({
      orderNumber: await newOrderNumber(),
      user: user?._id,
      customer,
      items: priced.lines.map(({ id, leadHours, ...rest }) => rest),
      pickupDate,
      pickupTime,
      notes: notes || '',
      subtotal: priced.subtotal,
      fees: priced.fees,
      total: priced.total,
      depositPercent: depositDue ? depositPct : 0,
      depositDue,
      paymentMethod: method,
      status,
      source,
      priority: priced.lines.some((l) => l.category === 'custom-cakes') ? 'High' : 'Normal',
      history: [{ text: `Order placed ${source === 'Online' ? 'online' : `by ${by || 'staff'} (${source.toLowerCase()})`} · ${methodLabel}${depositDue ? ` · ${depositPct}% deposit ${awaitingPayment ? 'required' : 'due'}` : ''}`, by: by || customer.name }],
      idempotencyKey: idempotencyKey || undefined,
      accessToken,
    });

    await lowStockSync(decremented.map((l) => l.product));
    if (!awaitingPayment || !online) notifyNewOrder(order, settings).catch(() => {});
    return { order, accessToken, created: true };
  } catch (err) {
    await releaseSlot(pickupDate, pickupTime);
    for (const l of decremented) await Product.updateOne({ _id: l.product }, { $inc: { stockQty: l.qty } });
    if (err.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey }).select('+accessToken');
      if (existing) return { order: existing, accessToken: existing.accessToken, created: false };
    }
    throw err;
  }
}

export async function notifyNewOrder(order, settings) {
  if (settings.notifications.customerConfirmation && !order.confirmationEmailSent) {
    const m = orderConfirmationEmail(order, settings);
    const r = await sendMail({ to: order.customer.email, ...m });
    if (r.sent) await Order.updateOne({ _id: order._id }, { confirmationEmailSent: true });
  }
  if (settings.notifications.newOrder && settings.notifications.staffEmail) {
    await sendMail({ to: settings.notifications.staffEmail, ...staffNewOrderEmail(order, settings) });
  }
}

/** Keeps stockStatus in line with tracked stockQty after sales or edits. */
export async function lowStockSync(productIds) {
  if (!productIds.length) return;
  const products = await Product.find({ _id: { $in: productIds }, stockQty: { $ne: null } });
  for (const p of products) {
    let next = p.stockStatus;
    if (p.stockQty <= 0) next = 'Sold out';
    else if (p.stockQty <= p.lowStockThreshold) next = 'Low stock';
    else if (['Sold out', 'Low stock'].includes(p.stockStatus)) next = 'In stock';
    if (next !== p.stockStatus) {
      p.stockStatus = next;
      await p.save();
      logger.info({ product: p.name, stockQty: p.stockQty, status: next }, 'Stock status updated');
    }
  }
}

/** Records a payment and recomputes payment status. */
export function applyPayment(order, { amount, method, reference, provider, by, note }) {
  order.payments.push({ amount: r2(amount), method, reference, provider, by, note });
  order.amountPaid = r2(order.payments.reduce((s, p) => s + (p.amount || 0), 0));
  if (order.amountPaid >= order.total - 0.005) order.paymentStatus = 'Paid';
  else if (order.amountPaid > 0) order.paymentStatus = 'Deposit paid';
  else order.paymentStatus = 'Unpaid';
}
