import { useEffect, useRef } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';
import { STATUS_CLS, cn } from '../utils/format.js';

export const Badge = ({ children, cls }) => <span className={cn('badge', cls || STATUS_CLS[children] || 'b-mute')}>{children}</span>;

export const Spinner = ({ dark, className }) => <span className={cn('spinner inline-block', dark && 'dark', className)} role="status" aria-label="Loading" />;

export const Skeleton = ({ className, style }) => <div className={cn('skel', className)} style={style} aria-hidden="true" />;

export function PageLoader({ label = 'Loading…' }) {
  return <div className="flex items-center justify-center gap-3 py-24 muted"><Spinner dark /> {label}</div>;
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty">
      <Icon className="mx-auto mb-3 h-8 w-8 text-gold-d" aria-hidden="true" />
      <p className="text-lg font-bold text-ink">{title}</p>
      {children && <p className="mt-1 muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="empty">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-bad" aria-hidden="true" />
      <p className="font-bold text-ink">{message}</p>
      {onRetry && <button className="btn btn-o btn-sm mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}

function useEscape(onClose, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [onClose, active]);
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null);
  useEscape(onClose, open);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={onClose} />
      <div className={cn('mbox', wide && 'w')} ref={ref} tabIndex={-1}>
        <div className="mh"><h3 className="flex-1">{title}</h3><button className="iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer, wide, headerExtra }) {
  useEscape(onClose, open);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className={cn('drawer', wide && 'wide')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Panel'}>
        <div className="dh"><h3 className="flex-1 min-w-0">{title}</h3>{headerExtra}<button className="iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="dbd">{children}</div>
        {footer && <div className="dft">{footer}</div>}
      </aside>
    </>
  );
}

export function Confirm({ open, title, children, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<>
      <button className="btn btn-o" onClick={onClose} disabled={busy}>Cancel</button>
      <button className={cn('btn', danger ? 'btn-danger' : 'btn-p')} onClick={onConfirm} disabled={busy}>{busy && <Spinner />}{confirmLabel}</button>
    </>}>
      <div className="text-[15px] text-ink-2">{children}</div>
    </Modal>
  );
}

export function Field({ label, error, help, children, htmlFor, className }) {
  return (
    <div className={className}>
      {label && <label className="lbl" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="ferr" role="alert">{error}</p> : help ? <p className="help">{help}</p> : null}
    </div>
  );
}

export const Switch = ({ on, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={cn('sw', on && 'on')} onClick={() => onChange(!on)} />
);

export function Qty({ value, onChange, min = 1, max = 50, small, label = 'Quantity' }) {
  return (
    <div className={cn('qty', small && 'qty-sm')} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease">−</button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase">+</button>
    </div>
  );
}

export function Pagination({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
      <button className="btn btn-o btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /> Prev</button>
      <span className="px-3 text-sm font-bold muted">Page {page} of {pages}</span>
      <button className="btn btn-o btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <ChevronRight size={16} /></button>
    </nav>
  );
}

export function Logo({ light, small }) {
  return (
    <span className="logo flex items-center gap-3">
      <span className="mark" style={small ? { width: 40, height: 40, fontSize: 18 } : undefined}>PB</span>
      <span className="flex flex-col leading-none">
        <b className={cn('font-serif font-bold', small ? 'text-[22px]' : 'text-[26px]', light ? 'text-[#FFF4E6]' : 'text-wine')}>Patiala Bakers</b>
        <span className={cn('mt-1 text-[10.5px] font-bold uppercase tracking-[.24em]', light ? 'text-[#D9BE8C]' : 'text-gold-d')}>Eggless cakes · Sweets</span>
      </span>
    </span>
  );
}
