import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, CalendarClock, Check, Info, ShoppingBag } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import ProductImage from '../../components/ProductImage.jsx';
import ProductCard, { dietLabels } from '../../components/ProductCard.jsx';
import { ErrorState, PageLoader, Qty, Spinner } from '../../components/ui.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useCategoryName, useSettings } from '../../context/SettingsContext.jsx';
import { cn, money, sizeLabel } from '../../utils/format.js';

function OptionPills({ list, value, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {list.map((o) => (
        <button key={o.name} type="button" role="radio" aria-checked={value === o.name} className={cn('opt', value === o.name && 'on')} onClick={() => onChange(o.name)}>
          {o.name}{o.price > 0 && <span className="x">+{money(o.price)}</span>}
        </button>
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { settings } = useSettings();
  const catName = useCategoryName();
  const { add, setOpen } = useCart();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [variant, setVariant] = useState('');
  const [opts, setOpts] = useState({});
  const [qty, setQty] = useState(1);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const load = () => {
    setData(null); setError(null);
    api.get(`/products/${slug}`).then(({ data: d }) => {
      setData(d);
      const p = d.product;
      setVariant(p.variants[Math.min(1, p.variants.length - 1)].key);
      setOpts(p.customisable ? { sponge: p.defaults?.sponge, filling: p.defaults?.filling, finish: p.defaults?.finish, vegan: false, glutenFree: false, addons: [], message: '', instructions: '' } : { instructions: '' });
      setQty(1);
    }).catch((e) => setError(apiError(e)));
  };
  useEffect(load, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = data?.product;
  const line = useMemo(() => (p ? { id: 'preview', productId: p._id, variant, qty, options: opts } : null), [p, variant, qty, opts]);

  // Authoritative price from the server for the current configuration
  useEffect(() => {
    if (!line || !p?.orderable) return undefined;
    setQuoting(true);
    const t = setTimeout(() => {
      api.post('/cart/quote', { items: [line] }).then(({ data: d }) => setQuote(d)).catch(() => {}).finally(() => setQuoting(false));
    }, 200);
    return () => clearTimeout(t);
  }, [line, p?.orderable]);

  if (error) return <div className="wrap py-16"><ErrorState message={error.status === 404 ? 'That product is not on our menu.' : error.message} onRetry={error.status === 404 ? undefined : load} /><div className="mt-6 text-center"><Link className="btn btn-p" to="/shop">Browse the menu</Link></div></div>;
  if (!p) return <PageLoader />;

  const co = settings?.cakeOptions;
  const v = p.variants.find((x) => x.key === variant);
  const priced = quote?.lines?.[0];
  const issue = quote?.issues?.[0];
  const diet = dietLabels(p);
  const set = (k, val) => setOpts((o) => ({ ...o, [k]: val }));
  const msgMax = co?.maxMessageLength || 40;

  const addToCart = () => {
    if (!p.orderable || issue) return;
    add({ productId: p._id, variant, qty, options: opts });
    toast.success(`${p.name} added to your cart`);
    setOpen(true);
  };

  return (
    <>
      <div className="wrap">
        <nav className="flex flex-wrap items-center gap-2 pt-6 text-[13px] muted" aria-label="Breadcrumb">
          <Link to="/" className="font-semibold text-mute">Home</Link><span>/</span>
          <Link to={`/shop?category=${p.category}`} className="font-semibold text-mute">{catName(p.category)}</Link><span>/</span><span>{p.name}</span>
        </nav>
        <div className="grid items-start gap-12 pb-10 pt-8 [grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr))]">
          <div className="flex flex-col gap-3.5 lg:sticky lg:top-24">
            <div className="aspect-square overflow-hidden rounded-[22px] border border-line-2 bg-cream-2 shadow-1">
              <ProductImage src={p.images?.[0]?.url} alt={p.images?.[0]?.alt || p.name} name={p.name} category={p.category} className="h-full w-full object-cover" />
            </div>
            {p.images?.length > 1 && <div className="grid grid-cols-4 gap-3">{p.images.slice(1, 5).map((im) => <ProductImage key={im.url} src={im.url} alt={im.alt} name={p.name} category={p.category} className="aspect-square w-full rounded-xl object-cover" />)}</div>}
          </div>

          <div>
            <p className="eyebrow">{catName(p.category)}</p>
            <h1 className="mt-2 text-[clamp(40px,4.4vw,56px)] text-wine-ink">{p.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-extrabold text-wine num">{v ? money(v.price) : ''}</span>
              {p.bestseller && <span className="pill-best">Bestseller</span>}
              {!p.orderable && <span className="badge b-bad">{p.stockStatus === 'Sold out' ? 'Sold out' : 'Currently unavailable'}</span>}
              {p.orderable && p.stockStatus === 'Low stock' && <span className="badge b-warn">Only a few left</span>}
            </div>
            <p className="mt-3.5 text-[16.5px] text-ink-2">{p.description}</p>
            {diet.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{diet.map((d) => <span key={d} className="badge b-ok">{d}</span>)}</div>}

            <div className="osec">
              <h4>{p.customisable ? 'Size' : 'Choose an option'} <span className="font-semibold text-mute">{sizeLabel(variant)}{v?.serves ? ` · ${v.serves}` : ''}</span></h4>
              <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr))]" role="radiogroup" aria-label="Size">
                {p.variants.map((x) => (
                  <button key={x.key} type="button" role="radio" aria-checked={variant === x.key} className={cn('size', variant === x.key && 'on')} onClick={() => setVariant(x.key)}>
                    <b>{sizeLabel(x.key)}</b><span className="text-sm font-extrabold">{money(x.price)}</span>{x.serves && <span className="text-xs muted">{x.serves}</span>}
                  </button>
                ))}
              </div>
            </div>

            {(p.upgrades?.vegan || p.upgrades?.glutenFree || p.dietary?.eggless) && p.category !== 'snacks' && (
              <div className="osec">
                <h4>Dietary</h4>
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                  {p.dietary?.eggless && <div className="dbox lock"><Check size={18} className="text-ok" /><span className="flex flex-col text-sm font-bold leading-tight">Eggless<span className="text-xs font-semibold text-ok">Included</span></span></div>}
                  {p.upgrades?.vegan && v?.veganUpcharge != null && (
                    <label className="dbox"><input type="checkbox" checked={!!opts.vegan} onChange={(e) => set('vegan', e.target.checked)} /><span className="flex flex-col text-sm font-bold leading-tight">Vegan upgrade<span className="text-xs font-semibold text-mute">+{money(v.veganUpcharge)}</span></span></label>
                  )}
                  {p.upgrades?.glutenFree && v?.gfUpcharge != null && (
                    <label className="dbox"><input type="checkbox" checked={!!opts.glutenFree} onChange={(e) => set('glutenFree', e.target.checked)} /><span className="flex flex-col text-sm font-bold leading-tight">Gluten-free sponge<span className="text-xs font-semibold text-mute">+{money(v.gfUpcharge)}</span></span></label>
                  )}
                </div>
              </div>
            )}

            {p.customisable && co && (
              <>
                <div className="osec"><h4>Sponge <span className="font-semibold text-mute">{opts.sponge}</span></h4><OptionPills label="Sponge" list={co.sponges} value={opts.sponge} onChange={(x) => set('sponge', x)} /></div>
                <div className="osec"><h4>Filling <span className="font-semibold text-mute">{opts.filling}</span></h4><OptionPills label="Filling" list={co.fillings} value={opts.filling} onChange={(x) => set('filling', x)} /></div>
                <div className="osec"><h4>Finish & decoration <span className="font-semibold text-mute">{opts.finish}</span></h4><OptionPills label="Finish" list={co.finishes} value={opts.finish} onChange={(x) => set('finish', x)} /></div>
                <div className="osec">
                  <h4>Add-ons</h4>
                  <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                    {co.addons.map((a) => (
                      <label key={a.name} className="dbox !min-h-[48px]"><input type="checkbox" checked={opts.addons?.includes(a.name)} onChange={(e) => set('addons', e.target.checked ? [...opts.addons, a.name] : opts.addons.filter((x) => x !== a.name))} /><span className="flex-1 text-sm font-bold">{a.name}</span><span className="text-xs font-bold text-gold-d">+{money(a.price)}</span></label>
                    ))}
                  </div>
                </div>
                <div className="osec">
                  <label className="lbl" htmlFor="msg">Message on the cake <span className="font-semibold text-mute">(optional)</span></label>
                  <input id="msg" className="in" maxLength={msgMax} value={opts.message} onChange={(e) => set('message', e.target.value)} placeholder="e.g. Happy Birthday Aarav" />
                  <p className="help">{opts.message?.length || 0}/{msgMax} characters · piped in chocolate or buttercream</p>
                </div>
              </>
            )}

            <div className="osec">
              <label className="lbl" htmlFor="ins">Additional instructions <span className="font-semibold text-mute">(optional)</span></label>
              <textarea id="ins" className="in !min-h-[80px]" maxLength={500} value={opts.instructions || ''} onChange={(e) => set('instructions', e.target.value)} placeholder="Colours, allergies, anything we should know" />
            </div>

            {priced?.priceBreakdown?.length > 1 && (
              <div className="breakdown mt-4" aria-label="Price breakdown">
                {priced.priceBreakdown.map((b, i) => <div className="l" key={i}><span>{b.label}</span><span className="num">{money(b.amount)}</span></div>)}
                <div className="l font-extrabold"><span>Each</span><span className="num">{money(priced.unitPrice)}</span></div>
              </div>
            )}
            {issue && <p className="errbox mt-4">{issue.message}</p>}

            <div className="mt-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
              <div className="note"><h5><CalendarClock size={15} /> Notice needed</h5><p className="text-[13.5px] text-ink-2">Order at least {p.leadHours} hours before pickup.</p></div>
              <div className="note"><h5><AlertTriangle size={15} /> Allergens</h5><p className="text-[13.5px] text-ink-2">{p.allergens || 'Ask us about allergens before ordering.'}</p></div>
              <div className="note"><h5><Info size={15} /> Pickup only</h5><p className="text-[13.5px] text-ink-2">{settings?.business?.address}</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky-buy no-print">
        <div className="wrap flex min-h-[80px] flex-wrap items-center gap-4 py-2.5">
          <div className="flex min-w-[220px] flex-1 items-center gap-3">
            <ProductImage src={p.images?.[0]?.url} name={p.name} category={p.category} className="h-[52px] w-[52px] overflow-hidden rounded-xl object-cover" />
            <div><b className="block">{p.name}</b><span className="text-[13px] muted">{sizeLabel(variant)}{opts.vegan ? ' · Vegan' : ''}{opts.glutenFree ? ' · GF' : ''}</span></div>
          </div>
          <Qty value={qty} onChange={(n) => setQty(Math.max(1, Math.min(50, n)))} />
          <span className="min-w-[90px] text-right text-[22px] font-extrabold text-wine num">{quoting && !priced ? <Spinner dark /> : priced ? money(priced.lineTotal) : v ? money(v.price * qty) : ''}</span>
          <button className="btn btn-p btn-lg" disabled={!p.orderable || !!issue || quoting} onClick={addToCart}><ShoppingBag size={18} /> {p.orderable ? 'Add to cart' : 'Unavailable'}</button>
        </div>
      </div>

      {data.related?.length > 0 && (
        <section className="wrap py-16"><h2 className="sec-title mb-7">You might also like</h2><div className="pgrid">{data.related.map((r) => <ProductCard key={r._id} p={r} />)}</div></section>
      )}
    </>
  );
}
