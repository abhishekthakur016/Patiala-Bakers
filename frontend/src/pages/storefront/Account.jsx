import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, LogOut, RotateCcw } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import OrderView from '../../components/OrderView.jsx';
import { Badge, EmptyState, ErrorState, Field, PageLoader, Pagination, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { fmtDate, fmtShort, money, t12 } from '../../utils/format.js';

function useReorder() {
  const { items, replace, setOpen } = useCart();
  return async (orderNumber) => {
    try {
      const { data } = await api.post(`/account/orders/${orderNumber}/reorder`);
      if (!data.items.length) { toast.error('None of the items in that order are available right now.'); return; }
      replace([...items, ...data.items]);
      toast.success(`Added ${data.items.length} item${data.items.length === 1 ? '' : 's'} to your cart${data.skipped.length ? ` · ${data.skipped.length} unavailable` : ''}`);
      setOpen(true);
    } catch (e) { toast.error(apiError(e).message); }
  };
}

function Orders() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reorder = useReorder();
  useEffect(() => { setData(null); api.get('/account/orders', { params: { page, limit: 10 } }).then(({ data: d }) => setData(d)).catch((e) => setError(apiError(e).message)); }, [page]);
  if (error) return <ErrorState message={error} />;
  if (!data) return <PageLoader />;
  if (!data.items.length) return <EmptyState title="No orders yet" action={<Link to="/shop" className="btn btn-p">Start an order</Link>}>Your orders will appear here.</EmptyState>;
  return (
    <>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Order</th><th>Pickup</th><th>Items</th><th>Total</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.orderNumber}>
                <td><Link to={`/account/orders/${o.orderNumber}`} className="font-extrabold">{o.orderNumber}</Link><div className="text-xs muted">{fmtShort(o.createdAt)}</div></td>
                <td>{fmtDate(o.pickupDate)} · {t12(o.pickupTime)}</td>
                <td className="max-w-[260px] truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</td>
                <td className="num font-bold">{money(o.total)}</td>
                <td><Badge>{o.status}</Badge></td>
                <td><button className="btn btn-o btn-xs" onClick={() => reorder(o.orderNumber)}><RotateCcw size={13} /> Reorder</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} pages={data.pages} onPage={setPage} />
    </>
  );
}

function OrderDetail() {
  const { orderNumber } = useParams();
  const { settings } = useSettings();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const reorder = useReorder();
  useEffect(() => { api.get(`/account/orders/${orderNumber}`).then(({ data }) => setOrder(data.order)).catch((e) => setError(apiError(e).message)); }, [orderNumber]);
  if (error) return <ErrorState message={error} />;
  if (!order) return <PageLoader />;
  return (
    <div className="card card-b">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/account" className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> All orders</Link>
        <h2 className="flex-1 font-sans text-xl font-extrabold">{order.orderNumber}</h2>
        <button className="btn btn-o btn-sm" onClick={() => reorder(order.orderNumber)}><RotateCcw size={14} /> Order again</button>
      </div>
      <OrderView order={order} address={settings?.business?.address} />
    </div>
  );
}

