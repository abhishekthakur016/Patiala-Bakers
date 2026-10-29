import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { r2 } from '../utils/http.js';

const findOpt = (list, name) => list.find((o) => o.active !== false && o.name === name);

export function leadHoursFor(product, settings) {
  if (product.prepHours != null) return product.prepHours;
  return settings.prepHours?.[product.category] ?? 24;
}

/**
 * Prices cart items against current database prices and settings.
 * Never trusts prices from the client. Returns priced lines plus a list of issues (one per invalid line).
 */
export async function priceItems(items, settings) {
  const ids = [...new Set(items.map((i) => i.productId).filter((id) => mongoose.isValidObjectId(id)))];
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  const opts = settings.cakeOptions;

  const lines = [];
  const issues = [];
  let maxLeadHours = 0;

  for (const item of items) {
    const lineId = item.id || item.productId;
    const p = byId.get(String(item.productId));
    const fail = (message) => issues.push({ id: lineId, productId: item.productId, message });

    if (!p || p.archived) { fail('This product is no longer on our menu.'); continue; }
    if (!p.orderable) { fail(`${p.name} is currently ${p.stockStatus === 'Sold out' ? 'sold out' : 'unavailable'}.`); continue; }
    const variant = p.variants.find((v) => v.key === item.variant);
    if (!variant) { fail(`Please choose a valid option for ${p.name}.`); continue; }
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) { fail(`Quantity for ${p.name} must be between 1 and 50.`); continue; }
    if (p.stockQty != null && qty > p.stockQty) { fail(`Only ${p.stockQty} × ${p.name} left in stock.`); continue; }

    const o = item.options || {};
    const breakdown = [{ label: `${p.name} · ${variant.key}`, amount: variant.price }];
    let unit = variant.price;
    const diet = [];
    if (p.dietary.eggless) diet.push('Eggless');
    const options = {};
    let bad = null;

    if (o.vegan) {
      if (p.dietary.vegan) { /* already vegan, no charge */ } else if (p.upgrades.vegan && variant.veganUpcharge != null) {
        unit += variant.veganUpcharge; breakdown.push({ label: 'Vegan upgrade', amount: variant.veganUpcharge });
      } else bad = `A vegan version of ${p.name} is not available.`;
      options.vegan = true;
    }
    if (p.dietary.vegan || o.vegan) diet.push('Vegan');
    if (o.glutenFree) {
      if (p.dietary.glutenFree) { /* already GF */ } else if (p.upgrades.glutenFree && variant.gfUpcharge != null) {
        unit += variant.gfUpcharge; breakdown.push({ label: 'Gluten-free upgrade', amount: variant.gfUpcharge });
      } else bad = `A gluten-free version of ${p.name} is not available.`;
      options.glutenFree = true;
    }
    if (p.dietary.glutenFree || o.glutenFree) diet.push('Gluten-free');
    if (p.dietary.nutFree) diet.push('Nut-free');

    if (p.customisable) {
      for (const [field, list, label] of [['sponge', opts.sponges, 'sponge'], ['filling', opts.fillings, 'filling'], ['finish', opts.finishes, 'finish']]) {
        const chosen = o[field] || p.defaults?.[field];
        if (!chosen) continue;
        const opt = findOpt(list, chosen);
        if (!opt) { bad = `The ${label} “${chosen}” is no longer available.`; break; }
        options[field] = opt.name;
        if (opt.price) { unit += opt.price; breakdown.push({ label: `${opt.name} ${label}`, amount: opt.price }); }
      }
      const addons = Array.isArray(o.addons) ? [...new Set(o.addons)] : [];
      for (const a of addons) {
        const opt = findOpt(opts.addons, a);
        if (!opt) { bad = `The add-on “${a}” is no longer available.`; break; }
        unit += opt.price; breakdown.push({ label: opt.name, amount: opt.price });
      }
      options.addons = addons;
      const msg = String(o.message || '').trim();
      if (msg.length > (opts.maxMessageLength || 40)) bad = `Cake message must be ${opts.maxMessageLength} characters or fewer.`;
      options.message = msg;
    }
    options.instructions = String(o.instructions || '').trim().slice(0, 500);
    if (bad) { fail(bad); continue; }

    unit = r2(unit);
    maxLeadHours = Math.max(maxLeadHours, leadHoursFor(p, settings));
    lines.push({
      id: lineId,
      product: p._id,
      slug: p.slug,
      name: p.name,
      image: p.images?.[0]?.url || '',
      category: p.category,
      variant: variant.key,
      options,
      diet,
      priceBreakdown: breakdown,
      qty,
      unitPrice: unit,
      lineTotal: r2(unit * qty),
      leadHours: leadHoursFor(p, settings),
    });
  }

  const subtotal = r2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const fees = lines.length ? r2(settings.fees?.serviceFee || 0) : 0;
  const total = r2(subtotal + fees);
  const depositCategories = settings.payments?.depositRequiredFor || [];
  const depositRequired = lines.some((l) => depositCategories.includes(l.category));
  return { lines, issues, subtotal, fees, feeLabel: settings.fees?.serviceFeeLabel || 'Service fee', total, maxLeadHours, depositRequired };
}
