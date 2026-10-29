import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { Field, Modal, Spinner } from '../ui.jsx';
import { money, sizeLabel, t12, todayISO, uid } from '../../utils/format.js';

// Phone / in-store order entry. Prices are calculated by the server; lead times are not enforced for staff.
export default function ManualOrderModal({ open, onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [lines, setLines] = useState([]);
  const [pick, setPick] = useState({ productId: '', variant: '', qty: 1, message: '' });
  const [cust, setCust] = useState({ name: '', email: '', phone: '' });
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [time, setTime] = useState('');
  const [source, setSource] = useState('Phone');
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (open) api.get('/admin/products').then(({ data }) => setProducts(data.items.filter((p) => p.orderable))).catch(() => {}); }, [open]);
  useEffect(() => { if (open && date) api.get('/availability', { params: { date } }).then(({ data }) => setSlots(data.slots)).catch(() => setSlots([])); }, [open, date]);
  useEffect(() => {
    if (!lines.length) { setQuote(null); return; }
    api.post('/cart/quote', { items: lines }).then(({ data }) => setQuote(data)).catch(() => {});
  }, [lines]);

  const prod = useMemo(() => products.find((p) => p._id === pick.productId), [products, pick.productId]);
  const addLine = () => {
    if (!prod || !pick.variant) return;
    const options = prod.customisable ? { ...prod.defaults, message: pick.message, addons: [] } : {};
    setLines([...lines, { id: uid(), productId: prod._id, variant: pick.variant, qty: Number(pick.qty) || 1, options }]);
    setPick({ productId: '', variant: '', qty: 1, message: '' });
  };

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const { data } = await api.post('/admin/orders', { items: lines, customer: cust, pickupDate: date, pickupTime: time, notes, source, paymentStatus: paid ? 'Paid' : 'Unpaid' });
      toast.success(`Order ${data.order.orderNumber} created`);
      setLines([]); setCust({ name: '', email: '', phone: '' }); setNotes(''); setTime(''); setPaid(false);
      onCreated?.(data.order);
    } catch (e) { const ae = apiError(e); setErr(ae.issues?.[0]?.message || Object.values(ae.fields)[0] || ae.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="New phone / in-store order" footer={<>
      <span className="mr-auto self-center text-sm">Total <b className="num">{quote ? money(quote.total) : '—'}</b></span>
      <button className="btn btn-o" onClick={onClose}>Cancel</button>
      <button className="btn btn-p" disabled={busy || !lines.length || !time || !cust.name || !cust.phone || !cust.email || quote?.issues?.length > 0} onClick={submit}>{busy && <Spinner />} Create order</button>
    </>}>
      <div className="flex flex-col gap-5">
        {err && <p className="errbox">{err}</p>}
        <div className="grid gap-3 [grid-template-columns:2fr_1fr_80px_auto]">
          <Field label="Product" htmlFor="mp"><select id="mp" className="in" value={pick.productId} onChange={(e) => { const p = products.find((x) => x._id === e.target.value); setPick({ ...pick, productId: e.target.value, variant: p?.variants[0]?.key || '' }); }}><option value="">Choose…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
          <Field label="Option" htmlFor="mv"><select id="mv" className="in" value={pick.variant} onChange={(e) => setPick({ ...pick, variant: e.target.value })} disabled={!prod}>{prod?.variants.map((v) => <option key={v.key} value={v.key}>{sizeLabel(v.key)} · {money(v.price)}</option>)}</select></Field>
          <Field label="Qty" htmlFor="mq"><input id="mq" type="number" min="1" max="50" className="in" value={pick.qty} onChange={(e) => setPick({ ...pick, qty: e.target.value })} /></Field>
          <div className="flex items-end"><button className="btn btn-o" onClick={addLine} disabled={!prod}>Add</button></div>
          {prod?.customisable && <Field label="Cake message" htmlFor="mm" className="col-span-full"><input id="mm" className="in" maxLength={40} value={pick.message} onChange={(e) => setPick({ ...pick, message: e.target.value })} /></Field>}
        </div>
        {lines.length > 0 && (
          <div className="rounded-xl border border-line-2 bg-white px-4">
            {lines.map((l) => { const q = quote?.lines.find((x) => x.id === l.id); const iss = quote?.issues.find((x) => x.id === l.id); return (
              <div key={l.id} className="flex items-center gap-3 border-b border-line-2 py-2.5 text-sm last:border-0"><span className="flex-1">{l.qty} × {q?.name || '…'} · {sizeLabel(l.variant)}{l.options?.message ? ` · “${l.options.message}”` : ''}{iss && <span className="ml-2 font-bold text-bad">{iss.message}</span>}</span><b className="num">{q ? money(q.lineTotal) : ''}</b><button className="iconbtn !h-8 !w-8" aria-label="Remove line" onClick={() => setLines(lines.filter((x) => x !== l))}><Trash2 size={15} /></button></div>
            ); })}
          </div>
        )}
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
          <Field label="Customer name" htmlFor="cn"><input id="cn" className="in" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></Field>
          <Field label="Phone" htmlFor="cp"><input id="cp" className="in" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></Field>
          <Field label="Email" htmlFor="ce"><input id="ce" type="email" className="in" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} /></Field>
          <Field label="Pickup date" htmlFor="pd"><input id="pd" type="date" min={todayISO()} className="in" value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} /></Field>
          <Field label="Pickup time" htmlFor="pt"><select id="pt" className="in" value={time} onChange={(e) => setTime(e.target.value)}><option value="">{slots.length ? 'Choose…' : 'Closed this day'}</option>{slots.map((s) => <option key={s.time} value={s.time} disabled={s.reason === 'Full' || s.reason === 'Closed'}>{t12(s.time)} · {s.remaining} left{s.reason && s.reason !== 'Not enough notice' ? ` (${s.reason})` : ''}</option>)}</select></Field>
          <Field label="Source" htmlFor="src"><select id="src" className="in" value={source} onChange={(e) => setSource(e.target.value)}><option>Phone</option><option>In store</option></select></Field>
        </div>
        <Field label="Notes" htmlFor="nt"><textarea id="nt" className="in !min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Customer has paid in full (card in store)</label>
      </div>
    </Modal>
  );
}
