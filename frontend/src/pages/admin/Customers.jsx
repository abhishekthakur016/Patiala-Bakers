import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Phone, Search } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, Drawer, EmptyState, ErrorState, Field, PageLoader, Pagination, Skeleton } from '../../components/ui.jsx';
import OrderDrawer from '../../components/admin/OrderDrawer.jsx';
import { fmtDate, fmtShort, money, t12 } from '../../utils/format.js';

function CustomerDrawer({ email, onClose }) {
  const [d, setD] = useState(null);
  const [notes, setNotes] = useState({ adminNotes: '', dietaryPref: '' });
  const [order, setOrder] = useState('');
  useEffect(() => { api.get(`/admin/customers/${encodeURIComponent(email)}`).then(({ data }) => { setD(data); setNotes({ adminNotes: data.customer.adminNotes, dietaryPref: data.customer.dietaryPref }); }).catch((e) => { toast.error(apiError(e).message); onClose(); }); }, [email]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => { try { await api.patch(`/admin/customers/${encodeURIComponent(email)}`, notes); toast.success('Saved'); } catch (e) { toast.error(apiError(e).message); } };
  const c = d?.customer;
  return (
    <>
      <Drawer open wide onClose={onClose} title={c?.name || 'Customer'}>
        {!d ? <PageLoader /> : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-3 text-sm"><a className="btn btn-o btn-sm" href={`tel:${c.phone}`}><Phone size={14} /> {c.phone || '—'}</a><a className="btn btn-o btn-sm" href={`mailto:${c.email}`}><Mail size={14} /> {c.email}</a>{c.registered ? <Badge cls="b-ok">Registered</Badge> : <Badge cls="b-mute">Guest</Badge>}</div>
            <div className="grid grid-cols-3 gap-2.5">{[[c.orderCount, 'orders'], [money(c.spend), 'lifetime spend'], [d.enquiries.length, 'enquiries']].map(([v, l]) => <div key={l} className="rounded-xl bg-cream p-3"><b className="block text-xl font-extrabold">{v}</b><span className="text-xs font-semibold muted">{l}</span></div>)}</div>
            {c.registered ? (
              <div className="flex flex-col gap-3">
                <Field label="Dietary preference" htmlFor="dp"><input id="dp" className="in in-sm" value={notes.dietaryPref} onChange={(e) => setNotes({ ...notes, dietaryPref: e.target.value })} /></Field>
                <Field label="Staff notes" htmlFor="an"><textarea id="an" className="in !min-h-[70px]" value={notes.adminNotes} onChange={(e) => setNotes({ ...notes, adminNotes: e.target.value })} /></Field>
                <button className="btn btn-o btn-sm self-start" onClick={save}>Save</button>
              </div>
            ) : <p className="infobox">Guest customer — notes can be saved once they create an account with this email.</p>}
            <section><h3 className="mb-2 text-sm font-extrabold">Orders</h3>
              {!d.orders.length ? <p className="text-sm muted">No orders.</p> : <div className="tblwrap"><table className="tbl"><thead><tr><th>Order</th><th>Pickup</th><th>Total</th><th>Status</th></tr></thead><tbody>{d.orders.map((o) => <tr key={o._id} className="click" onClick={() => setOrder(o._id)}><td className="font-bold text-wine">{o.orderNumber}</td><td>{fmtDate(o.pickupDate)} {t12(o.pickupTime)}</td><td className="num">{money(o.total)}</td><td><Badge>{o.status}</Badge></td></tr>)}</tbody></table></div>}
            </section>
            {d.enquiries.length > 0 && <section><h3 className="mb-2 text-sm font-extrabold">Custom cake enquiries</h3>{d.enquiries.map((e) => <div key={e._id} className="flex items-center gap-2 border-b border-line-2 py-2 text-sm"><b>{e.reference}</b><span className="flex-1">{e.occasion} · {fmtDate(e.requiredDate)}</span><Badge>{e.status}</Badge></div>)}</section>}
          </div>
        )}
      </Drawer>
      {order && <OrderDrawer id={order} onClose={() => setOrder('')} />}
    </>
  );
}

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const sort = params.get('sort') || '-spend';
  const { data, error, reload } = useFetch('/admin/customers', { q: q || undefined, page, sort, limit: 25 });
  const open = params.get('open');
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-[380px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden="true" /><label className="sr-only" htmlFor="cq">Search customers</label><input id="cq" className="in !min-h-[40px] !pl-10" placeholder="Name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <select className="sel" aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value)}><option value="-spend">Top spend</option><option value="-orders">Most orders</option><option value="-lastOrder">Recent pickup</option><option value="name">Name A–Z</option></select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Skeleton className="h-96" /> : !data.items.length ? <EmptyState title="No customers found" /> : (
        <>
          <div className="tblwrap"><table className="tbl min-w-[760px]"><thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Spend</th><th>Last pickup</th><th>Account</th></tr></thead>
            <tbody>{data.items.map((c) => (
              <tr key={c.email} className="click" tabIndex={0} onClick={() => set('open', c.email)} onKeyDown={(e) => e.key === 'Enter' && set('open', c.email)}>
                <td><b>{c.name}</b>{c.dietaryPref && <span className="ml-2 text-xs font-bold text-ok">{c.dietaryPref}</span>}{c.since && <div className="text-xs muted">Since {fmtShort(c.since)}</div>}</td>
                <td className="text-sm">{c.email}<div className="text-xs muted">{c.phone}</div></td><td className="num">{c.orders}</td><td className="num font-bold">{money(c.spend)}</td><td>{c.lastOrder ? fmtDate(c.lastOrder) : '—'}</td><td>{c.registered ? <Badge cls="b-ok">Registered</Badge> : <Badge cls="b-mute">Guest</Badge>}</td>
              </tr>
            ))}</tbody></table></div>
          <div className="flex items-center justify-between text-sm muted"><span>{data.total} customers</span><Pagination page={data.page} pages={data.pages} onPage={setPage} /></div>
        </>
      )}
      {open && <CustomerDrawer email={open} onClose={() => set('open', '')} />}
    </>
  );
}
