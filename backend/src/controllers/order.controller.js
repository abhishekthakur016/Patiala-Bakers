import crypto from 'node:crypto';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Enquiry } from '../models/Enquiry.js';
import { nextSeq } from '../models/misc.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { badRequest, forbidden, notFound, paginate } from '../utils/http.js';
import { getSettings } from '../services/settings.service.js';
import { applyPayment, createOrder, notifyNewOrder } from '../services/order.service.js';
import { createCheckoutSession, getStripe } from '../services/payment.service.js';
import { storeImage } from '../services/upload.service.js';
import { enquiryReceivedEmail, sendMail } from '../services/email.service.js';
import { enquirySchema } from '../validators/schemas.js';
import { addDays, nowParts } from '../utils/time.js';

const PUBLIC_FIELDS = 'orderNumber customer items pickupDate pickupTime notes subtotal fees total depositDue depositPercent amountPaid paymentStatus paymentMethod status createdAt history source';

function publicOrder(o) {
  const j = o.toJSON();
  return {
    orderNumber: j.orderNumber, customer: j.customer, items: j.items, pickupDate: j.pickupDate, pickupTime: j.pickupTime, notes: j.notes,
    subtotal: j.subtotal, fees: j.fees, total: j.total, depositDue: j.depositDue, depositPercent: j.depositPercent, amountPaid: j.amountPaid,
    balanceDue: j.balanceDue, paymentStatus: j.paymentStatus, paymentMethod: j.paymentMethod, status: j.status, createdAt: j.createdAt,
    source: j.source, timeline: (j.history || []).map((h) => ({ at: h.at, text: h.text })),
  };
}

export async function checkout(req, res) {
  const s = await getSettings();
  const { order, accessToken, created } = await createOrder({ ...req.body, user: req.user, source: 'Online', settings: s });
  let paymentUrl = null;
  if (['card_online', 'deposit_online'].includes(order.paymentMethod) && order.paymentStatus === 'Unpaid') {
    const amount = order.paymentMethod === 'deposit_online' ? order.depositDue : order.total;
    const session = await createCheckoutSession(order, amount, s, env.clientUrls[0]);
    order.stripeSessionId = session.id;
    await order.save();
    paymentUrl = session.url;
  }
  res.status(created ? 201 : 200).json({ order: publicOrder(order), accessToken, paymentUrl, duplicate: !created });
}

/** Confirmation page: owner, staff, or a guest holding the access token. */
export async function getConfirmation(req, res) {
  const order = await Order.findOne({ orderNumber: String(req.params.orderNumber).toUpperCase() }).select(`${PUBLIC_FIELDS} user +accessToken stripeSessionId`);
  if (!order) throw notFound('Order not found');
  const token = String(req.query.token || req.get('x-order-token') || '');
  const isOwner = req.user && order.user && order.user.equals(req.user._id);
  const tokenOk = token && order.accessToken && token.length === order.accessToken.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(order.accessToken));
  if (!isOwner && !tokenOk && req.user?.role !== 'staff') throw forbidden('Sign in or use the link from your confirmation to view this order.');
  // Verify a returning Stripe session server-side before showing it as paid
  if (req.query.session_id && order.stripeSessionId === req.query.session_id && order.paymentStatus === 'Unpaid') await verifyStripeSession(order);
  res.json({ order: publicOrder(order) });
}

async function verifyStripeSession(order) {
  const stripe = getStripe();
  if (!stripe || !order.stripeSessionId) return;
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  if (session.payment_status === 'paid') await markStripePaid(order, session);
}

async function markStripePaid(order, session) {
  if (order.payments.some((p) => p.reference === session.payment_intent)) return;
  applyPayment(order, { amount: session.amount_total / 100, method: order.paymentMethod, reference: session.payment_intent, provider: 'stripe', by: 'Stripe' });
  if (order.status === 'Pending') order.status = 'Confirmed';
  order.history.push({ text: `Online payment received · $${(session.amount_total / 100).toFixed(2)} (verified with Stripe)`, by: 'Stripe' });
  await order.save();
  const s = await getSettings();
  notifyNewOrder(order, s).catch(() => {});
}

