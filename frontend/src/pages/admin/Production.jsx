import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, ErrorState, Skeleton } from '../../components/ui.jsx';
import OrderDrawer, { ProductionTicket } from '../../components/admin/OrderDrawer.jsx';
import { cn, fmtLong, sizeLabel, t12, todayISO } from '../../utils/format.js';

const COLS = [['Confirmed', 'b-info', '#2B5A88'], ['In Production', 'b-warn', '#D08A1C'], ['Ready', 'b-ok', '#2B6638'], ['Collected', 'b-mute', '#9C8E88']];

export default function Production() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayISO();
  const { data, error, reload, setData } = useFetch('/admin/production', { date });
  const [open, setOpen] = useState('');
  const [drag, setDrag] = useState(null);
  const [printAll, setPrintAll] = useState(false);
  const shift = (n) => setParams({ date: format(addDays(parseISO(date), n), 'yyyy-MM-dd') });

  const move = async (o, status, baker) => {
    const prev = data;
    setData({ ...data, orders: data.orders.map((x) => (x._id === o._id ? { ...x, ...(status ? { status } : {}), ...(baker !== undefined ? { baker } : {}) } : x)) }); // optimistic
    try {
      if (status && status !== o.status) await api.post(`/admin/orders/${o._id}/status`, { status });
      if (baker !== undefined) await api.patch(`/admin/orders/${o._id}`, { baker });
      reload({ silent: true });
    } catch (e) { setData(prev); toast.error(apiError(e).message); }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  const orders = data?.orders || [];
  const cakeCount = orders.filter((o) => o.status !== 'Collected').reduce((s, o) => s + o.items.filter((i) => ['cakes', 'custom-cakes'].includes(i.category)).reduce((a, i) => a + i.qty, 0), 0);

  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="seggrp">
          <button className={cn('seg', date === todayISO() && 'on')} onClick={() => setParams({})}>Today</button>
          <button className={cn('seg', date === format(addDays(new Date(), 1), 'yyyy-MM-dd') && 'on')} onClick={() => setParams({ date: format(addDays(new Date(), 1), 'yyyy-MM-dd') })}>Tomorrow</button>
        </div>
        <button className="iconbtn" onClick={() => shift(-1)} aria-label="Previous day"><ChevronLeft size={20} /></button>
        <input type="date" className="sel" value={date} onChange={(e) => e.target.value && setParams({ date: e.target.value })} aria-label="Production date" />
        <button className="iconbtn" onClick={() => shift(1)} aria-label="Next day"><ChevronRight size={20} /></button>
        <b className="text-sm">{fmtLong(date)}</b>
        <span className="flex-1" />
        <span className="text-sm muted">{orders.length} orders · {cakeCount} cakes to finish</span>
        <button className="btn btn-o btn-sm" disabled={!orders.length} onClick={() => setPrintAll(true)}><Printer size={15} /> Print all tickets</button>
      </div>
      {!data ? <Skeleton className="h-[420px]" /> : (
        <div className="no-print grid gap-4 overflow-x-auto pb-1.5 [grid-template-columns:repeat(4,minmax(250px,1fr))]">
          {COLS.map(([status, , dot]) => {
            const list = orders.filter((o) => o.status === status);
            return (
              <section key={status} className={cn('kcol', drag && drag.status !== status && 'outline-dashed outline-2 outline-[#D9C9B3]')} aria-label={status}
                onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(drag, status); setDrag(null); }}>
                <h3 className="flex items-center gap-2 px-1.5 pb-1.5 pt-1 text-sm font-extrabold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />{status}<span className="ml-auto text-xs muted">{list.length}</span></h3>
                {!list.length && <div className="kempty">Nothing here</div>}
                {list.map((o) => (
                  <article key={o._id} className={cn('kcard cursor-grab', o.priority === 'High' && 'hi')} draggable onDragStart={() => setDrag(o)} onDragEnd={() => setDrag(null)}>
                    <div className="flex items-center gap-2"><button className="text-[13px] font-extrabold text-wine" onClick={() => setOpen(o._id)}>{o.orderNumber}</button>{o.priority === 'High' && <Badge>High</Badge>}<span className="ml-auto whitespace-nowrap text-[13px] font-extrabold">{t12(o.pickupTime)}</span></div>
                    {o.items.map((i, k) => <h4 key={k} className="text-[15px] font-extrabold leading-tight">{i.qty} × {i.name} {sizeLabel(i.variant)}</h4>)}
                    <dl className="grid gap-x-2.5 gap-y-0.5 text-[12.5px] [grid-template-columns:auto_1fr]">
                      {o.items[0].options?.sponge && <><dt className="font-semibold muted">Sponge</dt><dd>{o.items[0].options.sponge} · {o.items[0].options.filling}</dd></>}
                      {o.items[0].options?.finish && <><dt className="font-semibold muted">Finish</dt><dd>{o.items[0].options.finish}</dd></>}
                      {o.items.some((i) => i.options?.message) && <><dt className="font-semibold muted">Message</dt><dd className="font-bold">“{o.items.find((i) => i.options?.message).options.message}”</dd></>}
                      {o.items.some((i) => i.diet?.some((d) => d !== 'Eggless')) && <><dt className="font-semibold muted">Diet</dt><dd className="font-bold text-ok">{[...new Set(o.items.flatMap((i) => i.diet))].join(', ')}</dd></>}
                      <dt className="font-semibold muted">For</dt><dd>{o.customer.name}</dd>
                    </dl>
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-line-2 pt-1.5">
                      <label className="sr-only" htmlFor={`b-${o._id}`}>Baker</label>
                      <select id={`b-${o._id}`} className="sel !min-h-[32px] max-w-[120px] !text-[12.5px]" value={o.baker || ''} onChange={(e) => move(o, null, e.target.value)}><option value="">Baker…</option>{data.bakers.map((b) => <option key={b}>{b}</option>)}</select>
                      <span className="flex-1" />
                      {status !== 'Collected' && <button className="btn btn-p btn-xs" onClick={() => move(o, COLS[COLS.findIndex((c) => c[0] === status) + 1][0])}>{status === 'Confirmed' ? 'Start' : status === 'In Production' ? 'Ready' : 'Collected'} →</button>}
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
      <p className="no-print text-xs muted">Drag cards between columns or use the buttons. Pending orders appear here once their payment or deposit is confirmed.</p>
      {open && <OrderDrawer id={open} bakers={data?.bakers} onClose={() => setOpen('')} onChanged={() => reload({ silent: true })} />}
      {printAll && (
        <div className="modal print:static print:p-0" role="dialog" aria-modal="true" aria-label="All production tickets">
          <div className="scrim no-print" onClick={() => setPrintAll(false)} />
          <div className="mbox w print:shadow-none">
            <div className="mh no-print"><h3 className="flex-1">Tickets · {fmtLong(date)}</h3><button className="btn btn-p btn-sm" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="btn btn-o btn-sm" onClick={() => setPrintAll(false)}>Close</button></div>
            <div className="mb flex flex-col gap-6">{orders.filter((o) => o.status !== 'Collected').map((o) => <div key={o._id} className="[break-after:page]"><ProductionTicket order={o} /></div>)}</div>
          </div>
        </div>
      )}
    </>
  );
}
