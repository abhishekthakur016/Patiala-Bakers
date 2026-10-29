// Seeds products, settings, an owner account and (optionally) demo orders/enquiries.
//   npm run seed          → adds catalogue + owner if missing, keeps existing data
//   npm run seed:fresh    → wipes the database and seeds everything including demo orders
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Enquiry } from '../models/Enquiry.js';
import { Settings } from '../models/Settings.js';
import { Counter, PriceAudit, SlotBooking } from '../models/misc.js';
import { defaultSettings } from './defaults.js';
import { addDays, nowParts, weekday } from '../utils/time.js';
import { r2 } from '../utils/http.js';

const CAKE_ALLERGENS = 'Milk, wheat (gluten), soy. Made in a kitchen that also handles nuts and sesame.';
const ITEM_ALLERGENS = 'Milk, wheat (gluten). Made in a kitchen that also handles nuts and sesame.';
const img = (file, alt) => [{ url: `/images/${file}`, alt }];

function cake(slug, name, prices, description, sponge, filling, o = {}) {
  const veganOk = o.vegan !== false;
  const gfOk = o.gf !== false;
  return {
    slug, name, category: 'cakes', description,
    images: o.images || [],
    variants: [['5"', '6–8 serves', 8, 10], ['7"', '12–15 serves', 10, 12], ['9"', '20–25 serves', 12, 15]].map(([key, serves, vu, gu], i) => ({
      key, serves, price: prices[i], veganUpcharge: veganOk ? vu : null, gfUpcharge: gfOk ? gu : null,
    })),
    dietary: { eggless: true, vegan: false, glutenFree: false, nutFree: false },
    upgrades: { vegan: veganOk, glutenFree: gfOk },
    allergens: o.allergens || CAKE_ALLERGENS,
    customisable: true,
    defaults: { sponge, filling, finish: o.finish || 'Classic piped' },
    available: o.available !== false,
    stockStatus: o.stockStatus || 'Made to order',
    bestseller: Boolean(o.best),
    featured: Boolean(o.featured),
  };
}

function item(slug, name, category, variants, description, o = {}) {
  return {
    slug, name, category, description,
    images: o.images || [],
    variants: variants.map(([key, price]) => ({ key, price })),
    dietary: { eggless: o.eggless !== false, vegan: Boolean(o.vegan), glutenFree: Boolean(o.gf), nutFree: false },
    upgrades: { vegan: false, glutenFree: false },
    allergens: o.allergens || ITEM_ALLERGENS,
    customisable: false,
    available: o.available !== false,
    stockStatus: o.stockStatus || 'In stock',
    stockQty: o.stockQty ?? null,
    lowStockThreshold: o.low ?? 5,
    bestseller: Boolean(o.best),
  };
}

