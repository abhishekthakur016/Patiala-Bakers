import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Trash2 } from 'lucide-react';
import { api, apiError, assetUrl } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, EmptyState, ErrorState, Field, Modal, PageLoader, Skeleton, Spinner } from '../../components/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { cn, fmtDate, fmtLong, fmtStamp, money, t12 } from '../../utils/format.js';

const TABS = ['all', 'New', 'Quoted', 'Awaiting Payment', 'Confirmed', 'Converted', 'Declined'];

function Detail({ id, onChanged }) {
  const { settings } = useSettings();
  const [e, setE] = useState(null);
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState(null);
  const [convert, setConvert] = useState(null);
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState('');

  useEffect(() => { setE(null); setQuote(null); api.get(`/admin/enquiries/${id}`).then(({ data }) => setE(data.enquiry)).catch((er) => toast.error(apiError(er).message)); }, [id]);
  useEffect(() => { if (convert?.pickupDate) api.get('/availability', { params: { date: convert.pickupDate } }).then(({ data }) => setSlots(data.slots)).catch(() => setSlots([])); }, [convert?.pickupDate]);
  if (!e) return <PageLoader />;

  const run = async (key, fn, msg) => {
    setBusy(key);
    try { const { data } = await fn(); setE(data.enquiry); onChanged(); if (msg) toast.success(msg); return data; } catch (er) { toast.error(apiError(er).message); return null; } finally { setBusy(''); }
  };
  const qTotal = quote ? quote.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0;
  const locked = e.status === 'Converted';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1"><h2 className="font-sans text-xl font-extrabold">{e.reference} · {e.occasion}</h2><p className="text-sm muted">Received {fmtStamp(e.createdAt)}</p></div>
        <Badge>{e.status}</Badge>
        {!locked && <select className="sel" aria-label="Change status" value={e.status} onChange={(ev) => run('status', () => api.patch(`/admin/enquiries/${id}`, { status: ev.target.value }), 'Status updated')}>{TABS.slice(1).filter((s) => s !== 'Converted').map((s) => <option key={s}>{s}</option>)}</select>}
      </div>
      <div className="grid gap-x-3.5 gap-y-2 text-sm [grid-template-columns:120px_1fr]">
        <span className="font-semibold muted">Customer</span><span><b>{e.name}</b> · <a href={`tel:${e.phone}`}>{e.phone}</a> · <a href={`mailto:${e.email}`}>{e.email}</a></span>
        <span className="font-semibold muted">Needed</span><span><b>{fmtLong(e.requiredDate)}</b></span>
        <span className="font-semibold muted">Size</span><span>{e.size || '—'} · {e.servings} serves{e.budget ? ` · budget ${e.budget}` : ''}</span>
        <span className="font-semibold muted">Dietary</span><span>{e.diet?.length ? e.diet.join(', ') : '—'}</span>
        {e.orderNumber && <><span className="font-semibold muted">Order</span><span><Link to={`/admin/orders?q=${e.orderNumber}`} className="font-bold">{e.orderNumber}</Link></span></>}
      </div>
      <p className="whitespace-pre-wrap rounded-xl bg-cream p-4 text-[14.5px]">{e.description}</p>
      {e.referenceImages?.length > 0 && <div className="flex flex-wrap gap-2.5">{e.referenceImages.map((im) => <a key={im.url} href={assetUrl(im.url)} target="_blank" rel="noreferrer"><img src={assetUrl(im.url)} alt="Customer reference" className="h-28 w-28 rounded-xl border border-line object-cover" /></a>)}</div>}

      <section className="rounded-[14px] border border-line-2 bg-white p-4">
        <div className="flex items-center gap-2"><h3 className="flex-1 text-sm font-extrabold">Quote</h3>
          {!locked && !quote && <button className="btn btn-o btn-sm" onClick={() => setQuote({ lines: e.quote?.lines?.length ? e.quote.lines.map((l) => ({ ...l })) : [{ label: `${e.size || ''} ${e.occasion} cake`.trim(), amount: '' }], depositPercent: e.quote?.depositPercent ?? settings?.payments?.depositPercent ?? 50, note: e.quote?.note || 'Quote valid for 7 days.' })}>{e.quote?.lines?.length ? 'Edit quote' : 'Create quote'}</button>}
        </div>
        {quote ? (
          <div className="mt-3 flex flex-col gap-2">
            {quote.lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input className="in in-sm flex-1" aria-label="Line description" value={l.label} onChange={(ev) => setQuote({ ...quote, lines: quote.lines.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
                <input className="in in-sm !w-28" type="number" min="0" step="0.01" aria-label="Amount" value={l.amount} onChange={(ev) => setQuote({ ...quote, lines: quote.lines.map((x, j) => (j === i ? { ...x, amount: ev.target.value } : x)) })} />
                <button className="iconbtn !h-9 !w-9" aria-label="Remove line" onClick={() => setQuote({ ...quote, lines: quote.lines.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
              </div>
            ))}
            <button className="btn btn-ghost btn-xs self-start" onClick={() => setQuote({ ...quote, lines: [...quote.lines, { label: '', amount: '' }] })}><Plus size={13} /> Add line</button>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Deposit %" htmlFor="qd" className="w-24"><input id="qd" type="number" min="0" max="100" className="in in-sm" value={quote.depositPercent} onChange={(ev) => setQuote({ ...quote, depositPercent: ev.target.value })} /></Field>
              <Field label="Note to customer" htmlFor="qn" className="flex-1"><input id="qn" className="in in-sm" value={quote.note} onChange={(ev) => setQuote({ ...quote, note: ev.target.value })} /></Field>
            </div>
            <p className="text-sm">Total <b className="num">{money(qTotal)}</b> · deposit <b className="num">{money((qTotal * Number(quote.depositPercent || 0)) / 100)}</b></p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-o btn-sm" onClick={() => setQuote(null)}>Cancel</button>
              <button className="btn btn-o btn-sm" disabled={!!busy} onClick={async () => { if (await run('quote', () => api.post(`/admin/enquiries/${id}/quote`, { ...quote, lines: quote.lines.map((l) => ({ label: l.label, amount: Number(l.amount) || 0 })), send: false }), 'Quote saved')) setQuote(null); }}>Save draft</button>
              <button className="btn btn-p btn-sm" disabled={!!busy || !quote.lines.length} onClick={async () => { const d = await run('quote', () => api.post(`/admin/enquiries/${id}/quote`, { ...quote, lines: quote.lines.map((l) => ({ label: l.label, amount: Number(l.amount) || 0 })), send: true })); if (d) { setQuote(null); toast.success(d.emailed ? 'Quote emailed to customer' : 'Quote saved (email not configured — contact the customer directly)'); } }}>{busy === 'quote' && <Spinner />} Save & email quote</button>
            </div>
          </div>
        ) : e.quote?.lines?.length ? (
          <div className="mt-2 text-sm">{e.quote.lines.map((l, i) => <div key={i} className="sumline !py-1"><span>{l.label}</span><span className="num">{money(l.amount)}</span></div>)}<div className="sumline tot !text-base"><span>Total</span><span className="num">{money(e.quote.total)}</span></div><p className="text-xs muted">{e.quote.depositPercent}% deposit · {e.quote.sentAt ? `sent ${fmtStamp(e.quote.sentAt)}` : 'draft, not sent'}</p></div>
        ) : <p className="mt-2 text-sm muted">No quote yet.</p>}
        {!locked && e.quote?.lines?.length > 0 && !quote && <button className="btn btn-p btn-sm mt-3" onClick={() => setConvert({ pickupDate: e.requiredDate, pickupTime: '', depositPaid: e.status === 'Confirmed' })}>Convert to order</button>}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-extrabold">Internal notes</h3>
        {e.internalNotes?.map((n, i) => <div key={i} className="mb-2 rounded-lg bg-gold-bg px-3 py-2 text-sm">{n.text}<span className="block text-[11px] muted">{n.by} · {fmtStamp(n.at)}</span></div>)}
        <form className="flex gap-2" onSubmit={async (ev) => { ev.preventDefault(); if (note.trim() && await run('note', () => api.post(`/admin/enquiries/${id}/notes`, { text: note }), 'Note added')) setNote(''); }}>
          <label className="sr-only" htmlFor="en">Add note</label><input id="en" className="in in-sm flex-1" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Add a note for the team" /><button className="btn btn-o btn-sm" disabled={!note.trim()}>Add</button>
        </form>
      </section>
      <section><h3 className="mb-3 text-sm font-extrabold">History</h3><div className="hist">{[...e.history].reverse().map((h, i) => <div key={i} className="h">{h.text}<span className="block text-[11.5px] muted">{fmtStamp(h.at)}{h.by ? ` · ${h.by}` : ''}</span></div>)}</div></section>

      <Modal open={!!convert} onClose={() => setConvert(null)} title={`Convert ${e.reference} to an order`} footer={<><button className="btn btn-o" onClick={() => setConvert(null)}>Cancel</button><button className="btn btn-p" disabled={!convert?.pickupTime || busy === 'convert'} onClick={async () => { const d = await run('convert', () => api.post(`/admin/enquiries/${id}/convert`, convert)); if (d) { toast.success(`Order ${d.order.orderNumber} created`); setConvert(null); } }}>{busy === 'convert' && <Spinner />} Create order</button></>}>
        {convert && <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">Creates order for <b>{money(e.quote?.total)}</b> using the quote lines. The enquiry and order stay linked.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pickup date" htmlFor="cd"><input id="cd" type="date" className="in" value={convert.pickupDate} onChange={(ev) => setConvert({ ...convert, pickupDate: ev.target.value, pickupTime: '' })} /></Field>
            <Field label="Pickup time" htmlFor="ct"><select id="ct" className="in" value={convert.pickupTime} onChange={(ev) => setConvert({ ...convert, pickupTime: ev.target.value })}><option value="">{slots.length ? 'Choose…' : 'Closed this day'}</option>{slots.map((s) => <option key={s.time} value={s.time} disabled={s.reason === 'Full'}>{t12(s.time)} · {s.remaining} left</option>)}</select></Field>
          </div>
          <label className="check"><input type="checkbox" checked={convert.depositPaid} onChange={(ev) => setConvert({ ...convert, depositPaid: ev.target.checked })} /> Deposit received ({money((e.quote?.total * (e.quote?.depositPercent ?? 50)) / 100)}) — confirm the order now</label>
        </div>}
      </Modal>
    </div>
  );
}

export default function Enquiries() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const sel = params.get('open') || '';
  const [q, setQ] = useState('');
  const { data, error, reload } = useFetch('/admin/enquiries', { status, q: q || undefined });
  const set = (k, v) => { const n = new URLSearchParams(params); if (!v || v === 'all') n.delete(k); else n.set(k, v); setParams(n, { replace: true }); };
  useEffect(() => { if (!sel && data?.items?.length && window.innerWidth >= 1024) set('open', data.items[0]._id); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => <button key={t} className={cn('tab', status === t && 'on')} onClick={() => set('status', t)}>{t === 'all' ? 'All' : t}{t !== 'all' && data?.counts?.[t] ? <span className="cnt">{data.counts[t]}</span> : null}</button>)}
        <span className="flex-1" />
        <div className="relative w-full max-w-[280px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden="true" /><label className="sr-only" htmlFor="eq">Search enquiries</label><input id="eq" className="in !min-h-[38px] !pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Skeleton className="h-96" /> : !data.items.length ? <EmptyState title="No enquiries here" /> : (
        <div className="grid items-start gap-5 lg:[grid-template-columns:minmax(300px,380px)_1fr]">
          <div className="card overflow-hidden">
            {data.items.map((e) => (
              <button key={e._id} className={cn('flex w-full flex-col gap-1 border-b border-line-2 px-4 py-3.5 text-left last:border-0 hover:bg-[#FCF7EF]', sel === e._id && 'bg-[#FFF8E8] shadow-[inset_3px_0_0_#6E1630]')} onClick={() => set('open', e._id)}>
                <span className="flex items-center gap-2"><b className="text-sm text-wine">{e.reference}</b><span className="flex-1 truncate text-sm font-bold">{e.name}</span><Badge>{e.status}</Badge></span>
                <span className="text-xs muted">{e.occasion} · {e.servings} serves · needed {fmtDate(e.requiredDate)}</span>
              </button>
            ))}
          </div>
          {sel ? <div className="card card-b"><Detail key={sel} id={sel} onChanged={() => reload({ silent: true })} /></div> : <div className="empty hidden lg:block">Select an enquiry</div>}
        </div>
      )}
    </>
  );
}
