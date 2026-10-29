import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Flag, Printer } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { Badge, Confirm, Drawer, Field, PageLoader, Spinner } from '../ui.jsx';
import ProductImage from '../ProductImage.jsx';
import { lineSummary } from '../CartDrawer.jsx';
import { cn, fmtLong, fmtStamp, money, sizeLabel, t12 } from '../../utils/format.js';

const FLOW = ['Confirmed', 'In Production', 'Ready', 'Collected'];
const NEXT = { Pending: 'Confirmed', Confirmed: 'In Production', 'In Production': 'Ready', Ready: 'Collected' };
const PAY_METHODS = [['cash', 'Cash'], ['card_in_store', 'Card in store'], ['bank_transfer', 'Bank transfer']];

export function ProductionTicket({ order }) {
  return (
    <div className="mx-auto flex max-w-[794px] flex-col gap-4 border border-[#E7DED3] bg-white p-8 text-[13.5px] text-[#1E1416]">
      <div className="flex items-start gap-4 border-b-[3px] border-[#1E1416] pb-3.5">
        <div className="flex-1"><h2 className="font-sans text-3xl font-extrabold">{order.orderNumber}</h2><p>{order.customer.name} · {order.customer.phone}</p></div>
        <div className="text-right"><b className="block text-lg">{fmtLong(order.pickupDate)}</b><b className="text-2xl">{t12(order.pickupTime)}</b>{order.priority === 'High' && <span className="ml-2 rounded-md bg-[#1E1416] px-3 py-1.5 text-[13px] font-extrabold text-white">PRIORITY</span>}</div>
      </div>
      {order.items.map((i, k) => (
        <div key={k} className="grid gap-4 border-b border-dashed border-[#D5CCC2] pb-4 [grid-template-columns:110px_1fr]">
          <ProductImage src={i.image} name={i.name} category={i.category} className="h-[110px] w-[110px] overflow-hidden rounded-lg border object-cover" />
          <div>
            <b className="text-lg">{i.qty} × {i.name} — {sizeLabel(i.variant)}</b>
            <div className="mt-2 grid overflow-hidden rounded-md border-[1.5px] border-[#1E1416] [grid-template-columns:120px_1fr]">
              {[['Sponge', i.options?.sponge], ['Filling', i.options?.filling], ['Finish', i.options?.finish], ['Dietary', i.diet?.join(', ')], ['Add-ons', i.options?.addons?.join(', ')], ['Instructions', i.options?.instructions]].filter(([, v]) => v).map(([k2, v]) => (
                <div key={k2} className="contents"><div className="border-b border-[#D5CCC2] bg-[#F4EFE8] px-3 py-1.5 text-[11.5px] font-extrabold uppercase tracking-wider">{k2}</div><div className="border-b border-[#D5CCC2] px-3 py-1.5">{v}</div></div>
              ))}
            </div>
            {i.options?.message && <div className="mt-3 rounded-lg border-2 border-dashed border-[#1E1416] p-3 text-center font-serif text-xl font-bold">“{i.options.message}”</div>}
          </div>
        </div>
      ))}
      {order.notes && <p><b>Customer notes:</b> {order.notes}</p>}
      {order.internalNotes && <p><b>Internal:</b> {order.internalNotes}</p>}
      <div className="mt-2 flex gap-3.5 border-t border-[#D5CCC2] pt-3 text-[11.5px] text-[#6A5D58]"><span>Baker: {order.baker || '________'}</span><span>Boxed ☐</span><span>Checked ☐</span><span className="flex-1 text-right">{order.paymentStatus} · {money(order.total)}</span></div>
    </div>
  );
}

