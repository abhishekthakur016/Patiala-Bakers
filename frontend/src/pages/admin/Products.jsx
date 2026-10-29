import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Archive, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, Confirm, EmptyState, ErrorState, Skeleton, Switch } from '../../components/ui.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import ProductEditor from '../../components/admin/ProductEditor.jsx';
import { useCategoryName, useSettings } from '../../context/SettingsContext.jsx';
import { cn, money, sizeLabel } from '../../utils/format.js';

const STOCK = ['In stock', 'Low stock', 'Sold out', 'Made to order', 'Unavailable'];

export default function Products() {
  const { categories } = useSettings();
  const catName = useCategoryName();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const cat = params.get('cat') || 'all';
  const avail = params.get('avail') || 'all';
  const archived = params.get('archived') === '1';
  const { data, error, reload, setData } = useFetch('/admin/products', { q: q || undefined, category: cat, avail, archived: archived ? '1' : undefined });
  const [editing, setEditing] = useState(null);
  const [archiveAsk, setArchiveAsk] = useState(null);
  const set = (k, v) => { const n = new URLSearchParams(params); if (!v || v === 'all') n.delete(k); else n.set(k, v); setParams(n, { replace: true }); };

  // Deep link from dashboard / AI assistant: /admin/products?edit=<id>
  useEffect(() => {
    const id = params.get('edit');
    if (id && data?.items) {
      const p = data.items.find((x) => x._id === id);
      if (p) setEditing(p); else api.get('/admin/products', { params: { archived: '1' } }).then(({ data: d }) => { const a = d.items.find((x) => x._id === id); if (a) setEditing(a); });
    }
  }, [params, data]);

  const quick = async (p, body, msg) => {
    setData((d) => ({ ...d, items: d.items.map((x) => (x._id === p._id ? { ...x, ...body } : x)) }));
    try { await api.patch(`/admin/products/${p._id}`, body); toast.success(msg); reload({ silent: true }); } catch (e) { toast.error(apiError(e).message); reload({ silent: true }); }
  };
  const doArchive = async () => {
    try { await api.post(`/admin/products/${archiveAsk._id}/archive`, archived ? { restore: true } : {}); toast.success(archived ? 'Product restored' : 'Product archived'); setArchiveAsk(null); reload({ silent: true }); } catch (e) { toast.error(apiError(e).message); }
  };
  const closeEditor = () => { setEditing(null); if (params.get('edit')) set('edit', ''); };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-[360px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden="true" /><label className="sr-only" htmlFor="pq">Search products</label><input id="pq" className="in !min-h-[40px] !pl-10" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="sel" aria-label="Category" value={cat} onChange={(e) => set('cat', e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="sel" aria-label="Availability" value={avail} onChange={(e) => set('avail', e.target.value)}><option value="all">Any availability</option><option value="available">Available</option><option value="hidden">Hidden</option><option value="attention">Needs attention</option></select>
        <label className="check text-sm"><input type="checkbox" checked={archived} onChange={(e) => set('archived', e.target.checked ? '1' : '')} /> Show archived</label>
        <span className="flex-1" />
        <button className="btn btn-p btn-sm" onClick={() => setEditing({})}><Plus size={15} /> New product</button>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Skeleton className="h-96" /> : !data.items.length ? <EmptyState title="No products found" /> : (
        <div className="tblwrap">
          <table className="tbl min-w-[1000px]">
            <thead><tr><th /><th>Product</th><th>Category</th><th>Prices</th><th>Dietary</th><th>Stock status</th><th>Qty</th><th>On sale</th><th /></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p._id}>
                  <td><ProductImage src={p.images?.[0]?.url} name={p.name} category={p.category} className="h-11 w-11 overflow-hidden rounded-[10px] object-cover" /></td>
                  <td><b>{p.name}</b>{p.bestseller && <span className="ml-2 text-[10px] font-extrabold uppercase text-gold-d">Bestseller</span>}<div className="text-xs muted">/{p.slug}</div></td>
                  <td>{catName(p.category)}</td>
                  <td className="text-xs">{p.variants.map((v) => <div key={v.key} className="whitespace-nowrap"><span className="muted">{sizeLabel(v.key)}</span> <b className="num">{money(v.price)}</b></div>)}</td>
                  <td><div className="flex flex-wrap gap-1">{[['eggless', 'EGG-FREE'], ['vegan', 'VEGAN'], ['glutenFree', 'GF']].map(([k, l]) => <span key={k} className={cn('rounded-md border-[1.5px] px-1.5 text-[10.5px] font-extrabold', p.dietary?.[k] ? 'border-[#C5DDBF] bg-ok-bg text-ok' : p.upgrades?.[k] ? 'border-line bg-gold-bg text-gold-d' : 'border-line text-[#9A8C84]')} title={p.upgrades?.[k] && !p.dietary?.[k] ? 'Available as upgrade' : undefined}>{l}{p.upgrades?.[k] && !p.dietary?.[k] ? '+' : ''}</span>)}</div></td>
                  <td><select className="sel !min-h-[34px] !text-[13px]" aria-label={`Stock status for ${p.name}`} value={p.stockStatus} onChange={(e) => quick(p, { stockStatus: e.target.value }, 'Stock status updated')}>{STOCK.map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td>{p.stockQty != null ? <span className={cn('font-bold num', p.stockQty <= p.lowStockThreshold && 'text-bad')}>{p.stockQty}</span> : <span className="text-xs muted">—</span>}</td>
                  <td><Switch on={p.available} label={`${p.name} available`} onChange={(v) => quick(p, { available: v }, v ? 'Now available to order' : 'Hidden from ordering')} /></td>
                  <td className="whitespace-nowrap">
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditing(p)}><Pencil size={13} /> Edit</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => setArchiveAsk(p)} aria-label={archived ? 'Restore' : 'Archive'}>{archived ? <RotateCcw size={13} /> : <Archive size={13} />}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs muted"><Badge cls="b-ok">GREEN</Badge> = made that way · <Badge cls="b-gold">GOLD +</Badge> = offered as a paid upgrade.</p>
      {editing && <ProductEditor key={editing._id || 'new'} product={editing} onClose={closeEditor} onSaved={() => { closeEditor(); reload({ silent: true }); }} />}
      <Confirm open={!!archiveAsk} title={archived ? `Restore ${archiveAsk?.name}?` : `Archive ${archiveAsk?.name}?`} confirmLabel={archived ? 'Restore' : 'Archive'} danger={!archived} onClose={() => setArchiveAsk(null)} onConfirm={doArchive}>
        {archived ? 'The product will return to the admin list. Turn on “On sale” to show it on the website.' : 'Archived products are removed from the website and admin lists. Past orders keep their details. You can restore it later.'}
      </Confirm>
    </>
  );
}
