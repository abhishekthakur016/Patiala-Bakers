import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { Drawer, EmptyState, Qty, Spinner } from './ui.jsx';
import ProductImage from './ProductImage.jsx';
import { money, sizeLabel } from '../utils/format.js';

export function lineSummary(o = {}) {
  const parts = [];
  if (o.sponge) parts.push(`${o.sponge} sponge`);
  if (o.filling) parts.push(o.filling);
  if (o.finish) parts.push(o.finish);
  if (o.vegan) parts.push('Vegan');
  if (o.glutenFree) parts.push('Gluten-free');
  if (o.addons?.length) parts.push(o.addons.join(', '));
  return parts.join(' · ');
}

export default function CartDrawer() {
  const { items, quote, quoting, open, setOpen, setQty, remove, lineFor, issueFor } = useCart();
  const nav = useNavigate();
  const hasIssues = quote?.issues?.length > 0;
  return (
    <Drawer open={open} onClose={() => setOpen(false)} title={`Your cart${items.length ? ` (${items.reduce((s, i) => s + i.qty, 0)})` : ''}`}
      footer={items.length > 0 && (
        <>
          <div className="sumline"><span>Subtotal</span><b className="num">{quote ? money(quote.subtotal) : '—'}</b></div>
          {quote?.fees > 0 && <div className="sumline"><span>{quote.feeLabel}</span><b className="num">{money(quote.fees)}</b></div>}
          {hasIssues && <p className="errbox">Some items need attention before checkout.</p>}
          <button className="btn btn-p btn-lg w-full" disabled={!quote || hasIssues || quoting} onClick={() => { setOpen(false); nav('/checkout'); }}>
            {quoting && <Spinner />} Checkout · {quote ? money(quote.total) : '…'}
          </button>
          <p className="text-center text-xs muted">Pickup only · choose your date and time at checkout</p>
        </>
      )}>
      {!items.length ? (
        <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link to="/shop" className="btn btn-p" onClick={() => setOpen(false)}>Browse the menu</Link>}>
          Fresh cakes, sweets and snacks are waiting.
        </EmptyState>
      ) : items.map((it) => {
        const l = lineFor(it.id);
        const issue = issueFor(it.id);
        return (
          <div className="cline" key={it.id}>
            <ProductImage src={l?.image} name={l?.name || 'Item'} category={l?.category} className="h-[76px] w-[76px] flex-none overflow-hidden rounded-xl object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex gap-2"><b className="flex-1 text-[14.5px]">{l?.name || (issue ? 'Unavailable item' : 'Loading…')}</b><b className="num text-sm">{l ? money(l.lineTotal) : ''}</b></div>
              <span className="text-[12.5px] muted">{sizeLabel(it.variant)}{lineSummary(it.options) && ` · ${lineSummary(it.options)}`}</span>
              {it.options?.message && <span className="text-[12.5px] muted">Message: “{it.options.message}”</span>}
              {issue && <span className="ferr !mt-0">{issue.message}</span>}
              <div className="mt-1 flex items-center gap-2">
                <Qty small value={it.qty} min={1} onChange={(q) => setQty(it.id, q)} />
                <span className="flex-1" />
                <button className="btn btn-ghost btn-xs" onClick={() => remove(it.id)} aria-label={`Remove ${l?.name || 'item'}`}><Trash2 size={14} /> Remove</button>
              </div>
            </div>
          </div>
        );
      })}
    </Drawer>
  );
}
