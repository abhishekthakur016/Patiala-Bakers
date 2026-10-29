// Rule-based assistants that answer from live MongoDB data.
// Staff assistant: business questions + plain-English price changes (always previewed, never auto-applied).
// Website chat: customer FAQs driven by editable settings.
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Enquiry } from '../models/Enquiry.js';
import { CATEGORIES } from '../config/constants.js';
import { addDays, nowParts, weekday } from '../utils/time.js';
import { bestsellers, outstanding } from './stats.service.js';
import { previewRule } from './bulkPricing.service.js';

const catName = (id) => CATEGORIES.find((c) => c.id === id)?.name || id;
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const t12 = (h) => { const [a, b] = h.split(':').map(Number); return `${a % 12 || 12}${b ? `:${String(b).padStart(2, '0')}` : ''} ${a >= 12 ? 'pm' : 'am'}`; };
const isCakeOrder = (o) => o.items.some((i) => i.category === 'cakes' || i.category === 'custom-cakes');

export const STAFF_SUGGESTIONS = [
  'How many cake orders do we have tomorrow?',
  'Increase all 7-inch cake prices by 10%',
  'Which products are unavailable?',
  'What were our bestselling products this month?',
  'Which orders are unpaid?',
  'Show today’s pickups',
];

export async function staffAnswer(q, settings) {
  const l = q.toLowerCase();
  const today = nowParts(settings.timezone).date;

  if (/(increase|raise|put up|decrease|lower|reduce|drop)/.test(l) && /(price|cost|\d)/.test(l)) {
    const dir = /(decrease|lower|reduce|drop)/.test(l) ? 'dec' : 'inc';
    const pm = l.match(/(\d+(?:\.\d+)?)\s*(%|percent|per cent)/);
    const dm = l.match(/\$\s*(\d+(?:\.\d+)?)/) || l.match(/(\d+(?:\.\d+)?)\s*dollars?/);
    if (!pm && !dm) return { type: 'text', text: 'How much should the prices change? For example: “Increase all 7-inch cake prices by 10%” or “Raise sweets 1 kg prices by $2”.' };
    const sizes = { '5"': false, '7"': false, '9"': false, other: false };
    const sm = l.match(/\b(5|7|9)\s*(?:-|\s)?\s*(?:inch|in\b|"|”|″)/g);
    const cats = { cakes: false, sweets: /(sweet|mithai)/.test(l), snacks: /snack/.test(l), breads: /bread/.test(l), biscuits: /biscuit/.test(l) };
    if (sm) sm.forEach((x) => { sizes[`${x.match(/5|7|9/)[0]}"`] = true; });
    if (/cake/.test(l) || sm || !(cats.sweets || cats.snacks || cats.breads || cats.biscuits)) {
      cats.cakes = true;
      if (!sm) { sizes['5"'] = true; sizes['7"'] = true; sizes['9"'] = true; }
    }
    if (cats.sweets || cats.snacks || cats.breads || cats.biscuits) sizes.other = true;
    const rule = { cats, sizes, dir, type: pm ? '%' : '$', amt: Number(pm ? pm[1] : dm[1]), round: 'none', skipUnavail: false };
    const { rows, description } = await previewRule(rule);
    if (!rows.length) return { type: 'text', text: 'I could not find any products matching that request.' };
    return {
      type: 'price',
      text: `I found ${rows.length} price${rows.length === 1 ? '' : 's'} matching “${description}”. Nothing has changed yet — review the preview, then approve to apply it.`,
      rows, description, rule, status: 'pending',
    };
  }

  if (/tomorrow/.test(l)) {
    const tm = addDays(today, 1);
    const all = await Order.find({ pickupDate: tm, status: { $ne: 'Cancelled' } }).sort({ pickupTime: 1 });
    const list = /cake/.test(l) ? all.filter(isCakeOrder) : all;
    const noun = /cake/.test(l) ? 'cake order' : 'order';
    if (!list.length) return { type: 'text', text: `There are no ${noun}s scheduled for tomorrow.${settings.hours[weekday(tm)]?.closed ? ' The bakery is closed that day.' : ''}`, actions: [{ label: 'Open pickup calendar', to: '/admin/calendar' }] };
    const prep = list.filter((o) => ['Pending', 'Confirmed'].includes(o.status)).length;
    return {
      type: 'table',
      text: `You have ${list.length} ${noun}${list.length === 1 ? '' : 's'} for tomorrow, with ${prep} still to go into production.`,
      cols: ['Order', 'Customer', 'Item', 'Pickup', 'Status'],
      rows: list.map((o) => [o.orderNumber, o.customer.name, `${o.items[0].name} ${o.items[0].variant}`, t12(o.pickupTime), o.status]),
      actions: [{ label: 'View orders', to: `/admin/orders?date=${tm}` }, { label: 'Open production board', to: `/admin/production?date=${tm}` }],
    };
  }

  if (/(unavailable|sold out|out of stock|not available|low stock)/.test(l)) {
    const list = await Product.find({ archived: false, $or: [{ available: false }, { stockStatus: { $in: ['Sold out', 'Low stock', 'Unavailable'] } }] });
    return {
      type: 'list',
      text: `${list.length} product${list.length === 1 ? ' needs' : 's need'} attention right now:`,
      items: list.map((p) => ({ label: p.name, sub: `${catName(p.category)} · ${p.available ? p.stockStatus : `Hidden from ordering (${p.stockStatus.toLowerCase()})`}`, to: `/admin/products?edit=${p._id}` })),
    };
  }

  if (/(best ?sell|top sell|top product|most popular|best performing|popular)/.test(l)) {
    const monthStart = `${today.slice(0, 8)}01`;
    const rows = await bestsellers(monthStart, today, 6);
    if (!rows.length) return { type: 'text', text: 'There are no sales recorded this month yet.' };
    const max = rows[0].revenue || 1;
    return {
      type: 'bars', text: 'Bestsellers this month, by revenue:',
      bars: rows.map((r) => ({ label: r.name, sub: `${r.qty} sold`, value: money(r.revenue), pct: Math.round((r.revenue / max) * 100) })),
      actions: [{ label: 'Open reports', to: '/admin/reports' }],
    };
  }

  if (/(unpaid|outstanding|owing|owe|payment)/.test(l)) {
    const o = await outstanding();
    return {
      type: 'table',
      text: `${o.count} active order${o.count === 1 ? ' has' : 's have'} money outstanding, ${money(o.due)} in total.`,
      cols: ['Order', 'Customer', 'Pickup', 'Payment', 'Due'],
      rows: o.list.map((x) => [x.orderNumber, x.customer.name, `${x.pickupDate} ${t12(x.pickupTime)}`, x.paymentStatus, money(x.total - x.amountPaid)]),
      actions: [{ label: 'View unpaid orders', to: '/admin/orders?payment=Unpaid' }],
    };
  }

  if (/(today|pickups?)/.test(l)) {
    const list = await Order.find({ pickupDate: today, status: { $ne: 'Cancelled' } }).sort({ pickupTime: 1 });
    const left = list.filter((o) => o.status !== 'Collected').length;
    return {
      type: 'table',
      text: `${list.length} pickup${list.length === 1 ? ' is' : 's are'} booked for today; ${left} still to be collected.`,
      cols: ['Time', 'Order', 'Customer', 'Status'],
      rows: list.map((o) => [t12(o.pickupTime), o.orderNumber, o.customer.name, o.status]),
      actions: [{ label: 'Open pickup calendar', to: '/admin/calendar' }],
    };
  }

  if (/(enquir|custom cake|quote)/.test(l)) {
    const rows = await Enquiry.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const c = (s) => rows.find((r) => r._id === s)?.n || 0;
    return { type: 'text', text: `Custom cake enquiries: ${c('New')} new, ${c('Quoted')} quoted, ${c('Awaiting Payment')} awaiting deposit, ${c('Confirmed') + c('Converted')} confirmed.`, actions: [{ label: 'Open enquiries', to: '/admin/enquiries' }] };
  }

  return { type: 'text', text: 'I can answer questions about orders, pickups, payments, stock, enquiries and bestsellers, and prepare price changes for your approval. Try one of these:', suggestions: STAFF_SUGGESTIONS.slice(0, 4) };
}

export async function chatAnswer(q, settings) {
  const l = q.toLowerCase();
  const w = settings.chatWidget;
  for (const qa of w.qa || []) {
    const words = qa.q.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter((x) => x.length > 3);
    const hits = words.filter((x) => l.includes(x)).length;
    if (words.length && hits >= Math.min(2, words.length)) return { text: qa.a, links: [] };
  }
  const hoursText = () => settings.hours.map((h, i) => (h.closed ? null : `${WD[i]} ${t12(h.open)}–${t12(h.close)}`)).filter(Boolean).join(', ');
  const cakes = await Product.find({ category: 'cakes', archived: false, available: true });
  const veganFrom = Math.min(...cakes.flatMap((p) => p.variants.map((v) => v.veganUpcharge).filter((x) => x != null)));
  const p = settings.prepHours;
  if (/egg/.test(l)) return { text: 'Every cake on our menu is marked eggless unless its product page says otherwise. Each product page lists its dietary information and allergens.', links: [{ label: 'Browse eggless cakes', to: '/shop?category=cakes&eggless=1' }] };
  if (/vegan|dairy/.test(l)) return { text: `Many of our cakes have a vegan upgrade${Number.isFinite(veganFrom) ? ` (from ${money(veganFrom)})` : ''}. Choose “Vegan” when you customise a cake — it is only offered where available.`, links: [{ label: 'See vegan options', to: '/shop?vegan=1' }] };
  if (/gluten|coeliac|celiac/.test(l)) return { text: 'Some cakes offer a gluten-free upgrade. Our kitchen handles wheat, so we cannot guarantee products are free from traces.', links: [{ label: 'See gluten-free options', to: '/shop?glutenFree=1' }] };
  if (/(notice|advance|how long|how early|lead time|how soon)/.test(l)) return { text: `Standard cakes need ${p.cakes} hours notice. Custom designs need at least ${Math.round(p['custom-cakes'] / 24)} days. Sweets need ${p.sweets} hours, and snacks and breads ${p.snacks} hours.`, links: [{ label: 'Request a custom cake', to: '/custom-cakes' }] };
  if (/(size|big|serve|people|inch)/.test(l)) return { text: 'Our cakes come in 5″ (6–8 serves), 7″ (12–15 serves) and 9″ (20–25 serves). Tiered cakes are available as custom orders.', links: [{ label: 'Shop cakes', to: '/shop?category=cakes' }, { label: 'Tiered and custom cakes', to: '/custom-cakes' }] };
  if (/(custom|design|request|wedding|tier|photo)/.test(l)) return { text: `Use our custom cake form: share your occasion, servings and reference photos, and we will send a quote. A ${settings.payments.depositPercent}% deposit confirms your booking.`, links: [{ label: 'Start a custom cake enquiry', to: '/custom-cakes' }] };
  if (/(pick ?up|collect|time|hour|open|when)/.test(l)) return { text: `Pickup is from ${settings.business.address}. Hours: ${hoursText()}. You choose an available pickup slot at checkout.`, links: [{ label: 'Start an order', to: '/shop' }] };
  if (/(price|cost|how much|cheap)/.test(l)) {
    const min = Math.min(...cakes.map((c) => Math.min(...c.variants.map((v) => v.price))));
    return { text: Number.isFinite(min) ? `Cakes start from ${money(min)}. Prices update live as you choose a size and options.` : 'Prices are shown on each product page.', links: [{ label: 'Shop cakes', to: '/shop?category=cakes' }] };
  }
  if (/(sweet|mithai|ladoo|barfi|diwali)/.test(l)) return { text: `Our Indian sweets are made in small batches and need ${p.sweets} hours notice.`, links: [{ label: 'Shop Indian sweets', to: '/shop?category=sweets' }] };
  if (/(track|status|my order|where is)/.test(l)) return { text: 'You can check your order status with your order number and email address.', links: [{ label: 'Track an order', to: '/track' }] };
  return { text: `I’m not sure about that one. You can call us on ${settings.business.phone} or send a message and the team will get back to you.`, links: [{ label: 'Contact the bakery', to: '/contact' }] };
}
