import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema({ name: String, price: { type: Number, default: 0, min: 0 }, active: { type: Boolean, default: true } }, { _id: false });
const daySchema = new mongoose.Schema({ closed: Boolean, open: String, close: String }, { _id: false });

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    business: {
      name: String,
      tagline: String,
      address: String,
      phone: String,
      email: String,
      abn: String,
      announcement: String,
    },
    currency: { type: String, default: 'AUD' },
    locale: { type: String, default: 'en-AU' },
    timezone: { type: String, default: 'Australia/Melbourne' },
    // index 0 = Sunday
    hours: { type: [daySchema], default: [] },
    slotMinutes: { type: Number, default: 60 },
    slotCapacity: { type: Number, default: 4 },
    lastSlotBeforeCloseMinutes: { type: Number, default: 60 },
    maxAdvanceDays: { type: Number, default: 60 },
    // Lead times in hours per category
    prepHours: {
      cakes: { type: Number, default: 48 },
      'custom-cakes': { type: Number, default: 120 },
      sweets: { type: Number, default: 24 },
      snacks: { type: Number, default: 4 },
      breads: { type: Number, default: 4 },
      biscuits: { type: Number, default: 4 },
    },
    blockedDates: [{ date: String, reason: String, _id: false }],
    blockedSlots: [{ date: String, time: String, reason: String, _id: false }],
    payments: {
      depositPercent: { type: Number, default: 50, min: 0, max: 100 },
      depositRequiredFor: { type: [String], default: ['custom-cakes'] },
      payAtPickup: { type: Boolean, default: true },
      onlineEnabled: { type: Boolean, default: false },
    },
    fees: {
      serviceFee: { type: Number, default: 0, min: 0 },
      serviceFeeLabel: { type: String, default: 'Service fee' },
    },
    cakeOptions: {
      sponges: [optionSchema],
      fillings: [optionSchema],
      finishes: [optionSchema],
      addons: [optionSchema],
      maxMessageLength: { type: Number, default: 40 },
    },
    notifications: {
      newOrder: { type: Boolean, default: true },
      enquiry: { type: Boolean, default: true },
      lowStock: { type: Boolean, default: true },
      customerConfirmation: { type: Boolean, default: true },
      staffEmail: { type: String, default: '' },
    },
    chatWidget: {
      enabled: { type: Boolean, default: true },
      name: String,
      color: String,
      welcome: String,
      prompts: [String],
      qa: [{ q: String, a: String, _id: false }],
    },
    bakers: { type: [String], default: [] },
  },
  { timestamps: true },
);

settingsSchema.set('toJSON', { versionKey: false });

export const Settings = mongoose.model('Settings', settingsSchema);
