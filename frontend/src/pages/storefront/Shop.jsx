import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import ProductCard, { ProductCardSkeleton } from '../../components/ProductCard.jsx';
import { EmptyState, ErrorState, Pagination } from '../../components/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { cn } from '../../utils/format.js';

const PRICES = [['all', 'Any price'], ['0-20', 'Under $20'], ['20-60', '$20 – $60'], ['60-', '$60 and over']];
const DIETS = [['eggless', 'Eggless'], ['vegan', 'Vegan available'], ['glutenFree', 'Gluten-free available'], ['inStock', 'Available to order']];

export default function Shop() {
  const { categories } = useSettings();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');

  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'featured';
  const price = params.get('price') || 'all';
  const page = Number(params.get('page')) || 1;
  const key = params.toString();

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v === null || v === '' || v === 'all' || v === false) next.delete(k); else next.set(k, v === true ? '1' : v);
    if (k !== 'page') next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    let cancel = false;
    setData(null); setError(null);
    const [minP, maxP] = price === 'all' ? [] : price.split('-');
    const query = { category, sort, page, limit: 12, q: params.get('q') || undefined, minPrice: minP || undefined, maxPrice: maxP || undefined };
    for (const [k] of DIETS) if (params.get(k)) query[k] = '1';
    api.get('/products', { params: query }).then(({ data: d }) => !cancel && setData(d)).catch((e) => !cancel && setError(apiError(e).message));
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const t = setTimeout(() => { if ((params.get('q') || '') !== q) set('q', q.trim()); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const cat = categories.find((c) => c.id === category);
  const title = cat?.name || 'Our menu';

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <nav className="flex flex-wrap items-center gap-2 text-[13px] muted" aria-label="Breadcrumb"><Link to="/" className="font-semibold text-mute">Home</Link><span>/</span><span>{cat ? cat.name : 'Menu'}</span></nav>
          <h1>{title}</h1>
          <p className="mt-2 max-w-xl text-ink-2">{cat?.blurb || 'Eggless cakes, Indian sweets, snacks and fresh bread — all made in our Belmont kitchen.'}</p>
        </div>
      </div>
      <div className="wrap flex flex-wrap items-start gap-8 pb-20 pt-8">
        <aside className={cn('flex-col gap-6 md:flex md:w-[250px] md:flex-none', filtersOpen ? 'flex w-full' : 'hidden')} aria-label="Filters">
          <div>
            <h4 className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-gold-d">Category</h4>
            {[{ id: 'all', name: 'Everything' }, ...categories].map((c) => (
              <button key={c.id} className={cn('fopt', category === c.id && 'on')} onClick={() => set('category', c.id)} aria-pressed={category === c.id}>{c.name}</button>
            ))}
          </div>
          <div>
            <h4 className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-gold-d">Dietary & availability</h4>
            {DIETS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={!!params.get(k)} onChange={(e) => set(k, e.target.checked)} />{l}</label>)}
          </div>
          <div>
            <h4 className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-gold-d">Price</h4>
            {PRICES.map(([k, l]) => <button key={k} className={cn('fopt', price === k && 'on')} onClick={() => set('price', k)} aria-pressed={price === k}>{l}</button>)}
          </div>
          <div className="goldbox flex-col"><b>Need something special?</b><span>Tiered, themed and photo cakes are quoted to order.</span><Link to="/custom-cakes" className="btn btn-p btn-sm mt-1"><Sparkles size={15} /> Custom cake enquiry</Link></div>
        </aside>

        <div className="min-w-0 flex-[999_1_560px]">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] max-w-[420px] flex-1">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" aria-hidden="true" />
              <label className="sr-only" htmlFor="shop-q">Search products</label>
              <input id="shop-q" className="in !pl-10" placeholder="Search cakes, sweets, snacks…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn-o btn-sm md:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}><SlidersHorizontal size={15} /> Filters</button>
            <span className="flex-1" />
            <span className="text-sm muted">{data ? `${data.total} item${data.total === 1 ? '' : 's'}` : ''}</span>
            <label className="sr-only" htmlFor="shop-sort">Sort</label>
            <select id="shop-sort" className="sel" value={sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name A–Z</option><option value="newest">Newest</option>
            </select>
          </div>
          {error ? <ErrorState message={error} onRetry={() => setParams(new URLSearchParams(params))} />
            : !data ? <div className="pgrid">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
              : !data.items.length ? <EmptyState title="No products match those filters" action={<button className="btn btn-o" onClick={() => { setQ(''); setParams({}); }}>Clear filters</button>}>Try another category or remove a filter.</EmptyState>
                : <><div className="pgrid">{data.items.map((p) => <ProductCard key={p._id} p={p} />)}</div><Pagination page={data.page} pages={data.pages} onPage={(n) => { set('page', String(n)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></>}
        </div>
      </div>
    </>
  );
}