function Enquiries() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/account/enquiries').then(({ data }) => setItems(data.items)).catch(() => setItems([])); }, []);
  if (!items) return <PageLoader />;
  if (!items.length) return <EmptyState title="No custom cake enquiries" action={<Link to="/custom-cakes" className="btn btn-p">Start an enquiry</Link>} />;
  return (
    <div className="tblwrap"><table className="tbl"><thead><tr><th>Reference</th><th>Occasion</th><th>Date needed</th><th>Quote</th><th>Status</th></tr></thead>
      <tbody>{items.map((e) => <tr key={e.reference}><td className="font-extrabold">{e.reference}</td><td>{e.occasion} · {e.servings} serves</td><td>{fmtDate(e.requiredDate)}</td><td>{e.quote?.total ? money(e.quote.total) : '—'}</td><td><Badge>{e.status}</Badge>{e.orderNumber && <Link className="ml-2 text-sm" to={`/account/orders/${e.orderNumber}`}>{e.orderNumber}</Link>}</td></tr>)}</tbody>
    </table></div>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const p = useForm({ defaultValues: { name: user.name, phone: user.phone || '', dietaryPref: user.dietaryPref || '' } });
  const pw = useForm({ defaultValues: { currentPassword: '', newPassword: '' } });
  const save = p.handleSubmit(async (v) => {
    try { const { data } = await api.patch('/account/profile', v); setUser(data.user); toast.success('Profile saved'); } catch (e) { toast.error(apiError(e).message); }
  });
  const change = pw.handleSubmit(async (v) => {
    if (v.newPassword.length < 8) { pw.setError('newPassword', { message: 'Use at least 8 characters' }); return; }
    try { await api.post('/account/password', v); pw.reset(); toast.success('Password updated'); } catch (e) { const ae = apiError(e); Object.entries(ae.fields).forEach(([k, m]) => pw.setError(k, { message: m })); toast.error(ae.message); }
  });
  return (
    <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
      <form className="card card-b flex flex-col gap-4" onSubmit={save}>
        <h2 className="font-sans text-lg font-extrabold">Profile</h2>
        <Field label="Email"><input className="in" value={user.email} disabled /></Field>
        <Field label="Name" htmlFor="pn"><input id="pn" className="in" {...p.register('name', { required: true, minLength: 2 })} /></Field>
        <Field label="Mobile" htmlFor="pp"><input id="pp" className="in" {...p.register('phone')} /></Field>
        <Field label="Dietary preference" htmlFor="pd" help="Shown to our team when you order."><select id="pd" className="in" {...p.register('dietaryPref')}><option value="">None</option><option>Eggless</option><option>Vegan</option><option>Gluten-free</option><option>Nut-free</option></select></Field>
        <button className="btn btn-p self-start" disabled={p.formState.isSubmitting}>{p.formState.isSubmitting && <Spinner />} Save</button>
      </form>
      <form className="card card-b flex flex-col gap-4" onSubmit={change}>
        <h2 className="font-sans text-lg font-extrabold">Change password</h2>
        <Field label="Current password" htmlFor="cp" error={pw.formState.errors.currentPassword?.message}><input id="cp" type="password" autoComplete="current-password" className="in" {...pw.register('currentPassword', { required: 'Required' })} /></Field>
        <Field label="New password" htmlFor="np" error={pw.formState.errors.newPassword?.message}><input id="np" type="password" autoComplete="new-password" className="in" {...pw.register('newPassword')} /></Field>
        <button className="btn btn-o self-start" disabled={pw.formState.isSubmitting}>Update password</button>
      </form>
    </div>
  );
}

export default function Account() {
  const { user, logout, isStaff } = useAuth();
  const nav = useNavigate();
  const tab = ({ isActive }) => `tab ${isActive ? 'on' : ''}`;
  return (
    <>
      <div className="pagehead"><div className="wrap flex flex-wrap items-end gap-4"><div className="flex-1"><p className="eyebrow">My account</p><h1>Hi, {user.name.split(' ')[0]}</h1></div>
        {isStaff && <Link to="/admin" className="btn btn-p">Open admin</Link>}
        <button className="btn btn-o" onClick={async () => { await logout(); nav('/'); }}><LogOut size={16} /> Sign out</button></div></div>
      <div className="wrap py-8">
        <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Account sections"><NavLink end to="/account" className={tab}>Orders</NavLink><NavLink to="/account/enquiries" className={tab}>Custom cake enquiries</NavLink><NavLink to="/account/profile" className={tab}>Profile</NavLink></nav>
        <Routes>
          <Route index element={<Orders />} />
          <Route path="orders/:orderNumber" element={<OrderDetail />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="profile" element={<Profile />} />
        </Routes>
      </div>
    </>
  );
}
