import { z } from 'zod';
import {
  CATEGORY_IDS, ENQUIRY_STATUSES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, PERMISSIONS, PRIORITIES, STAFF_ROLES, STOCK_STATES,
} from '../config/constants.js';

const phone = z.string().trim().min(6, 'Enter a valid phone number').max(30).regex(/^[+()\d\s-]+$/, 'Enter a valid phone number');
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(160);
const name = z.string().trim().min(2, 'Enter your name').max(120);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time');
const password = z.string().min(8, 'Use at least 8 characters').max(128);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// ── Auth ──
export const registerSchema = z.object({ name, email, phone: phone.optional().or(z.literal('')), password });
export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const profileSchema = z.object({ name, phone: phone.optional().or(z.literal('')), dietaryPref: z.string().max(60).optional() });
export const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

// ── Cart / checkout ──
export const cartItemSchema = z.object({
  id: z.string().max(80).optional(),
  productId: z.string().max(40),
  variant: z.string().max(40),
  qty: z.coerce.number().int().min(1).max(50),
  options: z.object({
    sponge: z.string().max(60).optional(),
    filling: z.string().max(60).optional(),
    finish: z.string().max(60).optional(),
    vegan: z.boolean().optional(),
    glutenFree: z.boolean().optional(),
    message: z.string().max(80).optional(),
    addons: z.array(z.string().max(60)).max(12).optional(),
    instructions: z.string().max(500).optional(),
  }).partial().optional().default({}),
});
export const cartSchema = z.object({ items: z.array(cartItemSchema).max(40) });

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Your cart is empty').max(40),
  customer: z.object({ name, email, phone }),
  pickupDate: dateStr,
  pickupTime: timeStr,
  notes: z.string().max(1000).optional().default(''),
  paymentMethod: z.enum(['pay_at_pickup', 'card_online', 'deposit_online']).default('pay_at_pickup'),
  idempotencyKey: z.string().min(8).max(80),
});

// ── Enquiries ──
export const enquirySchema = z.object({
  name, email, phone,
  occasion: z.string().trim().min(2, 'Choose an occasion').max(60),
  size: z.string().trim().max(40).optional().default(''),
  servings: z.coerce.number().int().min(1, 'Enter servings').max(500),
  requiredDate: dateStr,
  diet: z.array(z.string().max(30)).max(6).optional().default([]),
  description: z.string().trim().min(15, 'Tell us a little more about your cake (15+ characters)').max(4000),
  budget: z.string().max(60).optional().default(''),
});

export const contactSchema = z.object({ name, email, phone: z.string().max(30).optional().default(''), message: z.string().trim().min(5, 'Enter a message').max(3000) });
export const chatSchema = z.object({ message: z.string().trim().min(1).max(500) });
export const trackSchema = z.object({ orderNumber: z.string().trim().toUpperCase().max(20), email });

// ── Admin: products ──
const variantSchema = z.object({
  key: z.string().trim().min(1).max(40),
  price: z.coerce.number().min(0).max(100000),
  serves: z.string().max(40).optional().default(''),
  veganUpcharge: z.coerce.number().min(0).nullable().optional(),
  gfUpcharge: z.coerce.number().min(0).nullable().optional(),
});
export const productSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and dashes').max(80).optional(),
  category: z.enum(CATEGORY_IDS),
  description: z.string().max(2000).optional().default(''),
  images: z.array(z.object({ url: z.string().max(500), alt: z.string().max(200).optional(), publicId: z.string().max(300).optional() })).max(8).optional().default([]),
  variants: z.array(variantSchema).min(1, 'Add at least one size or option').max(12),
  dietary: z.object({ eggless: z.boolean(), vegan: z.boolean(), glutenFree: z.boolean(), nutFree: z.boolean() }).partial().optional().default({}),
  upgrades: z.object({ vegan: z.boolean(), glutenFree: z.boolean() }).partial().optional().default({}),
  allergens: z.string().max(500).optional().default(''),
  customisable: z.boolean().optional().default(false),
  defaults: z.object({ sponge: z.string().max(60), filling: z.string().max(60), finish: z.string().max(60) }).partial().optional(),
  available: z.boolean().optional().default(true),
  stockStatus: z.enum(STOCK_STATES).optional().default('In stock'),
  stockQty: z.coerce.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  prepHours: z.coerce.number().min(0).max(720).nullable().optional(),
  bestseller: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
});
export const productPatchSchema = productSchema.partial();

// ── Admin: orders ──
export const orderQuerySchema = z.object({
  q: z.string().max(80).optional(),
  status: z.string().optional(),
  payment: z.string().optional(),
  priority: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD | today | tomorrow | week | upcoming | past
  from: z.string().optional(),
  to: z.string().optional(),
  time: z.string().optional(),
  sort: z.enum(['pickup', '-pickup', 'created', '-created', 'total', '-total']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
export const statusSchema = z.object({ status: z.enum(ORDER_STATUSES), note: z.string().max(300).optional(), notify: z.boolean().optional() });
export const orderPatchSchema = z.object({
  priority: z.enum(PRIORITIES).optional(),
  baker: z.string().max(60).optional(),
  internalNotes: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
  pickupDate: dateStr.optional(),
  pickupTime: timeStr.optional(),
  customer: z.object({ name, email, phone }).partial().optional(),
});
export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Enter an amount').max(100000),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().max(80).optional(),
  note: z.string().max(200).optional(),
});
export const refundSchema = z.object({ note: z.string().max(200).optional() });
export const manualOrderSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(40),
  customer: z.object({ name, email, phone }),
  pickupDate: dateStr,
  pickupTime: timeStr,
  notes: z.string().max(1000).optional().default(''),
  source: z.enum(['Phone', 'In store']).default('Phone'),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});