export function catalogue() {
  return [
    cake('black-forest-gateau', 'Black Forest Gateau', [42, 58, 78], 'Chocolate sponge layered with cherries and whipped cream, finished with dark chocolate shards.', 'Chocolate', 'Fresh cream', { best: true }),
    cake('belgian-chocolate-truffle', 'Belgian Chocolate Truffle', [48, 66, 89], 'Dense chocolate sponge, silky Belgian ganache and a glossy chocolate drip.', 'Chocolate', 'Chocolate ganache', { best: true, finish: 'Chocolate drip' }),
    cake('rasmalai-cake', 'Rasmalai Cake', [52, 72, 96], 'Our signature: saffron and cardamom sponge soaked in rasmalai milk, crowned with pistachio and saffron.', 'Vanilla', 'Rasmalai cream', { best: true, featured: true, vegan: false, gf: false, images: img('rasmalai-cake.svg', 'Rasmalai cake topped with pistachio and saffron'), allergens: 'Milk, wheat (gluten), pistachio. Made in a kitchen that also handles other nuts and sesame.' }),
    cake('mango-mousse-cake', 'Mango Mousse Cake', [45, 62, 84], 'Light vanilla sponge with Kensington Pride mango mousse and fresh mango.', 'Vanilla', 'Mango compote'),
    cake('pistachio-rose-cake', 'Pistachio Rose Cake', [50, 69, 92], 'Pistachio sponge, rose-scented cream, crushed pistachios and rose petals.', 'Pistachio', 'Fresh cream', { allergens: 'Milk, wheat (gluten), pistachio. Made in a kitchen that also handles other nuts and sesame.' }),
    cake('butterscotch-crunch', 'Butterscotch Crunch', [40, 55, 75], 'Butterscotch sponge with praline crunch and a caramel drip.', 'Butterscotch', 'Fresh cream'),
    cake('red-velvet', 'Red Velvet', [46, 64, 86], 'Cocoa-tinted red velvet layers with vanilla bean cream and fresh berries.', 'Red velvet', 'Fresh cream', { finish: 'Semi-naked' }),
    cake('pineapple-fresh-cream', 'Pineapple Fresh Cream', [38, 52, 72], 'A family classic: vanilla sponge, pineapple and light fresh cream.', 'Vanilla', 'Fresh cream'),
    cake('gulab-jamun-cake', 'Gulab Jamun Cake', [52, 72, 96], 'Cardamom sponge folded with gulab jamun, finished with a caramel syrup drip.', 'Vanilla', 'Fresh cream', { vegan: false, gf: false }),
    cake('strawberry-fresh-cream', 'Strawberry Fresh Cream', [40, 56, 76], 'Vanilla sponge with fresh strawberries and cream. Back when strawberries are in season.', 'Vanilla', 'Mixed berry', { available: false, stockStatus: 'Unavailable' }),
    {
      ...item('celebration-tiered-cake', 'Two-Tier Celebration Cake', 'custom-cakes', [['2-tier · 35 serves', 165], ['2-tier · 50 serves', 220], ['3-tier · 80 serves', 340]], 'A two- or three-tier eggless cake finished in buttercream to your colours. Choose flavours here, then tell us about the design in the notes — we confirm every detail before baking.', { images: img('custom-cake.svg', 'Tiered celebration cake with gold leaf and florals'), allergens: CAKE_ALLERGENS }),
      customisable: true, stockStatus: 'Made to order', defaults: { sponge: 'Vanilla', filling: 'Fresh cream', finish: 'Floral buttercream' }, featured: true,
    },
    item('punjabi-samosa', 'Punjabi Samosa', 'snacks', [['2 pcs', 5.5], ['6 pcs', 15]], 'Flaky pastry filled with spiced potato and peas, with mint and tamarind chutney.', { best: true, vegan: true, images: img('samosa.svg', 'Punjabi samosas with chutney'), allergens: 'Wheat (gluten). Made in a kitchen that also handles milk, nuts and sesame.' }),
    item('paneer-puff', 'Paneer Puff', 'snacks', [['Each', 4.5], ['4 pcs', 16]], 'Buttery puff pastry with spiced paneer and capsicum.'),
    item('chole-bhature', 'Chole Bhature', 'snacks', [['Plate', 15.9]], 'Two fluffy bhature with slow-cooked chole, onion and pickle.', { best: true }),
    item('veg-patties', 'Veg Patties', 'snacks', [['Each', 4], ['6 pcs', 22]], 'Golden pastry with a spiced mixed-vegetable filling.', { vegan: true, stockStatus: 'Sold out', stockQty: 0 }),
    item('pav-bhaji', 'Pav Bhaji', 'snacks', [['Plate', 14.5]], 'Mumbai-style vegetable bhaji with two buttered pav.'),
    item('khasta-kachori', 'Khasta Kachori', 'snacks', [['2 pcs', 6]], 'Crisp kachori stuffed with spiced moong dal.', { vegan: true }),
    item('kaju-katli', 'Kaju Katli', 'sweets', [['250 g', 13], ['500 g', 24], ['1 kg', 45]], 'Cashew fudge made with desi ghee, finished with edible silver leaf.', { best: true, gf: true, allergens: 'Milk, cashew.' }),
    item('motichoor-ladoo', 'Motichoor Ladoo', 'sweets', [['500 g', 16], ['1 kg', 30]], 'Fine besan pearls fried in desi ghee and bound with saffron syrup.', { best: true, gf: true, images: img('ladoo.svg', 'Motichoor ladoo'), allergens: 'Milk. Made with chickpea flour.' }),
    item('gulab-jamun', 'Gulab Jamun', 'sweets', [['8 pcs', 14], ['16 pcs', 26]], 'Soft khoya dumplings in rose and cardamom syrup.'),
    item('rasmalai', 'Rasmalai', 'sweets', [['4 pcs', 14], ['8 pcs', 26]], 'Chenna discs in chilled saffron milk with pistachio.', { gf: true, allergens: 'Milk, pistachio.' }),
    item('milk-barfi', 'Milk Barfi', 'sweets', [['500 g', 18], ['1 kg', 34]], 'Slow-cooked milk barfi with cardamom and pistachio.', { gf: true, stockQty: 4, stockStatus: 'Low stock', allergens: 'Milk, pistachio.' }),
    item('assorted-mithai-box', 'Assorted Mithai Box', 'sweets', [['500 g', 22], ['1 kg', 40]], 'A gift box of our bestselling sweets, made for Diwali and celebrations.', { best: true }),
    item('atta-sandwich-loaf', 'Atta Sandwich Loaf', 'breads', [['Loaf', 5.5]], 'Soft wholemeal loaf, baked fresh every morning.', { vegan: true, allergens: 'Wheat (gluten).' }),
    item('nankhatai', 'Nankhatai', 'biscuits', [['250 g', 8.5], ['500 g', 16]], 'Melt-in-the-mouth shortbread with cardamom and pistachio.', { allergens: 'Milk, wheat (gluten), pistachio.' }),
    item('jeera-biscuits', 'Jeera Biscuits', 'biscuits', [['400 g', 7.5]], 'Savoury cumin biscuits, made for chai.'),
    item('cake-rusk', 'Cake Rusk', 'biscuits', [['300 g', 9], ['600 g', 16]], 'Twice-baked cake rusk, crisp and golden.'),
  ].map((p, i) => ({ ...p, sortOrder: i }));
}

