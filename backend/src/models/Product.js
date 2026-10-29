import mongoose from 'mongoose';
import { CATEGORY_IDS, STOCK_STATES } from '../config/constants.js';

const variantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true }, // e.g. 5", 7", 500 g, Plate
    price: { type: Number, required: true, min: 0 },
    serves: { type: String, default: '' },
    // Optional per-variant dietary upgrade surcharges (cakes)
    veganUpcharge: { type: Number, min: 0, default: null },
    gfUpcharge: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    category: { type: String, enum: CATEGORY_IDS, required: true, index: true },
    description: { type: String, default: '', maxlength: 2000 },
    images: [{ url: String, alt: String, publicId: String }],
    variants: { type: [variantSchema], validate: [(v) => v.length > 0, 'At least one variant is required'] },
    // Dietary facts as configured by staff. Never inferred.
    dietary: {
      eggless: { type: Boolean, default: false },
      vegan: { type: Boolean, default: false },
      glutenFree: { type: Boolean, default: false },
      nutFree: { type: Boolean, default: false },
    },
    // Whether vegan / GF can be ordered as a paid upgrade on this product
    upgrades: {
      vegan: { type: Boolean, default: false },
      glutenFree: { type: Boolean, default: false },
    },
    allergens: { type: String, default: '' },
    customisable: { type: Boolean, default: false }, // shows cake builder (sponge, filling, finish, add-ons, message)
    defaults: { sponge: String, filling: String, finish: String },
    available: { type: Boolean, default: true, index: true },
    stockStatus: { type: String, enum: STOCK_STATES, default: 'In stock' },
    stockQty: { type: Number, default: null, min: 0 }, // null = not tracked
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    prepHours: { type: Number, default: null, min: 0 }, // overrides category lead time
    bestseller: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

productSchema.index({ name: 'text', description: 'text' });

productSchema.virtual('fromPrice').get(function fromPrice() {
  if (!this.variants?.length) return undefined; // field not selected
  return Math.min(...this.variants.map((v) => v.price));
});
productSchema.virtual('orderable').get(function orderable() {
  return Boolean(this.available) && !this.archived && !['Sold out', 'Unavailable'].includes(this.stockStatus);
});
productSchema.set('toJSON', { virtuals: true, versionKey: false });

export const Product = mongoose.model('Product', productSchema);
