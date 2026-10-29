import mongoose from 'mongoose';
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, PRIORITIES } from '../config/constants.js';

const lineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    slug: String,
    name: { type: String, required: true },
    image: String,
    category: String,
    variant: String,
    options: {
      sponge: String,
      filling: String,
      finish: String,
      vegan: Boolean,
      glutenFree: Boolean,
      message: String,
      addons: [String],
      instructions: String,
    },
    diet: [String],
    priceBreakdown: [{ label: String, amount: Number, _id: false }],
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS },
    amount: Number,
    reference: String,
    provider: String,
    at: { type: Date, default: Date.now },
    by: String,
    note: String,
  },
  { _id: true },
);

const historySchema = new mongoose.Schema(
  { at: { type: Date, default: Date.now }, text: String, by: String },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, index: true },
      phone: { type: String, required: true },
    },
    items: { type: [lineSchema], validate: [(v) => v.length > 0, 'Order needs at least one item'] },
    pickupDate: { type: String, required: true, index: true }, // YYYY-MM-DD in bakery time zone
    pickupTime: { type: String, required: true }, // HH:MM
    notes: { type: String, default: '' },
    subtotal: { type: Number, required: true },
    fees: { type: Number, default: 0 },
    total: { type: Number, required: true },
    depositPercent: { type: Number, default: 0 },
    depositDue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Unpaid', index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'pay_at_pickup' },
    payments: [paymentSchema],
    stripeSessionId: { type: String, index: true, sparse: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'Confirmed', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'Normal' },
    baker: { type: String, default: '' },
    source: { type: String, enum: ['Online', 'Phone', 'In store', 'Enquiry'], default: 'Online' },
    enquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
    enquiryRef: String,
    internalNotes: { type: String, default: '' },
    history: [historySchema],
    idempotencyKey: { type: String, unique: true, sparse: true },
    // Lets a guest view their own confirmation page without an account
    accessToken: { type: String, select: false },
    confirmationEmailSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

orderSchema.index({ pickupDate: 1, pickupTime: 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.virtual('balanceDue').get(function balanceDue() {
  return Math.max(0, Math.round((this.total - this.amountPaid) * 100) / 100);
});
orderSchema.set('toJSON', { virtuals: true, versionKey: false });

export const Order = mongoose.model('Order', orderSchema);
