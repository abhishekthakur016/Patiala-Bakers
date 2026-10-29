import ProductImage from './ProductImage.jsx';
import { Badge } from './ui.jsx';
import { lineSummary } from './CartDrawer.jsx';
import { cn, fmtLong, fmtStamp, money, sizeLabel, t12 } from '../utils/format.js';

const FLOW = ['Confirmed', 'In Production', 'Ready', 'Collected'];

export function StatusTracker({ status }) {
  if (status === 'Cancelled') return <p className="errbox">This order was cancelled.</p>;
  if (status === 'Pending') return <p className="goldbox">Awaiting payment or deposit — we’ll confirm your order as soon as it’s received.</p>;
  const idx = FLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Order progress">
      {FLOW.map((s, i) => <li key={s} className={cn('dstep', i < idx && 'done', i === idx && 'on')} aria-current={i === idx ? 'step' : undefined}>{s === 'In Production' ? 'Baking' : s}</li>)}
    </ol>
  );
}

// Customer-facing order summary used on confirmation, tracking and account pages
export default function OrderView({ order, address }) {
  return (
    <div className="flex flex-col gap-5">
      <StatusTracker status={order.status} />
      <div className="grid gap-3 rounded-xl bg-cream p-4 text-sm [grid-template-columns:110px_1fr]">
        <span className="font-semibold muted">Pickup</span><span><b>{fmtLong(order.pickupDate)}</b> at <b>{t12(order.pickupTime)}</b>{address && <><br />{address}</>}</span>
        <span className="font-semibold muted">Name</span><span>{order.customer.name} · {order.customer.phone}</span>
        <span className="font-semibold muted">Payment</span><span><Badge>{order.paymentStatus}</Badge>{order.balanceDue > 0 && order.status !== 'Cancelled' && <span className="ml-2">{money(order.balanceDue)} due{order.depositDue && order.paymentStatus === 'Unpaid' ? ` (deposit ${money(order.depositDue)})` : ' at pickup'}</span>}</span>
        {order.notes && <><span className="font-semibold muted">Notes</span><span>{order.notes}</span></>}
      </div>
      <div>
        {order.items.map((i, k) => (
          <div key={k} className="flex gap-3.5 border-b border-line-2 py-3 last:border-0">
            <ProductImage src={i.image} name={i.name} category={i.category} className="h-16 w-16 flex-none overflow-hidden rounded-xl object-cover" />
            <div className="min-w-0 flex-1 text-sm">
              <b>{i.qty} × {i.name}</b>
              <p className="text-xs muted">{sizeLabel(i.variant)}{lineSummary(i.options) && ` · ${lineSummary(i.options)}`}</p>
              {i.options?.message && <p className="text-xs muted">Message: “{i.options.message}”</p>}
              {i.diet?.length > 0 && <p className="text-xs font-bold text-ok">{i.diet.join(' · ')}</p>}
            </div>
            <b className="text-sm num">{money(i.lineTotal)}</b>
          </div>
        ))}
        <div className="sumline"><span>Subtotal</span><span className="num">{money(order.subtotal)}</span></div>
        {order.fees > 0 && <div className="sumline"><span>Fees</span><span className="num">{money(order.fees)}</span></div>}
        <div className="sumline tot"><span>Total</span><span className="num">{money(order.total)}</span></div>
      </div>
      {order.timeline?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-extrabold">History</h3>
          <div className="hist">{order.timeline.map((h, k) => <div key={k} className="h">{h.text}<span className="block text-[11.5px] muted">{fmtStamp(h.at)}</span></div>)}</div>
        </div>
      )}
    </div>
  );
}