const CUSTS = [['Priya Sharma', 'Eggless'], ['Jack Thompson', ''], ['Harpreet Kaur', 'Eggless'], ['Emily Nguyen', 'Vegan'], ['Arjun Mehta', 'Eggless'], ['Sophie Williams', 'Gluten-free'], ['Rajveer Singh', ''], ['Olivia Brown', 'Nut-free'], ['Ananya Patel', 'Vegan'], ["Liam O'Connor", ''], ['Simran Gill', 'Eggless'], ['Noah Wilson', ''], ['Mei Chen', 'Vegan'], ['Gurpreet Sandhu', 'Eggless'], ['Chloe Martin', '']];
const PHONES = ['0491 570 006', '0491 570 156', '0491 570 157', '0491 570 158', '0491 570 159', '0491 570 110', '0491 570 313', '0491 570 737'];
const MSGS = ['Happy Birthday Aarav', 'Happy 30th Priya', 'Congratulations Sophie', 'Happy Anniversary', 'Happy Birthday Mum', 'Welcome Baby Kaur', '', ''];

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function seedDemoOrders(products, settings) {
  const R = rng(11);
  const today = nowParts(settings.timezone).date;
  const custs = CUSTS.map(([name, pref], i) => ({ name, pref, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`, phone: PHONES[i % PHONES.length] }));
  const cakes = products.filter((p) => p.category === 'cakes' && p.available);
  const others = products.filter((p) => !['cakes', 'custom-cakes'].includes(p.category) && p.available && p.stockStatus !== 'Sold out');
  const bakers = settings.bakers;
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const orders = [];
  let seq = 10418;
  for (let off = -28; off <= 6; off++) {
    const day = addDays(today, off);
    if (settings.hours[weekday(day)].closed) continue;
    const cnt = off === 0 || off === 1 ? 9 : 3 + Math.floor(R() * 4);
    const times = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const used = {};
    for (let i = 0; i < cnt; i++) {
      let time = pick(times);
      if ((used[time] || 0) >= settings.slotCapacity) time = times.find((t) => (used[t] || 0) < settings.slotCapacity);
      if (!time) break;
      used[time] = (used[time] || 0) + 1;
      const c = pick(custs);
      const lines = [];
      const isCake = R() < 0.65;
      if (isCake) {
        const p = pick(cakes);
        const si = R() < 0.25 ? 0 : R() < 0.75 ? 1 : 2;
        const v = p.variants[si];
        const vegan = p.upgrades.vegan && R() < 0.14;
        const addons = R() < 0.35 ? ['Birthday candles'] : [];
        const unit = v.price + (vegan ? v.veganUpcharge : 0) + (addons.length ? 3 : 0);
        const breakdown = [{ label: `${p.name} · ${v.key}`, amount: v.price }];
        if (vegan) breakdown.push({ label: 'Vegan upgrade', amount: v.veganUpcharge });
        if (addons.length) breakdown.push({ label: 'Birthday candles', amount: 3 });
        lines.push({ product: p._id, slug: p.slug, name: p.name, image: p.images[0]?.url || '', category: 'cakes', variant: v.key, options: { ...p.defaults, vegan, addons, message: pick(MSGS) }, diet: vegan ? ['Eggless', 'Vegan'] : ['Eggless'], priceBreakdown: breakdown, qty: 1, unitPrice: unit, lineTotal: unit });
      }
      if (!isCake || R() < 0.3) {
        const p = pick(others);
        const v = pick(p.variants);
        const qty = 1 + Math.floor(R() * 3);
        lines.push({ product: p._id, slug: p.slug, name: p.name, image: p.images[0]?.url || '', category: p.category, variant: v.key, options: {}, diet: p.dietary.vegan ? ['Vegan'] : ['Eggless'], priceBreakdown: [{ label: `${p.name} · ${v.key}`, amount: v.price }], qty, unitPrice: v.price, lineTotal: r2(v.price * qty) });
      }
      const total = r2(lines.reduce((s, l) => s + l.lineTotal, 0));
      let status = 'Confirmed';
      if (off < 0) status = R() < 0.05 ? 'Cancelled' : 'Collected';
      else if (off === 0) status = i < 3 ? 'Collected' : i < 5 ? 'Ready' : i < 7 ? 'In Production' : 'Confirmed';
      else if (off === 1) status = i < 2 ? 'In Production' : 'Confirmed';
      const pr = R();
      let paymentStatus = pr < 0.75 ? 'Paid' : pr < 0.9 ? 'Unpaid' : 'Deposit paid';
      if (status === 'Collected') paymentStatus = 'Paid';
      const amountPaid = paymentStatus === 'Paid' ? total : paymentStatus === 'Deposit paid' ? r2(total / 2) : 0;
      const createdAt = new Date(Date.now() + (off - 2 - Math.floor(R() * 4)) * 86400000);
      const source = R() < 0.8 ? 'Online' : 'Phone';
      const history = [{ at: createdAt, text: `Order placed ${source === 'Online' ? 'online' : 'by phone'} · ${paymentStatus === 'Paid' ? 'paid by card' : paymentStatus === 'Unpaid' ? 'pay at pickup' : '50% deposit paid'}`, by: c.name }];
      if (['In Production', 'Ready', 'Collected'].includes(status)) history.push({ at: new Date(createdAt.getTime() + 86400000), text: 'Status changed Confirmed → In Production', by: 'Meena' });
      if (['Ready', 'Collected'].includes(status)) history.push({ at: new Date(createdAt.getTime() + 2 * 86400000), text: 'Status changed In Production → Ready', by: 'Meena' });
      if (status === 'Collected') history.push({ at: new Date(createdAt.getTime() + 2.2 * 86400000), text: 'Status changed Ready → Collected', by: 'Tom' });
      orders.push({
        orderNumber: `PB-${seq++}`, customer: { name: c.name, email: c.email, phone: c.phone }, items: lines, pickupDate: day, pickupTime: time,
        notes: R() < 0.15 ? 'Please pipe the message in gold.' : '', subtotal: total, fees: 0, total, amountPaid, paymentStatus,
        payments: amountPaid ? [{ method: source === 'Online' ? 'card_online' : 'card_in_store', amount: amountPaid, at: createdAt, by: 'Seed' }] : [],
        paymentMethod: paymentStatus === 'Unpaid' ? 'pay_at_pickup' : 'card_online', status, source,
        priority: isCake && R() < 0.16 ? 'High' : 'Normal', baker: status !== 'Confirmed' && isCake ? pick(bakers) : '',
        history, createdAt, updatedAt: createdAt,
      });
    }
  }
  await Order.insertMany(orders, { timestamps: false });
  await Counter.updateOne({ _id: 'order' }, { seq: seq - 1 }, { upsert: true });

  // Slot counters from the seeded orders
  const slots = {};
  for (const o of orders) if (o.status !== 'Cancelled') { const k = `${o.pickupDate}|${o.pickupTime}`; slots[k] = (slots[k] || 0) + 1; }
  await SlotBooking.insertMany(Object.entries(slots).map(([k, count]) => { const [date, time] = k.split('|'); return { date, time, count }; }));

  const h = (d, text) => ({ at: d, text });
  const ago = (n) => new Date(Date.now() - n * 86400000);
  await Enquiry.insertMany([
    { reference: 'CE-2041', status: 'New', name: 'Simran Gill', email: 'simran.gill@example.com', phone: '0491 570 156', occasion: 'Engagement', size: '2-tier', servings: 40, requiredDate: addDays(today, 12), diet: ['Eggless'], description: 'Two-tier ivory buttercream cake with gold leaf, fresh blush roses and an acrylic "Simran & Arjun" topper. Pistachio sponge on the bottom tier and rasmalai on top, please.', referenceImages: [{ url: '/images/custom-cake.svg' }], history: [h(ago(0), 'Enquiry received via website')] },
    { reference: 'CE-2040', status: 'New', name: 'Olivia Brown', email: 'olivia.brown@example.com', phone: '0491 570 313', occasion: 'Birthday', size: '7"', servings: 15, requiredDate: addDays(today, 7), diet: ['Eggless', 'Nut-free'], description: 'Pastel rainbow drip cake with sprinkles and a gold number 5 topper. Vanilla sponge. No nuts anywhere please, one guest has a nut allergy.', history: [h(ago(1), 'Enquiry received via website')] },
    { reference: 'CE-2039', status: 'Quoted', name: 'Rajveer Singh', email: 'rajveer.singh@example.com', phone: '0491 570 737', occasion: 'Corporate', size: '9"', servings: 30, requiredDate: addDays(today, 9), diet: ['Eggless'], description: 'Chocolate truffle cake with our company logo as an edible print, for a team celebration of about 30 people.', quote: { lines: [{ label: '9″ Belgian Chocolate Truffle', amount: 89 }, { label: 'Edible logo print', amount: 18 }, { label: 'Extra chocolate decoration', amount: 12 }], depositPercent: 50, note: 'Quote valid for 7 days.', total: 119, sentAt: ago(2) }, history: [h(ago(2), 'Enquiry received via website'), h(ago(2), 'Quote sent · $119.00')] },
    { reference: 'CE-2038', status: 'Awaiting Payment', name: 'Ananya Patel', email: 'ananya.patel@example.com', phone: '0491 570 158', occasion: 'Baby shower', size: '2-tier', servings: 35, requiredDate: addDays(today, 6), diet: ['Eggless', 'Vegan'], description: 'Two-tier vegan cake in sage and cream with a sleeping-moon theme and an "Oh Baby" gold topper.', quote: { lines: [{ label: 'Two-tier vegan celebration cake', amount: 165 }, { label: 'Custom gold topper', amount: 18 }, { label: 'Hand-piped moon and stars', amount: 22 }], depositPercent: 50, note: 'Quote valid for 7 days.', total: 205, sentAt: ago(3) }, history: [h(ago(4), 'Enquiry received via website'), h(ago(3), 'Quote sent · $205.00'), h(ago(1), 'Customer approved quote · deposit requested')] },
    { reference: 'CE-2036', status: 'New', name: 'Mei Chen', email: 'mei.chen@example.com', phone: '0491 570 157', occasion: 'Diwali / festive', size: '9"', servings: 24, requiredDate: addDays(today, 15), diet: ['Eggless', 'Vegan'], description: 'Office Diwali order: a 9″ vegan mango cake plus 2 kg of assorted mithai in gift boxes. Can any of the sweets be made vegan?', history: [h(ago(1), 'Enquiry received via website')] },
  ]);
  await Counter.updateOne({ _id: 'enquiry' }, { seq: 2041 }, { upsert: true });
  logger.info({ orders: orders.length }, 'Demo orders and enquiries seeded');
}

export async function seedDatabase({ fresh = false, demoOrders = false } = {}) {
  if (fresh) {
    await mongoose.connection.db.dropDatabase();
    await Promise.all([Order, Product, User, Enquiry, Settings, Counter, SlotBooking, PriceAudit].map((m) => m.syncIndexes()));
    logger.warn('Database wiped');
  }
  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) settings = await Settings.create(defaultSettings());

  if (!(await Product.exists({}))) {
    await Product.insertMany(catalogue());
    logger.info('Catalogue seeded');
  }

  if (!(await User.exists({ role: 'staff', staffRole: 'owner' }))) {
    const owner = new User({ name: 'Gurdeep (Owner)', email: env.seedAdminEmail, role: 'staff', staffRole: 'owner' });
    await owner.setPassword(env.seedAdminPassword);
    await owner.save();
    logger.info({ email: env.seedAdminEmail }, 'Owner account created — change the password after first sign-in');
  }

  if (demoOrders && !(await Order.exists({}))) {
    const products = await Product.find();
    await seedDemoOrders(products, settings);
  }
}

// CLI entry
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fresh = process.argv.includes('--fresh');
  const { connectDB, disconnectDB } = await import('../config/db.js');
  try {
    await connectDB();
    await seedDatabase({ fresh, demoOrders: fresh || process.argv.includes('--demo') });
    logger.info('Seed complete');
  } catch (err) {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}