export async function stripeWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe || !env.stripe.webhookSecret) return res.status(400).send('Stripe not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), env.stripe.webhookSecret);
  } catch (err) {
    logger.warn({ err: err.message }, 'Stripe webhook signature failed');
    return res.status(400).send('Invalid signature');
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    const order = await Order.findOne({ stripeSessionId: session.id });
    if (order && session.payment_status === 'paid') await markStripePaid(order, session);
  }
  res.json({ received: true });
}

export async function trackOrder(req, res) {
  const order = await Order.findOne({ orderNumber: req.body.orderNumber, 'customer.email': req.body.email }).select(PUBLIC_FIELDS);
  if (!order) throw notFound('We could not find an order with that number and email address.');
  res.json({ order: publicOrder(order) });
}

export async function myOrders(req, res) {
  const { page, limit, skip } = paginate(req.query);
  const filter = { $or: [{ user: req.user._id }, { 'customer.email': req.user.email }] };
  const [items, total] = await Promise.all([
    Order.find(filter).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ items: items.map(publicOrder), total, page, pages: Math.ceil(total / limit) });
}

export async function myOrder(req, res) {
  const order = await Order.findOne({ orderNumber: String(req.params.orderNumber).toUpperCase(), $or: [{ user: req.user._id }, { 'customer.email': req.user.email }] }).select(PUBLIC_FIELDS);
  if (!order) throw notFound('Order not found');
  res.json({ order: publicOrder(order) });
}

/** Returns cart lines for a previous order, skipping anything no longer orderable. */
export async function reorder(req, res) {
  const order = await Order.findOne({ orderNumber: String(req.params.orderNumber).toUpperCase(), $or: [{ user: req.user._id }, { 'customer.email': req.user.email }] });
  if (!order) throw notFound('Order not found');
  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product).filter(Boolean) } });
  const map = new Map(products.map((p) => [p._id.toString(), p]));
  const items = [];
  const skipped = [];
  for (const i of order.items) {
    const p = i.product && map.get(i.product.toString());
    if (!p || !p.orderable || !p.variants.some((v) => v.key === i.variant)) { skipped.push(i.name); continue; }
    items.push({ id: crypto.randomUUID(), productId: p._id.toString(), variant: i.variant, qty: i.qty, options: { ...(i.options || {}) } });
  }
  res.json({ items, skipped });
}

// ── Custom cake enquiries (public) ──
export async function createEnquiry(req, res) {
  const raw = { ...req.body };
  if (typeof raw.diet === 'string') { try { raw.diet = JSON.parse(raw.diet); } catch { raw.diet = [raw.diet]; } }
  const body = enquirySchema.parse(raw);
  const s = await getSettings();
  const today = nowParts(s.timezone).date;
  const minDate = addDays(today, Math.ceil((s.prepHours['custom-cakes'] || 120) / 24));
  if (body.requiredDate < minDate) throw badRequest(`Custom cakes need at least ${Math.ceil(s.prepHours['custom-cakes'] / 24)} days notice. The earliest date is ${minDate}.`, { fields: { requiredDate: `Earliest date is ${minDate}` } });
  const images = [];
  for (const f of req.files || []) images.push(await storeImage(f, 'patiala-bakers/enquiries'));
  const enq = await Enquiry.create({
    ...body,
    reference: `CE-${await nextSeq('enquiry', 2041)}`,
    user: req.user?._id,
    referenceImages: images,
    history: [{ text: 'Enquiry received via website', by: body.name }],
  });
  sendMail({ to: enq.email, ...enquiryReceivedEmail(enq, s) }).catch(() => {});
  if (s.notifications.enquiry && s.notifications.staffEmail) {
    sendMail({ to: s.notifications.staffEmail, subject: `New custom cake enquiry ${enq.reference}`, html: `<p>${enq.name} · ${enq.occasion} · ${enq.servings} serves · needed ${enq.requiredDate}</p><p>${enq.description.replace(/</g, '&lt;')}</p>` }).catch(() => {});
  }
  res.status(201).json({ reference: enq.reference, requiredDate: enq.requiredDate });
}

export async function myEnquiries(req, res) {
  const items = await Enquiry.find({ $or: [{ user: req.user._id }, { email: req.user.email }] }).select('reference status occasion requiredDate servings createdAt quote orderNumber').sort({ createdAt: -1 });
  res.json({ items });
}