// ── Admin: enquiries ──
export const enquiryPatchSchema = z.object({ status: z.enum(ENQUIRY_STATUSES).optional() });
export const enquiryNoteSchema = z.object({ text: z.string().trim().min(1).max(2000) });
export const quoteSchema = z.object({
  lines: z.array(z.object({ label: z.string().trim().min(1).max(120), amount: z.coerce.number().min(0).max(100000) })).min(1, 'Add at least one quote line'),
  depositPercent: z.coerce.number().min(0).max(100),
  note: z.string().max(500).optional().default(''),
  send: z.boolean().optional().default(true),
});
export const convertSchema = z.object({
  pickupTime: timeStr,
  pickupDate: dateStr.optional(),
  depositPaid: z.boolean().optional().default(false),
  variant: z.string().max(40).optional(),
});

// ── Admin: pricing ──
export const ruleSchema = z.object({
  cats: z.record(z.boolean()),
  sizes: z.record(z.boolean()),
  dir: z.enum(['inc', 'dec']),
  type: z.enum(['%', '$']),
  amt: z.coerce.number().positive('Enter an amount'),
  round: z.enum(['none', '0.5', '1', '0.95']).default('none'),
  skipUnavail: z.boolean().default(true),
});
export const applySchema = z.object({
  changes: z.array(z.object({ product: objectId, variant: z.string().max(40), newPrice: z.coerce.number().positive(), oldPrice: z.number().optional(), name: z.string().optional() })).min(1).max(1000),
  description: z.string().max(200).default('Price change'),
  source: z.enum(['Bulk Price Manager', 'CSV import', 'AI Assistant']).default('Bulk Price Manager'),
});
export const scheduleSchema = z.object({ title: z.string().trim().min(2).max(120), rule: ruleSchema, runAt: z.coerce.date() });
export const csvSchema = z.object({ csv: z.string().min(1).max(200000) });

// ── Admin: calendar / settings / staff ──
export const blockSchema = z.object({ date: dateStr, time: timeStr.optional(), reason: z.string().max(120).optional().default('') });

const opt = z.object({ name: z.string().trim().min(1).max(60), price: z.coerce.number().min(0).max(10000), active: z.boolean().optional().default(true) });
export const settingsSchema = z.object({
  business: z.object({ name: z.string().max(120), tagline: z.string().max(160), address: z.string().max(200), phone: z.string().max(40), email: z.string().max(160), abn: z.string().max(40), announcement: z.string().max(240) }).partial(),
  currency: z.string().length(3),
  locale: z.string().max(10),
  timezone: z.string().max(60),
  hours: z.array(z.object({ closed: z.boolean(), open: timeStr, close: timeStr })).length(7),
  slotMinutes: z.coerce.number().int().min(15).max(240),
  slotCapacity: z.coerce.number().int().min(1).max(100),
  lastSlotBeforeCloseMinutes: z.coerce.number().int().min(0).max(240),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  prepHours: z.record(z.coerce.number().min(0).max(720)),
  payments: z.object({ depositPercent: z.coerce.number().min(0).max(100), depositRequiredFor: z.array(z.enum(CATEGORY_IDS)), payAtPickup: z.boolean(), onlineEnabled: z.boolean() }).partial(),
  fees: z.object({ serviceFee: z.coerce.number().min(0).max(1000), serviceFeeLabel: z.string().max(60) }).partial(),
  cakeOptions: z.object({ sponges: z.array(opt), fillings: z.array(opt), finishes: z.array(opt), addons: z.array(opt), maxMessageLength: z.coerce.number().int().min(5).max(120) }).partial(),
  notifications: z.object({ newOrder: z.boolean(), enquiry: z.boolean(), lowStock: z.boolean(), customerConfirmation: z.boolean(), staffEmail: z.string().max(160) }).partial(),
  chatWidget: z.object({ enabled: z.boolean(), name: z.string().max(80), color: z.string().max(20), welcome: z.string().max(400), prompts: z.array(z.string().max(120)).max(10), qa: z.array(z.object({ q: z.string().max(200), a: z.string().max(1000) })).max(30) }).partial(),
  bakers: z.array(z.string().trim().min(1).max(40)).max(30),
}).partial();

export const staffSchema = z.object({
  name, email,
  phone: z.string().max(30).optional().default(''),
  password: password.optional(),
  staffRole: z.enum(STAFF_ROLES),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  active: z.boolean().optional(),
});
export const customerPatchSchema = z.object({ dietaryPref: z.string().max(60).optional(), adminNotes: z.string().max(2000).optional(), phone: z.string().max(30).optional() });
export const aiSchema = z.object({ message: z.string().trim().min(1).max(500) });
export { objectId };
