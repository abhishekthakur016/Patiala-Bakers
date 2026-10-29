import mongoose from 'mongoose';
import { ENQUIRY_STATUSES } from '../config/constants.js';

const enquirySchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'New', index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    occasion: { type: String, required: true },
    size: { type: String, default: '' },
    servings: { type: Number, min: 1 },
    requiredDate: { type: String, required: true }, // YYYY-MM-DD
    diet: [String],
    description: { type: String, required: true, maxlength: 4000 },
    referenceImages: [{ url: String, publicId: String, _id: false }],
    budget: { type: String, default: '' },
    quote: {
      lines: [{ label: String, amount: Number, _id: false }],
      depositPercent: Number,
      note: String,
      total: Number,
      sentAt: Date,
    },
    internalNotes: [{ at: { type: Date, default: Date.now }, by: String, text: String, _id: false }],
    history: [{ at: { type: Date, default: Date.now }, by: String, text: String, _id: false }],
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: String,
  },
  { timestamps: true },
);

enquirySchema.set('toJSON', { versionKey: false });

export const Enquiry = mongoose.model('Enquiry', enquirySchema);
