import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Plus, Search } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, EmptyState, ErrorState, Pagination, Skeleton } from '../../components/ui.jsx';
import OrderDrawer from '../../components/admin/OrderDrawer.jsx';
import ManualOrderModal from '../../components/admin/ManualOrderModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn, downloadText, fmtDate, fmtStamp, money, relDay, sizeLabel, t12 } from '../../utils/format.js';
import toast from 'react-hot-toast';

const STATUS_TABS = ['all', 'active', 'Pending', 'Confirmed', 'In Production', 'Ready', 'Collected', 'Cancelled'];

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const get = (k, d = '') => params.get(k) || d;
  const [q, setQ] = useState(get('q'));
  const query = { q: get('q') || undefined, status: get('status', 'all'), payment: get('payment', 'all'), priority: get('priority', 'all'), date: get('date', 'all'), time: get('time') || undefined, sort: get('sort', '-created'), page: get('page', '1'), limit: 20 };
  const { data, error, reload, loading } = useFetch('/admin/orders', query);
  const [bakers, setBakers] = useState([]);
  useEffect(() => { api.get('/admin/settings').then(({ data: d }) => setBakers(d.settings.bakers || [])).catch(() => {}); }, []);

  const set = (k, v) => { const n = new URLSearchParams(params); if (!v || v === 'all') n.delete(k); else n.set(k, v); if (k !== 'page' && k !== 'open') n.delete('page'); setParams(n, { replace: true }); };
  useEffect(() => { const t = setTimeout(() => { if (q !== get('q')) set('q', q.trim()); }, 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = async () => {
    try { const { data: csv } = await api.get('/admin/orders/export.csv', { responseType: 'text' }); downloadText(`orders-${new Date().toISOString().slice(0, 10)}.csv`, csv); } catch (e) { toast.error(apiError(e).message); }
  };

  const counts = data?.statusCounts || {};
  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
        {STATUS_TABS.map((s) => (
          <button key={s} role="tab" aria-selected={get('status', 'all') === s} className={cn('tab', get('status', 'all') === s && 'on')} onClick={() => set('status', s)}>
            {s === 'all' ? 'All' : s === 'active' ? 'Active' : s}{counts[s] != null && <span className="cnt">{counts[s]}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-[420px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden="true" /><label className="sr-only" htmlFor="oq">Search orders</label><input id="oq" className="in !min-h-[40px] !pl-10" placeholder="Order #, name, phone, email, product" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="sr-only" htmlFor="od">Pickup date</label>
        <select id="od" className="sel" value={get('date', 'all')} onChange={(e) => set('date', e.target.value)}>
          <option value="all">Any pickup date</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">Next 7 days</option><option value="upcoming">Upcoming</option><option value="past">Past</option>
          {/^\d{4}/.test(get('date')) && <option value={get('date')}>{fmtDate(get('date'))}</option>}
        </select>
        <input type="date" className="sel" aria-label="Specific pickup date" value={/^\d{4}/.test(get('date')) ? get('date') : ''} onChange={(e) => set('date', e.target.value)} />
        <label className="sr-only" htmlFor="ot">Pickup time</label>
        <select id="ot" className="sel" value={get('time')} onChange={(e) => set('time', e.target.value)}><option value="">Any time</option>{['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((t) => <option key={t} value={t}>{t12(t)}</option>)}</select>
        <label className="sr-only" htmlFor="op">Payment</label>
        <select id="op" className="sel" value={get('payment', 'all')} onChange={(e) => set('payment', e.target.value)}><option value="all">Any payment</option><option value="outstanding">Outstanding</option><option>Unpaid</option><option>Deposit paid</option><option>Paid</option><option>Refunded</option></select>
        <label className="sr-only" htmlFor="opr">Priority</label>
        <select id="opr" className="sel" value={get('priority', 'all')} onChange={(e) => set('priority', e.target.value)}><option value="all">Any priority</option><option>High</option><option>Normal</option></select>
        <label className="sr-only" htmlFor="os">Sort</label>
        <select id="os" className="sel" value={get('sort', '-created')} onChange={(e) => set('sort', e.target.value)}><option value="-created">Newest first</option><option value="pickup">Pickup soonest</option><option value="-pickup">Pickup latest</option><option value="-total">Highest total</option></select>
        <span className="flex-1" />
        {can('reports') && <button className="btn btn-o btn-sm" onClick={exportCsv}><Download size={15} /> CSV</button>}
        <button className="btn btn-p btn-sm" onClick={() => set('new', '1')}><Plus size={15} /> New order</button>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Skeleton className="h-96" /> : !data.items.length ? <EmptyState title="No orders match these filters" action={<button className="btn btn-o" onClick={() => { setQ(''); setParams({}); }}>Clear filters</button>} /> : (
        <>
          <div className={cn('tblwrap transition-opacity', loading && 'opacity-60')}>
            <table className="tbl min-w-[980px]">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Pickup</th><th>Total</th><th>Payment</th><th>Priority</th><th>Status</th></tr></thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o._id} className="click" tabIndex={0} onClick={() => set('open', o._id)} onKeyDown={(e) => e.key === 'Enter' && set('open', o._id)}>
                    <td><b className="text-wine">{o.orderNumber}</b><div className="text-xs muted">{fmtStamp(o.createdAt)} · {o.source}</div></td>
                    <td><b>{o.customer.name}</b><div className="text-xs muted">{o.customer.phone}</div></td>
                    <td className="max-w-[260px]"><span className="block truncate">{o.items.map((i) => `${i.qty}× ${i.name} ${sizeLabel(i.variant)}`).join(', ')}</span></td>
                    <td className="whitespace-nowrap"><b>{relDay(o.pickupDate)}</b> · {t12(o.pickupTime)}</td>
                    <td className="num font-bold">{money(o.total)}</td>
                    <td><Badge>{o.paymentStatus}</Badge></td>
                    <td>{o.priority === 'High' ? <Badge>High</Badge> : <span className="text-xs muted">Normal</span>}</td>
                    <td><Badge>{o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm muted"><span>{data.total} orders</span><Pagination page={data.page} pages={data.pages} onPage={(p) => set('page', String(p))} /></div>
        </>
      )}
      {get('open') && <OrderDrawer id={get('open')} bakers={bakers} onClose={() => set('open', '')} onChanged={() => reload({ silent: true })} />}
      <ManualOrderModal open={get('new') === '1'} onClose={() => set('new', '')} onCreated={(o) => { reload({ silent: true }); const n = new URLSearchParams(params); n.delete('new'); n.set('open', o._id); setParams(n); }} />
    </>
  );
}
