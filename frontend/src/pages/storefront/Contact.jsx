import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Mail, MapPin, Phone } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { Field, Spinner } from '../../components/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { cn, t12 } from '../../utils/format.js';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const schema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().trim().email('Enter a valid email'), phone: z.string().optional(), message: z.string().trim().min(5, 'Enter a message') });

export default function Contact() {
  const { settings } = useSettings();
  const b = settings?.business;
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try { await api.post('/contact', v); setSent(true); reset(); } catch (e) { setErr(apiError(e).message); }
  });
  return (
    <>
      <div className="pagehead"><div className="wrap"><p className="eyebrow">Visit us</p><h1>Contact & pickup</h1></div></div>
      <div className="wrap grid gap-8 py-10 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <div className="card card-b">
          <ul className="flex flex-col gap-4">
            <li className="flex gap-3"><MapPin className="text-wine" /><div><b>Address</b><p className="muted">{b?.address}</p><a className="text-sm font-bold" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(b?.address || '')}`}>Get directions</a></div></li>
            <li className="flex gap-3"><Phone className="text-wine" /><div><b>Phone</b><p><a href={`tel:${b?.phone?.replace(/\s/g, '')}`}>{b?.phone}</a></p></div></li>
            <li className="flex gap-3"><Mail className="text-wine" /><div><b>Email</b><p><a href={`mailto:${b?.email}`}>{b?.email}</a></p></div></li>
          </ul>
          <h2 className="mt-8 font-sans text-base font-extrabold">Opening & pickup hours</h2>
          <div className="mt-2">{settings?.hours?.map((h, i) => <div key={i} className={cn('flex justify-between border-b border-dashed border-line py-2.5 text-[14.5px]', i === new Date().getDay() && 'font-extrabold text-wine')}><span>{WD[i]}</span><span>{h.closed ? 'Closed' : `${t12(h.open)} – ${t12(h.close)}`}</span></div>)}</div>
          <p className="mt-4 text-sm muted">We’re pickup only. Choose your pickup slot at checkout.</p>
        </div>
        <div className="card card-b">
          <h2 className="font-sans text-xl font-extrabold">Send us a message</h2>
          {sent ? (
            <div className="okbox mt-4 flex items-center gap-2"><Check size={18} /> Thanks! We’ve received your message and will reply soon.<button className="btn btn-ghost btn-xs ml-auto" onClick={() => setSent(false)}>Send another</button></div>
          ) : (
            <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
              {err && <p className="errbox" role="alert">{err}</p>}
              <Field label="Name" htmlFor="cn" error={errors.name?.message}><input id="cn" className={cn('in', errors.name && 'err')} {...register('name')} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" htmlFor="ce" error={errors.email?.message}><input id="ce" type="email" className={cn('in', errors.email && 'err')} {...register('email')} /></Field>
                <Field label="Phone (optional)" htmlFor="cp"><input id="cp" className="in" {...register('phone')} /></Field>
              </div>
              <Field label="Message" htmlFor="cm" error={errors.message?.message}><textarea id="cm" className={cn('in', errors.message && 'err')} {...register('message')} /></Field>
              <button className="btn btn-p self-start" disabled={isSubmitting}>{isSubmitting && <Spinner />} Send message</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