export default function OrderDrawer({ id, onClose, onChanged, bakers = [] }) {
  const [o, setO] = useState(null);
  const [busy, setBusy] = useState('');
  const [cancelAsk, setCancelAsk] = useState(false);
  const [pay, setPay] = useState({ amount: '', method: 'cash', reference: '' });
  const [notes, setNotes] = useState('');
  const [resched, setResched] = useState(null);
  const [ticket, setTicket] = useState(false);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (!id) return;
    setO(null);
    api.get(`/admin/orders/${id}`).then(({ data }) => { setO(data.order); setNotes(data.order.internalNotes || ''); }).catch((e) => { toast.error(apiError(e).message); onClose(); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key, fn, msg) => {
    setBusy(key);
    try { const { data } = await fn(); setO(data.order); onChanged?.(data.order); if (msg) toast.success(msg); return true; } catch (e) { toast.error(apiError(e).message); return false; } finally { setBusy(''); }
  };
  const setStatus = (status) => run('status', () => api.post(`/admin/orders/${id}/status`, { status, notify }), `Marked ${status}`);
  const patch = (body, msg) => run('patch', () => api.patch(`/admin/orders/${id}`, body), msg);

  if (!id) return null;
  const balance = o ? Math.max(0, o.total - o.amountPaid) : 0;

  return (
    <>
      <Drawer open wide onClose={onClose} title={o ? <span>{o.orderNumber} <Badge>{o.status}</Badge></span> : 'Order'}
        headerExtra={o && <button className="btn btn-o btn-sm" onClick={() => setTicket(true)}><Printer size={15} /> Ticket</button>}
        footer={o && !['Collected', 'Cancelled'].includes(o.status) && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="check !min-h-0 text-xs"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email customer on Ready / Cancel</label>
            <span className="flex-1" />
            <button className="btn btn-o btn-sm !text-bad" onClick={() => setCancelAsk(true)}>Cancel order</button>
            {NEXT[o.status] && <button className="btn btn-p" disabled={!!busy} onClick={() => setStatus(NEXT[o.status])}>{busy === 'status' && <Spinner />} Mark {NEXT[o.status] === 'In Production' ? 'In Production' : NEXT[o.status]}</button>}
          </div>
        )}>
        {!o ? <PageLoader /> : (
          <div className="flex flex-col gap-6">
            {o.status !== 'Cancelled' && o.status !== 'Pending' && (
              <div className="grid grid-cols-4 gap-1.5">{FLOW.map((s, i) => <button key={s} className={cn('dstep', FLOW.indexOf(o.status) > i && 'done', o.status === s && 'on')} onClick={() => s !== o.status && setStatus(s)} disabled={!!busy} title={`Set ${s}`}>{s}</button>)}</div>
            )}
            {o.status === 'Pending' && <div className="goldbox flex-wrap">Awaiting {o.depositDue ? `deposit of ${money(o.depositDue)}` : 'payment'}. Record a payment below or confirm manually.<button className="btn btn-p btn-sm" onClick={() => setStatus('Confirmed')}>Confirm now</button></div>}
            {o.status === 'Cancelled' && <div className="errbox flex items-center gap-3">This order is cancelled.<button className="btn btn-o btn-xs ml-auto" onClick={() => setStatus('Confirmed')}>Reinstate</button></div>}

            <section className="grid gap-x-3.5 gap-y-2 text-sm [grid-template-columns:120px_1fr]">
              <span className="font-semibold muted">Customer</span><span><b>{o.customer.name}</b><br /><a href={`tel:${o.customer.phone}`}>{o.customer.phone}</a> · <a href={`mailto:${o.customer.email}`}>{o.customer.email}</a></span>
              <span className="font-semibold muted">Pickup</span>
              <span>
                {resched ? (
                  <span className="flex flex-wrap gap-2"><input type="date" className="in in-sm !w-auto" value={resched.date} onChange={(e) => setResched({ ...resched, date: e.target.value })} /><input type="time" step="1800" className="in in-sm !w-auto" value={resched.time} onChange={(e) => setResched({ ...resched, time: e.target.value })} />
                    <button className="btn btn-p btn-xs" onClick={async () => { if (await patch({ pickupDate: resched.date, pickupTime: resched.time }, 'Pickup moved')) setResched(null); }}>Save</button><button className="btn btn-ghost btn-xs" onClick={() => setResched(null)}>Cancel</button></span>
                ) : <><b>{fmtLong(o.pickupDate)}</b> at <b>{t12(o.pickupTime)}</b> <button className="btn btn-ghost btn-xs" onClick={() => setResched({ date: o.pickupDate, time: o.pickupTime })}>Reschedule</button></>}
              </span>
              <span className="font-semibold muted">Source</span><span>{o.source}{o.enquiryRef ? ` · from ${o.enquiryRef}` : ''} · placed {fmtStamp(o.createdAt)}</span>
              <span className="font-semibold muted">Priority</span><span><button className={cn('btn btn-xs', o.priority === 'High' ? 'btn-danger' : 'btn-o')} onClick={() => patch({ priority: o.priority === 'High' ? 'Normal' : 'High' }, 'Priority updated')}><Flag size={13} /> {o.priority}</button></span>
              <span className="font-semibold muted">Baker</span>
              <span><select className="sel !min-h-[34px]" value={o.baker || ''} onChange={(e) => patch({ baker: e.target.value }, 'Baker assigned')}><option value="">Unassigned</option>{bakers.map((b) => <option key={b}>{b}</option>)}</select></span>
              {o.notes && <><span className="font-semibold muted">Customer notes</span><span className="rounded-lg bg-gold-bg px-3 py-2">{o.notes}</span></>}
            </section>

            <section>
              <h4 className="mb-2.5 text-sm font-extrabold">Items</h4>
              <div className="flex flex-col gap-2.5">
                {o.items.map((i, k) => (
                  <div key={k} className="flex gap-3.5 rounded-[14px] border border-line-2 bg-white p-3.5">
                    <ProductImage src={i.image} name={i.name} category={i.category} className="h-[72px] w-[72px] flex-none overflow-hidden rounded-xl object-cover" />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex gap-2"><b className="flex-1">{i.qty} × {i.name} · {sizeLabel(i.variant)}</b><b className="num">{money(i.lineTotal)}</b></div>
                      {lineSummary(i.options) && <p className="text-xs muted">{lineSummary(i.options)}</p>}
                      {i.options?.message && <p className="mt-1 text-xs">Message: <b>“{i.options.message}”</b></p>}
                      {i.options?.instructions && <p className="mt-1 text-xs">Instructions: {i.options.instructions}</p>}
                      {i.diet?.length > 0 && <p className="text-xs font-bold text-ok">{i.diet.join(' · ')}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3"><div className="sumline"><span>Subtotal</span><span className="num">{money(o.subtotal)}</span></div>{o.fees > 0 && <div className="sumline"><span>Fees</span><span className="num">{money(o.fees)}</span></div>}<div className="sumline tot"><span>Total</span><span className="num">{money(o.total)}</span></div></div>
            </section>

            <section className="rounded-[14px] border border-line-2 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2"><h4 className="flex-1 text-sm font-extrabold">Payments</h4><Badge>{o.paymentStatus}</Badge><span className="text-sm">Paid <b className="num">{money(o.amountPaid)}</b> · Due <b className="num">{money(balance)}</b></span></div>
              {o.payments?.length > 0 && <ul className="mt-2 text-xs muted">{o.payments.map((p) => <li key={p._id}>{fmtStamp(p.at)} · {money(p.amount)} · {p.method?.replace(/_/g, ' ')}{p.reference ? ` · ${p.reference}` : ''}{p.by ? ` · ${p.by}` : ''}</li>)}</ul>}
              {balance > 0 && o.status !== 'Cancelled' && (
                <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run('pay', () => api.post(`/admin/orders/${id}/payments`, { ...pay, amount: Number(pay.amount) }), 'Payment recorded')) setPay({ amount: '', method: 'cash', reference: '' }); }}>
                  <Field label="Amount" htmlFor="pa" className="w-28"><input id="pa" type="number" step="0.01" min="0.01" max={balance} required className="in in-sm" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={balance.toFixed(2)} /></Field>
                  <Field label="Method" htmlFor="pm"><select id="pm" className="in in-sm" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                  <Field label="Reference" htmlFor="pr" className="flex-1"><input id="pr" className="in in-sm" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
                  <button type="button" className="btn btn-o btn-sm" onClick={() => setPay({ ...pay, amount: balance.toFixed(2) })}>Full balance</button>
                  <button className="btn btn-p btn-sm" disabled={busy === 'pay'}>{busy === 'pay' && <Spinner />} Record</button>
                </form>
              )}
              {o.amountPaid > 0 && o.paymentStatus !== 'Refunded' && o.status === 'Cancelled' && <button className="btn btn-o btn-sm mt-3" onClick={() => run('refund', () => api.post(`/admin/orders/${id}/refund`, {}), 'Marked as refunded')}>Mark refunded</button>}
            </section>

            <section>
              <Field label="Internal notes (staff only)" htmlFor="in"><textarea id="in" className="in !min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
              <button className="btn btn-o btn-sm mt-2" disabled={notes === (o.internalNotes || '')} onClick={() => patch({ internalNotes: notes }, 'Notes saved')}>Save notes</button>
            </section>

            <section>
              <h4 className="mb-3 text-sm font-extrabold">Status history</h4>
              <div className="hist">{[...o.history].reverse().map((h, k) => <div key={k} className="h">{h.text}<span className="block text-[11.5px] muted">{fmtStamp(h.at)}{h.by ? ` · ${h.by}` : ''}</span></div>)}</div>
            </section>
          </div>
        )}
      </Drawer>
      <Confirm open={cancelAsk} title={`Cancel ${o?.orderNumber}?`} danger confirmLabel="Cancel order" busy={busy === 'status'} onClose={() => setCancelAsk(false)}
        onConfirm={async () => { await setStatus('Cancelled'); setCancelAsk(false); }}>
        The pickup slot and any tracked stock will be released.{o?.amountPaid > 0 && ` ${money(o.amountPaid)} has been paid — remember to refund it.`}
      </Confirm>
      {ticket && o && (
        <div className="modal print:static print:p-0" role="dialog" aria-modal="true" aria-label="Production ticket">
          <div className="scrim no-print" onClick={() => setTicket(false)} />
          <div className="mbox w print:shadow-none">
            <div className="mh no-print"><h3 className="flex-1">Production ticket</h3><button className="btn btn-p btn-sm" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="btn btn-o btn-sm" onClick={() => setTicket(false)}>Close</button></div>
            <div className="mb"><ProductionTicket order={o} /></div>
          </div>
        </div>
      )}
    </>
  );
}
