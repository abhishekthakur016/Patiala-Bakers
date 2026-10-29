import { Product } from '../models/Product.js';
import { nextSeq, PriceAudit, ScheduledPrice } from '../models/misc.js';
import { CATEGORIES } from '../config/constants.js';
import { badRequest, conflict, r2 } from '../utils/http.js';
import { logger } from '../config/logger.js';

const CAKE_SIZES = ['5"', '7"', '9"'];

function roundTo(n, mode) {
  if (mode === '0.5') return Math.round(n * 2) / 2;
  if (mode === '1') return Math.round(n);
  if (mode === '0.95') return Math.max(0.95, Math.floor(n) + 0.95);
  return r2(n);
}

export function describeRule(rule) {
  const cats = Object.entries(rule.cats || {}).filter(([, v]) => v).map(([k]) => CATEGORIES.find((c) => c.id === k)?.name || k);
  const sizes = Object.entries(rule.sizes || {}).filter(([, v]) => v).map(([k]) => (k === 'other' ? 'other sizes' : k.replace('"', '″')));
  const amt = rule.type === '%' ? `${rule.amt}%` : `$${Number(rule.amt).toFixed(2)}`;
  return `${cats.join(', ') || 'No categories'} · ${sizes.join(', ') || 'no sizes'} · ${rule.dir === 'dec' ? '−' : '+'}${amt}`;
}

/** Computes proposed price changes for a rule without writing anything. */
export async function previewRule(rule) {
  const amt = Number(rule.amt);
  if (!Number.isFinite(amt) || amt <= 0) throw badRequest('Enter an amount greater than zero.');
  if (rule.type === '%' && amt > 100) throw badRequest('Percentage changes must be 100% or less.');
  const cats = Object.entries(rule.cats || {}).filter(([, v]) => v).map(([k]) => k);
  if (!cats.length) throw badRequest('Choose at least one category.');
  const sizes = rule.sizes || {};
  const products = await Product.find({ category: { $in: cats }, archived: false }).sort({ category: 1, sortOrder: 1, name: 1 });
  const rows = [];
  for (const p of products) {
    if (rule.skipUnavail && !p.orderable) continue;
    for (const v of p.variants) {
      const isCake = CAKE_SIZES.includes(v.key);
      if (isCake ? !sizes[v.key] : !sizes.other) continue;
      const delta = rule.type === '%' ? v.price * amt / 100 : amt;
      const raw = rule.dir === 'dec' ? v.price - delta : v.price + delta;
      const neu = roundTo(raw, rule.round);
      const row = { product: p._id.toString(), name: p.name, category: p.category, variant: v.key, oldPrice: v.price, newPrice: neu };
      if (neu <= 0) row.error = 'Price would be zero or negative';
      rows.push(row);
    }
  }
  return { rows, description: describeRule(rule) };
}

/** Applies a list of {product, variant, newPrice} changes and records an audit entry. */
export async function applyChanges(changes, { source, description, by }) {
  const valid = changes.filter((c) => !c.error && Number(c.newPrice) > 0);
  if (!valid.length) throw badRequest('There are no valid price changes to apply.');
  const applied = [];
  for (const c of valid) {
    const p = await Product.findById(c.product);
    if (!p) continue;
    const v = p.variants.find((x) => x.key === c.variant);
    if (!v) continue;
    applied.push({ product: p._id, name: p.name, variant: v.key, oldPrice: v.price, newPrice: r2(c.newPrice) });
    v.price = r2(c.newPrice);
    await p.save();
  }
  const ref = `A-${await nextSeq('audit', 101)}`;
  const audit = await PriceAudit.create({ ref, source, description, by, changes: applied });
  logger.info({ ref, count: applied.length, source }, 'Prices updated');
  return audit;
}

export async function rollbackAudit(id, by) {
  const audit = await PriceAudit.findById(id);
  if (!audit) throw badRequest('Audit entry not found.');
  if (audit.status === 'Rolled back') throw conflict('This change has already been rolled back.');
  for (const c of audit.changes) {
    await Product.updateOne({ _id: c.product, 'variants.key': c.variant }, { $set: { 'variants.$.price': c.oldPrice } });
  }
  audit.status = 'Rolled back';
  audit.rolledBackAt = new Date();
  audit.rolledBackBy = by;
  await audit.save();
  return audit;
}

/** Runs scheduled price changes that are due. Called on an interval from server.js. */
export async function runDueSchedules() {
  const due = await ScheduledPrice.find({ status: 'Scheduled', runAt: { $lte: new Date() } });
  for (const s of due) {
    try {
      const { rows, description } = await previewRule(s.rule);
      const audit = await applyChanges(rows, { source: 'Scheduled change', description: s.title || description, by: s.by });
      s.status = 'Applied';
      s.auditRef = audit.ref;
    } catch (err) {
      s.status = 'Failed';
      s.error = err.message;
      logger.error({ err, id: s._id }, 'Scheduled price change failed');
    }
    await s.save();
  }
}

/** Parses "product_slug,product_name,variant,price" CSV text into validated rows. */
export async function previewCsv(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw badRequest('The CSV file is empty.');
  const header = lines[0].toLowerCase();
  const body = header.includes('price') ? lines.slice(1) : lines;
  const products = await Product.find({ archived: false });
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const parseCsvLine = (l) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"' && l[i + 1] === '"' && q) { cur += '"'; i++; } else if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  return body.map((l, i) => {
    const [slug, name, variant, priceStr] = parseCsvLine(l);
    const row = { line: i + 2, slug, name, variant, newPrice: Number(priceStr) };
    const p = bySlug.get(String(slug).toLowerCase());
    if (!p) return { ...row, status: 'error', error: 'Unknown product id' };
    const v = p.variants.find((x) => x.key === variant);
    if (!v) return { ...row, name: p.name, status: 'error', error: `Unknown variant (valid: ${p.variants.map((x) => x.key).join(', ')})` };
    if (!Number.isFinite(row.newPrice) || row.newPrice <= 0) return { ...row, name: p.name, oldPrice: v.price, status: 'error', error: 'Price must be a positive number' };
    return { ...row, product: p._id.toString(), name: p.name, oldPrice: v.price, newPrice: r2(row.newPrice), status: v.price === r2(row.newPrice) ? 'unchanged' : 'ok' };
  });
}
