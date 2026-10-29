import Stripe from 'stripe';
import { env, stripeEnabled } from '../config/env.js';

let stripe = null;
export function getStripe() {
  if (!stripeEnabled()) return null;
  if (!stripe) stripe = new Stripe(env.stripe.secretKey);
  return stripe;
}

export const onlinePaymentsAvailable = (settings) => Boolean(settings.payments.onlineEnabled && stripeEnabled());

/** Creates a Stripe Checkout session for an order (full amount or deposit). */
export async function createCheckoutSession(order, amount, settings, clientUrl) {
  const s = getStripe();
  if (!s) throw new Error('Online payments are not configured');
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.customer.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: settings.currency.toLowerCase(),
        unit_amount: Math.round(amount * 100),
        product_data: { name: `${settings.business.name} order ${order.orderNumber}${amount < order.total ? ' (deposit)' : ''}` },
      },
    }],
    metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    success_url: `${clientUrl}/order/${order.orderNumber}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/checkout?cancelled=${order.orderNumber}`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return session;
}
