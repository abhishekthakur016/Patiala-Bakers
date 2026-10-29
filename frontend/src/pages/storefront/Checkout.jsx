import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowLeft, CreditCard, Lock, ShoppingBag, Store } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { EmptyState, Field, PageLoader, Spinner } from '../../components/ui.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import { lineSummary } from '../../components/CartDrawer.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { cn, fmtDate, fmtLong, money, sizeLabel, t12, uid } from '../../utils/format.js';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().min(6, 'Enter a valid phone number').regex(/^[+()\d\s-]+$/, 'Enter a valid phone number'),
  notes: z.string().max(1000).optional(),
});

const KEY = 'pb-checkout-key';
const getKey = () => { let k = sessionStorage.getItem(KEY); if (!k) { k = uid(); sessionStorage.setItem(KEY, k); } return k; };

export default function Checkout() {
  const { items, quote, quoting, clear, issueFor } = useCart();
  const { user } = useAuth();
  const { settings } = useSettings();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [dates, setDates] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState('');
  const [method, setMethod] = useState('pay_at_pickup');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const submittingRef = useRef(false);

  const { register, handleSubmit, formState: { errors }, getValues, reset } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', phone: '', notes: '' } });
  useEffect(() => { if (user) reset({ ...getValues(), name: user.name, email: user.email, phone: user.phone || '' }); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const lead = quote?.leadHours ?? 0;
  useEffect(() => {
    if (!quote) return;
    setDates(null);
    api.get('/availability', { params: { leadHours: lead, days: 28 } }).then(({ data }) => setDates(data.dates)).catch(() => setDates([]));
  }, [lead, !!quote]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!date) return;
    setSlots(null); setTime('');
    api.get('/availability', { params: { date, leadHours: lead } }).then(({ data }) => setSlots(data.slots)).catch(() => setSlots([]));
  }, [date, lead]);

  const online = settings?.payments?.onlineAvailable;
  const depositRequired = quote?.depositRequired;
  const methods = useMemo(() => {
    const m = [];
    if (settings?.payments?.payAtPickup) m.push({ id: 'pay_at_pickup', label: depositRequired ? 'Pay deposit later' : 'Pay at pickup', desc: depositRequired ? `Custom cakes need a ${quote?.depositPercent}% deposit. We’ll contact you to arrange it before we start baking.` : 'Pay by card or cash when you collect.', icon: Store });
    if (online) m.push({ id: 'card_online', label: 'Pay in full online', desc: 'Secure card payment. Your order is confirmed once payment is verified.', icon: CreditCard });
    if (online && depositRequired) m.push({ id: 'deposit_online', label: `Pay ${quote?.depositPercent}% deposit online`, desc: `${money(quote?.depositAmount)} now, the balance at pickup.`, icon: CreditCard });
    return m;
  }, [settings, online, depositRequired, quote]);
  useEffect(() => { if (methods.length && !methods.some((m) => m.id === method)) setMethod(methods[0].id); }, [methods, method]);

  if (!items.length) return <div className="wrap py-16"><EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link to="/shop" className="btn btn-p">Browse the menu</Link>}>Add something delicious, then come back to choose a pickup time.</EmptyState></div>;
  if (!quote) return <PageLoader label="Checking prices…" />;
  const hasIssues = quote.issues.length > 0;

  const placeOrder = handleSubmit(async (values) => {
    if (submittingRef.current) return; // guard against double submission
    submittingRef.current = true;
    setSubmitting(true); setServerError('');
    try {
      const { data } = await api.post('/checkout', {
        items, customer: { name: values.name, email: values.email, phone: values.phone }, notes: values.notes, pickupDate: date, pickupTime: time, paymentMethod: method, idempotencyKey: getKey(),
      });
      sessionStorage.removeItem(KEY);
      try { sessionStorage.setItem(`pb-order-${data.order.orderNumber}`, data.accessToken); } catch { /* ignore */ }
      clear();
      if (data.paymentUrl) { window.location.assign(data.paymentUrl); return; }
      nav(`/order/${data.order.orderNumber}?token=${data.accessToken}`, { replace: true });
    } catch (e) {
      const err = apiError(e);
      setServerError(err.message);
      if (err.status === 409) { setStep(1); setTime(''); api.get('/availability', { params: { date, leadHours: lead } }).then(({ data }) => setSlots(data.slots)).catch(() => {}); }
      toast.error(err.message);
    } finally { submittingRef.current = false; setSubmitting(false); }
  });

  const Steps = (
    <div className="flex flex-wrap gap-2" aria-label="Checkout steps">
      {['Pickup', 'Your details', 'Review & pay'].map((l, i) => <span key={l} className={cn('stp', step === i + 1 && 'on', step > i + 1 && 'done')}><span className="n">{i + 1}</span>{l}</span>)}
    </div>
  );

  return (
    <>
      <div className="pagehead"><div className="wrap"><Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute no-underline"><ArrowLeft size={15} /> Keep shopping</Link><h1>Checkout</h1></div></div>
      <div className="wrap flex flex-wrap items-start gap-8 pb-20 pt-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {Steps}
          {serverError && <p className="errbox" role="alert">{serverError}</p>}
          {hasIssues && <div className="errbox">Some items in your cart need attention — open the cart to fix them before checking out.</div>}

          {step === 1 && (
            <section className="card card-b">
              <h2 className="font-sans text-xl font-extrabold">Choose a pickup day</h2>
              <p className="mt-1 text-sm muted">Your order needs at least <b>{lead} hours</b> notice. Pickup from {settings?.business?.address}.</p>
              {!dates ? <div className="mt-4 flex gap-2.5">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel h-[88px] w-[86px]" />)}</div> : (
                <div className="mt-4 flex gap-2.5 overflow-x-auto pb-2.5 pt-1" role="radiogroup" aria-label="Pickup date">
                  {dates.map((d) => (
                    <button key={d.date} type="button" role="radio" aria-checked={date === d.date} disabled={!d.available} className={cn('dchip', date === d.date && 'on', !d.available && 'off')} onClick={() => setDate(d.date)} title={d.reason || `${d.openSlots} slots`}>
                      <span className="dw">{fmtDate(d.date, 'EEE')}</span><span className="dd">{fmtDate(d.date, 'd')}</span><span className="dr">{d.available ? fmtDate(d.date, 'MMM') : d.reason}</span>
                    </button>
                  ))}
                </div>
              )}
              {date && (
                <>
                  <h3 className="mt-6 text-base font-extrabold">Pickup time · {fmtLong(date)}</h3>
                  {!slots ? <div className="mt-3"><Spinner dark /></div> : (
                    <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr))]" role="radiogroup" aria-label="Pickup time">
                      {slots.map((s) => (
                        <button key={s.time} type="button" role="radio" aria-checked={time === s.time} disabled={!s.available} className={cn('slot', time === s.time && 'on', !s.available && 'off')} onClick={() => setTime(s.time)}>
                          <b className="text-base">{t12(s.time)}</b><span>{s.available ? `${s.remaining} left` : s.reason}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="mt-6 flex justify-end"><button className="btn btn-p btn-lg" disabled={!date || !time || hasIssues} onClick={() => setStep(2)}>Continue</button></div>
            </section>
          )}

          {step === 2 && (
            <form className="card card-b" onSubmit={(e) => { e.preventDefault(); handleSubmit(() => setStep(3))(); }} noValidate>
              <h2 className="font-sans text-xl font-extrabold">Your details</h2>
              {!user && <p className="mt-1 text-sm muted">Have an account? <Link to="/login?next=/checkout">Sign in</Link> to save this order to your history.</p>}
              <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
                <Field label="Full name" htmlFor="name" error={errors.name?.message}><input id="name" className={cn('in', errors.name && 'err')} autoComplete="name" {...register('name')} /></Field>
                <Field label="Mobile number" htmlFor="phone" error={errors.phone?.message}><input id="phone" className={cn('in', errors.phone && 'err')} autoComplete="tel" inputMode="tel" {...register('phone')} /></Field>
                <Field label="Email" htmlFor="email" error={errors.email?.message} help="We’ll send your confirmation here." className="sm:col-span-2"><input id="email" type="email" className={cn('in', errors.email && 'err')} autoComplete="email" {...register('email')} /></Field>
                <Field label="Order notes (optional)" htmlFor="notes" className="sm:col-span-2"><textarea id="notes" className="in" maxLength={1000} placeholder="Allergies, who is collecting, anything else" {...register('notes')} /></Field>
              </div>
              <div className="mt-6 flex justify-between"><button type="button" className="btn btn-o" onClick={() => setStep(1)}>Back</button><button className="btn btn-p btn-lg">Continue</button></div>
            </form>
          )}

          {step === 3 && (
            <section className="card card-b">
              <h2 className="font-sans text-xl font-extrabold">Review & pay</h2>
              <div className="mt-4 grid gap-3 rounded-xl bg-cream p-4 text-sm [grid-template-columns:120px_1fr]">
                <span className="font-semibold muted">Pickup</span><span><b>{fmtLong(date)}</b> at <b>{t12(time)}</b> <button className="btn btn-ghost btn-xs" onClick={() => setStep(1)}>Change</button></span>
                <span className="font-semibold muted">Customer</span><span>{getValues('name')} · {getValues('phone')} · {getValues('email')} <button className="btn btn-ghost btn-xs" onClick={() => setStep(2)}>Change</button></span>
              </div>
              <h3 className="mt-6 text-base font-extrabold">Payment</h3>
              <div className="mt-3 flex flex-col gap-2.5" role="radiogroup" aria-label="Payment method">
                {methods.map((m) => (
                  <label key={m.id} className={cn('dbox', method === m.id && '!border-wine')}>
                    <input type="radio" name="pm" checked={method === m.id} onChange={() => setMethod(m.id)} />
                    <m.icon size={20} className="text-wine" />
                    <span className="flex flex-col text-sm font-bold leading-snug">{m.label}<span className="text-xs font-semibold text-mute">{m.desc}</span></span>
                  </label>
                ))}
              </div>
              {!online && <p className="help flex items-center gap-1.5"><Lock size={13} /> Online card payments are not enabled for this bakery yet.</p>}
              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <button className="btn btn-o" onClick={() => setStep(2)} disabled={submitting}>Back</button>
                <button className="btn btn-p btn-lg" onClick={placeOrder} disabled={submitting || hasIssues || quoting}>
                  {submitting && <Spinner />}{method === 'pay_at_pickup' ? `Place order · ${money(quote.total)}` : `Continue to payment · ${money(method === 'deposit_online' ? quote.depositAmount : quote.total)}`}
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="flex-[1_1_320px] lg:sticky lg:top-24">
          <div className="card card-b">
            <h2 className="font-sans text-lg font-extrabold">Order summary</h2>
            <div className="mt-3">
              {items.map((it) => {
                const l = quote.lines.find((x) => x.id === it.id);
                const issue = issueFor(it.id);
                return (
                  <div key={it.id} className="flex gap-3 border-b border-line-2 py-3 last:border-0">
                    <ProductImage src={l?.image} name={l?.name || ''} category={l?.category} className="h-14 w-14 flex-none overflow-hidden rounded-[10px] object-cover" />
                    <div className="min-w-0 flex-1 text-sm">
                      <b>{it.qty} × {l?.name || 'Unavailable item'}</b>
                      <p className="text-xs muted">{sizeLabel(it.variant)}{lineSummary(it.options) && ` · ${lineSummary(it.options)}`}</p>
                      {it.options?.message && <p className="text-xs muted">“{it.options.message}”</p>}
                      {issue && <p className="text-xs font-bold text-bad">{issue.message}</p>}
                    </div>
                    <b className="text-sm num">{l ? money(l.lineTotal) : '—'}</b>
                  </div>
                );
              })}
            </div>
            <div className="sumline"><span>Subtotal</span><span className="num">{money(quote.subtotal)}</span></div>
            {quote.fees > 0 && <div className="sumline"><span>{quote.feeLabel}</span><span className="num">{money(quote.fees)}</span></div>}
            <div className="sumline tot"><span>Total</span><span className="num">{money(quote.total)}</span></div>
            {depositRequired && <p className="goldbox mt-3">Includes a custom cake — a {quote.depositPercent}% deposit ({money(quote.depositAmount)}) confirms your booking.</p>}
            <p className="mt-3 text-xs muted">Prices are confirmed by the bakery when you place your order.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
