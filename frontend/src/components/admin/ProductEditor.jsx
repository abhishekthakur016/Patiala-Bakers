import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { Field, Modal, Spinner, Switch } from '../ui.jsx';
import ProductImage from '../ProductImage.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

const STOCK = ['In stock', 'Low stock', 'Sold out', 'Made to order', 'Unavailable'];
const blank = () => ({
  name: '', category: 'cakes', description: '', images: [], variants: [{ key: '', price: '', serves: '', veganUpcharge: null, gfUpcharge: null }],
  dietary: { eggless: false, vegan: false, glutenFree: false, nutFree: false }, upgrades: { vegan: false, glutenFree: false },
  allergens: '', customisable: false, defaults: {}, available: true, stockStatus: 'In stock', stockQty: null, lowStockThreshold: 5, prepHours: null, bestseller: false, featured: false,
});

export default function ProductEditor({ product, onClose, onSaved }) {
  const { categories, settings } = useSettings();
  const [p, setP] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setP(product ? JSON.parse(JSON.stringify({ ...blank(), ...product })) : null); setErrors({}); }, [product]);
  if (!p) return null;
  const isNew = !p._id;
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setNested = (k, kk, v) => setP((x) => ({ ...x, [k]: { ...x[k], [kk]: v } }));
  const setVar = (i, k, v) => setP((x) => ({ ...x, variants: x.variants.map((vv, j) => (j === i ? { ...vv, [k]: v } : vv)) }));
  const co = settings?.cakeOptions;

  const upload = async (files) => {
    if (!files.length) return;
    const fd = new FormData();
    Array.from(files).slice(0, 6).forEach((f) => fd.append('images', f));
    setUploading(true);
    try { const { data } = await api.post('/admin/uploads', fd); set('images', [...p.images, ...data.images.map((im) => ({ ...im, alt: p.name }))]); } catch (e) { toast.error(apiError(e).message); } finally { setUploading(false); }
  };

  const save = async () => {
    const errs = {};
    if (p.name.trim().length < 2) errs.name = 'Enter a name';
    p.variants.forEach((v, i) => { if (!v.key.trim()) errs[`variants.${i}.key`] = 'Required'; if (v.price === '' || Number(v.price) < 0) errs[`variants.${i}.price`] = 'Enter a price'; });
    if (!p.variants.length) errs.variants = 'Add at least one option';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const num = (v) => (v === '' || v == null ? null : Number(v));
    const body = {
      name: p.name, category: p.category, description: p.description, images: p.images.map(({ url, alt, publicId }) => ({ url, alt: alt || p.name, publicId })),
      variants: p.variants.map((v) => ({ key: v.key.trim(), price: Number(v.price), serves: v.serves || '', veganUpcharge: num(v.veganUpcharge), gfUpcharge: num(v.gfUpcharge) })),
      dietary: p.dietary, upgrades: p.upgrades, allergens: p.allergens, customisable: p.customisable, defaults: p.defaults || {},
      available: p.available, stockStatus: p.stockStatus, stockQty: num(p.stockQty), lowStockThreshold: Number(p.lowStockThreshold) || 0, prepHours: num(p.prepHours), bestseller: !!p.bestseller, featured: !!p.featured,
    };
    setSaving(true);
    try {
      const { data } = isNew ? await api.post('/admin/products', body) : await api.patch(`/admin/products/${p._id}`, body);
      toast.success(isNew ? 'Product created' : 'Product saved');
      onSaved(data.product);
    } catch (e) { const ae = apiError(e); setErrors(ae.fields); toast.error(ae.message); } finally { setSaving(false); }
  };

  return (
    <Modal open wide onClose={onClose} title={isNew ? 'New product' : `Edit ${product.name}`} footer={<><button className="btn btn-o" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={save} disabled={saving || uploading}>{saving && <Spinner />} Save product</button></>}>
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <div className="flex flex-col gap-4">
          <Field label="Name" htmlFor="pn" error={errors.name}><input id="pn" className="in" value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Category" htmlFor="pc"><select id="pc" className="in" value={p.category} onChange={(e) => set('category', e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Description" htmlFor="pdsc"><textarea id="pdsc" className="in" value={p.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <div>
            <span className="lbl">Images</span>
            <div className="flex flex-wrap gap-2">
              {p.images.map((im, i) => (
                <div key={im.url} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line">
                  <ProductImage src={im.url} name={p.name} category={p.category} className="h-full w-full object-cover" />
                  <button type="button" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-1" aria-label="Remove image" onClick={() => set('images', p.images.filter((_, j) => j !== i))}><X size={13} /></button>
                  {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-wine/80 text-center text-[10px] font-bold text-white">Main</span>}
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-gold bg-[#FFFAF1] text-xs font-bold text-gold-d">
                {uploading ? <Spinner dark /> : <><ImagePlus size={20} /> Upload</>}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
            <p className="help">JPG, PNG or WebP up to 5 MB. Without a photo an illustration is shown.</p>
          </div>
          <Field label="Allergens" htmlFor="pal" help="Shown on the product page. Only list what is true for this product."><textarea id="pal" className="in !min-h-[70px]" value={p.allergens} onChange={(e) => set('allergens', e.target.value)} /></Field>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="lbl">Sizes / options & prices</span>
            {errors.variants && <p className="ferr">{errors.variants}</p>}
            <div className="flex flex-col gap-2">
              {p.variants.map((v, i) => (
                <div key={i} className="grid items-start gap-2 [grid-template-columns:1fr_90px_1fr_32px]">
                  <input className={`in in-sm ${errors[`variants.${i}.key`] ? 'err' : ''}`} placeholder='e.g. 7" or 500 g' value={v.key} onChange={(e) => setVar(i, 'key', e.target.value)} aria-label="Option name" />
                  <input className={`in in-sm ${errors[`variants.${i}.price`] ? 'err' : ''}`} type="number" step="0.01" min="0" placeholder="Price" value={v.price} onChange={(e) => setVar(i, 'price', e.target.value)} aria-label="Price" />
                  <input className="in in-sm" placeholder="Serves (optional)" value={v.serves || ''} onChange={(e) => setVar(i, 'serves', e.target.value)} aria-label="Serves" />
                  <button type="button" className="iconbtn !h-9 !w-8" aria-label="Remove option" onClick={() => set('variants', p.variants.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                  {(p.upgrades.vegan || p.upgrades.glutenFree) && (
                    <div className="col-span-3 flex gap-2">
                      {p.upgrades.vegan && <input className="in in-sm" type="number" step="0.01" min="0" placeholder="Vegan +$" value={v.veganUpcharge ?? ''} onChange={(e) => setVar(i, 'veganUpcharge', e.target.value)} aria-label="Vegan upcharge" />}
                      {p.upgrades.glutenFree && <input className="in in-sm" type="number" step="0.01" min="0" placeholder="Gluten-free +$" value={v.gfUpcharge ?? ''} onChange={(e) => setVar(i, 'gfUpcharge', e.target.value)} aria-label="Gluten-free upcharge" />}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => set('variants', [...p.variants, { key: '', price: '', serves: '' }])}><Plus size={15} /> Add option</button>
          </div>
          <div>
            <span className="lbl">Dietary facts (as made)</span>
            <div className="flex flex-wrap gap-x-5">{[['eggless', 'Eggless'], ['vegan', 'Vegan'], ['glutenFree', 'Gluten-free'], ['nutFree', 'Nut-free']].map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={!!p.dietary[k]} onChange={(e) => setNested('dietary', k, e.target.checked)} />{l}</label>)}</div>
            <span className="lbl mt-2">Paid upgrades offered</span>
            <div className="flex flex-wrap gap-x-5">{[['vegan', 'Vegan version'], ['glutenFree', 'Gluten-free version']].map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={!!p.upgrades[k]} onChange={(e) => setNested('upgrades', k, e.target.checked)} />{l}</label>)}</div>
          </div>
          <label className="check"><input type="checkbox" checked={p.customisable} onChange={(e) => set('customisable', e.target.checked)} /> Cake builder (sponge, filling, finish, add-ons, message)</label>
          {p.customisable && co && (
            <div className="grid gap-2 sm:grid-cols-3">
              {[['sponge', co.sponges], ['filling', co.fillings], ['finish', co.finishes]].map(([k, list]) => (
                <Field key={k} label={`Default ${k}`} htmlFor={`d-${k}`}><select id={`d-${k}`} className="in in-sm" value={p.defaults?.[k] || ''} onChange={(e) => set('defaults', { ...p.defaults, [k]: e.target.value })}><option value="">—</option>{list.map((o) => <option key={o.name}>{o.name}</option>)}</select></Field>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Stock status" htmlFor="ps"><select id="ps" className="in" value={p.stockStatus} onChange={(e) => set('stockStatus', e.target.value)}>{STOCK.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Stock quantity" htmlFor="pq" help="Leave blank to not track"><input id="pq" type="number" min="0" className="in" value={p.stockQty ?? ''} onChange={(e) => set('stockQty', e.target.value)} /></Field>
            <Field label="Low-stock alert at" htmlFor="pl"><input id="pl" type="number" min="0" className="in" value={p.lowStockThreshold ?? 5} onChange={(e) => set('lowStockThreshold', e.target.value)} /></Field>
            <Field label="Notice needed (hours)" htmlFor="ph" help={`Blank = category default (${settings?.prepHours?.[p.category] ?? '—'}h)`}><input id="ph" type="number" min="0" className="in" value={p.prepHours ?? ''} onChange={(e) => set('prepHours', e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-5">
            <span className="flex items-center gap-2 text-sm font-bold"><Switch on={p.available} onChange={(v) => set('available', v)} label="Available to order" /> Available to order</span>
            <label className="check"><input type="checkbox" checked={!!p.bestseller} onChange={(e) => set('bestseller', e.target.checked)} /> Bestseller badge</label>
            <label className="check"><input type="checkbox" checked={!!p.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured</label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
