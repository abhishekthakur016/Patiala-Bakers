import nodemailer from 'nodemailer';
import { env, smtpEnabled } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter = null;
function getTransport() {
  if (!smtpEnabled()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout(title, body, business) {
  return `<!doctype html><html><body style="margin:0;background:#FBF6EE;font-family:Arial,sans-serif;color:#2B1A1E">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#6E1630;color:#F3D9A4;padding:20px 24px;border-radius:14px 14px 0 0;font-size:22px;font-weight:bold">${esc(business?.name || 'Patiala Bakers')}</div>
    <div style="background:#FFFDF9;padding:24px;border:1px solid #EFE5D6;border-top:0;border-radius:0 0 14px 14px">
      <h2 style="margin:0 0 12px;font-size:20px">${esc(title)}</h2>${body}
      <p style="margin-top:24px;font-size:13px;color:#6E5A60">${esc(business?.address || '')} · ${esc(business?.phone || '')}</p>
    </div></div></body></html>`;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransport();
  if (!t) {
    logger.info({ to, subject }, 'Email not sent (SMTP not configured)');
    return { sent: false };
  }
  try {
    await t.sendMail({ from: env.smtp.from, to, subject, html });
    return { sent: true };
  } catch (err) {
    logger.error({ err, to, subject }, 'Email send failed');
    return { sent: false, error: err.message };
  }
}

const money = (n, cur = 'AUD') => new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur }).format(n || 0);

export function orderConfirmationEmail(order, settings) {
  const rows = order.items.map((i) => `<tr><td style="padding:6px 0">${i.qty} × ${esc(i.name)} <span style="color:#6E5A60">(${esc(i.variant)})</span>${i.options?.message ? `<br><small>Message: “${esc(i.options.message)}”</small>` : ''}</td><td style="text-align:right">${money(i.lineTotal, settings.currency)}</td></tr>`).join('');
  const body = `<p>Hi ${esc(order.customer.name)}, thanks for your order! Your order number is <b>${esc(order.orderNumber)}</b>.</p>
  <p><b>Pickup:</b> ${esc(order.pickupDate)} at ${esc(order.pickupTime)}<br>${esc(settings.business.address)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
  <tr><td style="padding-top:10px;border-top:1px solid #E6D8C3"><b>Total</b></td><td style="text-align:right;padding-top:10px;border-top:1px solid #E6D8C3"><b>${money(order.total, settings.currency)}</b></td></tr></table>
  <p>Payment status: <b>${esc(order.paymentStatus)}</b>${order.depositDue && order.paymentStatus === 'Unpaid' ? ` · deposit of ${money(order.depositDue, settings.currency)} required to confirm` : ''}</p>`;
  return { subject: `Order ${order.orderNumber} received — ${settings.business.name}`, html: layout('Order received', body, settings.business) };
}

export function staffNewOrderEmail(order, settings) {
  const body = `<p>New ${esc(order.source.toLowerCase())} order <b>${esc(order.orderNumber)}</b> from ${esc(order.customer.name)} (${esc(order.customer.phone)}).</p>
  <p>Pickup ${esc(order.pickupDate)} ${esc(order.pickupTime)} · ${money(order.total, settings.currency)} · ${esc(order.paymentStatus)}</p>`;
  return { subject: `New order ${order.orderNumber}`, html: layout('New order', body, settings.business) };
}

export function orderStatusEmail(order, settings) {
  const body = `<p>Hi ${esc(order.customer.name)}, your order <b>${esc(order.orderNumber)}</b> is now <b>${esc(order.status)}</b>.</p>
  <p>Pickup: ${esc(order.pickupDate)} at ${esc(order.pickupTime)}, ${esc(settings.business.address)}</p>`;
  return { subject: `Order ${order.orderNumber}: ${order.status}`, html: layout(`Your order is ${order.status.toLowerCase()}`, body, settings.business) };
}

export function enquiryReceivedEmail(enq, settings) {
  const body = `<p>Hi ${esc(enq.name)}, thanks for your custom cake enquiry. Your reference is <b>${esc(enq.reference)}</b>.</p>
  <p>We usually reply with a quote within 24 hours. A ${settings.payments.depositPercent}% deposit confirms your booking.</p>`;
  return { subject: `Custom cake enquiry ${enq.reference}`, html: layout('Enquiry received', body, settings.business) };
}

export function enquiryQuoteEmail(enq, settings) {
  const rows = (enq.quote?.lines || []).map((l) => `<tr><td style="padding:6px 0">${esc(l.label)}</td><td style="text-align:right">${money(l.amount, settings.currency)}</td></tr>`).join('');
  const body = `<p>Hi ${esc(enq.name)}, here is the quote for your ${esc(enq.occasion.toLowerCase())} cake (${esc(enq.reference)}).</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}<tr><td style="border-top:1px solid #E6D8C3;padding-top:8px"><b>Total</b></td><td style="text-align:right;border-top:1px solid #E6D8C3;padding-top:8px"><b>${money(enq.quote?.total, settings.currency)}</b></td></tr></table>
  <p>A ${enq.quote?.depositPercent ?? settings.payments.depositPercent}% deposit confirms your booking. ${esc(enq.quote?.note || '')}</p>
  <p>Reply to this email or call us on ${esc(settings.business.phone)} to accept.</p>`;
  return { subject: `Your custom cake quote ${enq.reference}`, html: layout('Your quote', body, settings.business) };
}
