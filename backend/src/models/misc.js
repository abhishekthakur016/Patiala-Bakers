import mongoose from 'mongoose';

// Atomic sequence numbers (order numbers, enquiry references, audit ids)
const counterSchema = new mongoose.Schema({ _id: String, seq: Number });
export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSeq(name, start) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    [{ $set: { seq: { $add: [{ $ifNull: ['$seq', start - 1] }, 1] } } }],
    { new: true, upsert: true },
  );
  return doc.seq;
}

// Reserves pickup slot capacity atomically: one doc per date+time
const slotSchema = new mongoose.Schema({
  date: { type: String, required: true },
  time: { type: String, required: true },
  count: { type: Number, default: 0 },
});
slotSchema.index({ date: 1, time: 1 }, { unique: true });
export const SlotBooking = mongoose.model('SlotBooking', slotSchema);

// Persisted cart for signed-in customers
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    items: [
      {
        _id: false,
        id: String, // client-side line id
        productId: String,
        variant: String,
        qty: Number,
        options: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true },
);
export const Cart = mongoose.model('Cart', cartSchema);

// Price change audit trail (bulk pricing, CSV import, AI assistant, product edits)
const priceAuditSchema = new mongoose.Schema(
  {
    ref: { type: String, unique: true },
    source: String,
    description: String,
    by: String,
    changes: [{ _id: false, product: mongoose.Schema.Types.ObjectId, name: String, variant: String, oldPrice: Number, newPrice: Number }],
    status: { type: String, enum: ['Applied', 'Rolled back'], default: 'Applied' },
    rolledBackAt: Date,
    rolledBackBy: String,
  },
  { timestamps: true },
);
export const PriceAudit = mongoose.model('PriceAudit', priceAuditSchema);

const scheduledPriceSchema = new mongoose.Schema(
  {
    title: String,
    rule: mongoose.Schema.Types.Mixed,
    description: String,
    runAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['Scheduled', 'Applied', 'Cancelled', 'Failed'], default: 'Scheduled' },
    by: String,
    auditRef: String,
    error: String,
  },
  { timestamps: true },
);
export const ScheduledPrice = mongoose.model('ScheduledPrice', scheduledPriceSchema);

const contactSchema = new mongoose.Schema(
  { name: String, email: String, phone: String, message: String, handled: { type: Boolean, default: false } },
  { timestamps: true },
);
export const ContactMessage = mongoose.model('ContactMessage', contactSchema);
