import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Ban, ChevronLeft, ChevronRight, Unlock } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, ErrorState, Field, Modal, Skeleton, Spinner } from '../../components/ui.jsx';
import OrderDrawer from '../../components/admin/OrderDrawer.jsx';
import { cn, fmtDate, fmtLong, t12, todayISO } from '../../utils/format.js';

const level = (s) => (s.reason && s.reason !== 'Not enough notice' && s.reason !== 'Full' ? 'blocked' : s.booked >= s.capacity ? 'full' : s.booked / s.capacity >= 0.75 ? 'busy' : s.booked ? 'some' : 'free');

export default function PickupCalendar() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'day';
  const date = params.get('date') || todayISO();
  const { data, error, reload } = useFetch('/admin/calendar', { view, date });
  const [open, setOpen] = useState('');
  const [block, setBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bakers, setBakers] = useState([]);
  useEffect(() => { api.get('/admin/settings').then(({ data: d }) => setBakers(d.settings.bakers || [])).catch(() => {}); }, []);

  const go = (patch) => setParams({ view, date, ...patch });
  const shift = (n) => go({ date: format(addDays(parseISO(date), n), 'yyyy-MM-dd') });
  const toggleBlock = async (body, unblock) => {
    setBusy(true);
    try { await api.post(`/admin/calendar/${unblock ? 'unblock' : 'block'}`, body); toast.success(unblock ? 'Unblocked' : 'Blocked'); setBlock(null); reload({ silent: true }); } catch (e) { toast.error(apiError(e).message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="seggrp"><button className={cn('seg', view === 'day' && 'on')} onClick={() => go({ view: 'day' })}>Day</button><button className={cn('seg', view === 'week' && 'on')} onClick={() => go({ view: 'week' })}>Week</button></div>
        <button className="iconbtn" onClick={() => shift(view === 'week' ? -7 : -1)} aria-label="Previous"><ChevronLeft size={20} /></button>
        <input type="date" className="sel" value={date} onChange={(e) => e.target.value && go({ date: e.target.value })} aria-label="Date" />
        <button className="iconbtn" onClick={() => shift(view === 'week' ? 7 : 1)} aria-label="Next"><ChevronRight size={20} /></button>
        <button className="btn btn-o btn-sm" onClick={() => go({ date: todayISO() })}>Today</button>
        <span className="flex-1" />
        {view === 'day' && data && (data.blocked
          ? <button className="btn btn-o btn-sm" disabled={busy} onClick={() => toggleBlock({ date }, true)}><Unlock size={15} /> Reopen this day</button>
          : <button className="btn btn-o btn-sm" onClick={() => setBlock({ date, reason: '' })}><Ban size={15} /> Block this day</button>)}
      </div>
      <div className="flex flex-wrap gap-3.5 text-xs font-semibold muted">{[['#fff', 'Free'], ['#E4EFE1', 'Some bookings'], ['#FAEDD2', 'Busy'], ['#A12428', 'Full'], ['#5E5157', 'Blocked']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded border border-line" style={{ background: c }} />{l}</span>)}</div>

      {error ? <ErrorState message={error} onRetry={reload} /> : !data || data.view !== view ? <Skeleton className="h-96" /> : view === 'week' ? (
        <div className="card overflow-x-auto p-4">
          {(() => {
            const times = [...new Set(data.days.flatMap((d) => d.slots.map((s) => s.time)))].sort();
            return (
              <div className="grid min-w-[720px] gap-1.5" style={{ gridTemplateColumns: `70px repeat(7, minmax(84px, 1fr))` }}>
                <span />
                {data.days.map((d) => <button key={d.date} className={cn('rounded-[10px] px-1 py-2 text-center text-xs font-extrabold leading-snug', d.date === todayISO() ? 'bg-wine text-white' : 'hover:bg-cream-2')} onClick={() => go({ view: 'day', date: d.date })}>{fmtDate(d.date, 'EEE')}<span className={cn('block font-semibold', d.date === todayISO() ? 'text-[#F3D9A4]' : 'text-mute')}>{fmtDate(d.date, 'd MMM')}</span></button>)}
                {times.map((t) => (
                  <div key={t} className="contents">
                    <span className="flex items-center text-xs font-bold muted">{t12(t)}</span>
                    {data.days.map((d) => {
                      const s = d.slots.find((x) => x.time === t);
                      if (d.closed || !s) return <span key={d.date} className="wc closed">{d.closed ? 'Closed' : ''}</span>;
                      const lv = level(s);
                      return <button key={d.date} className={cn('wc', lv)} onClick={() => go({ view: 'day', date: d.date })} title={`${s.booked}/${s.capacity} booked${s.reason ? ` · ${s.reason}` : ''}`}>{lv === 'blocked' ? 'Blocked' : `${s.booked}/${s.capacity}`}</button>;
                    })}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="card">
          <div className="card-h"><h3 className="flex-1">{fmtLong(date)}</h3><span className="text-sm muted">{data.orders.length} pickups · capacity {data.capacity} per slot</span></div>
          <div className="card-b">
            {data.blocked && <p className="errbox mb-3">This day is blocked{data.blocked.reason ? `: ${data.blocked.reason}` : ''}. Customers cannot book pickups.</p>}
            {!data.slots.length ? <p className="py-10 text-center muted">The bakery is closed on this day.</p> : data.slots.map((s) => {
              const list = data.orders.filter((o) => o.pickupTime === s.time);
              const lv = level(s);
              const slotBlocked = data.blockedSlots.find((b) => b.time === s.time);
              return (
                <div key={s.time} className="grid items-start gap-4 border-b border-line-2 py-3.5 last:border-0 [grid-template-columns:90px_1fr]">
                  <b className="pt-1 text-[15px]">{t12(s.time)}</b>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className={cn('cbar', lv === 'busy' && 'busy', lv === 'full' && 'full', lv === 'blocked' && 'blocked')}><i style={{ width: `${Math.min(100, (s.booked / s.capacity) * 100)}%` }} /></div>
                      <span className="text-xs font-bold muted">{s.booked}/{s.capacity} booked{slotBlocked ? ' · blocked' : ''}</span>
                      <span className="flex-1" />
                      {!data.blocked && (slotBlocked
                        ? <button className="btn btn-ghost btn-xs" onClick={() => toggleBlock({ date, time: s.time }, true)}>Unblock slot</button>
                        : <button className="btn btn-ghost btn-xs" onClick={() => setBlock({ date, time: s.time, reason: '' })}>Block slot</button>)}
                    </div>
                    {list.length > 0 && <div className="flex flex-wrap gap-2">{list.map((o) => (
                      <button key={o._id} className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-white px-2.5 py-1.5 text-left text-[12.5px] font-semibold hover:border-wine" onClick={() => setOpen(o._id)}>
                        <b className="text-wine">{o.orderNumber}</b>{o.customer.name}<Badge>{o.status}</Badge>{o.paymentStatus !== 'Paid' && <Badge>{o.paymentStatus}</Badge>}
                      </button>
                    ))}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {open && <OrderDrawer id={open} bakers={bakers} onClose={() => setOpen('')} onChanged={() => reload({ silent: true })} />}
      <Modal open={!!block} onClose={() => setBlock(null)} title={block?.time ? `Block ${t12(block.time)} on ${fmtDate(block.date)}` : `Block ${block ? fmtLong(block.date) : ''}`}
        footer={<><button className="btn btn-o" onClick={() => setBlock(null)}>Cancel</button><button className="btn btn-danger" disabled={busy} onClick={() => toggleBlock(block)}>{busy && <Spinner />} Block</button></>}>
        <p className="mb-3 text-sm text-ink-2">Customers won’t be able to choose this {block?.time ? 'slot' : 'day'} at checkout. Existing orders are not affected.</p>
        <Field label="Reason (shown to staff)" htmlFor="br"><input id="br" className="in" value={block?.reason || ''} onChange={(e) => setBlock({ ...block, reason: e.target.value })} placeholder="e.g. Public holiday" /></Field>
      </Modal>
    </>
  );
}
