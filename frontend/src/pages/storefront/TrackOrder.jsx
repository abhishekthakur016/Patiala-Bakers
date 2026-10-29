import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, apiError } from '../../api/client.js';
import OrderView from '../../components/OrderView.jsx';
import { Field, Spinner } from '../../components/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { cn } from '../../utils/format.js';

const schema = z.object({ orderNumber: z.string().trim().min(4, 'Enter your order number, e.g. PB-10432'), email: z.string().trim().email('Enter the email used on the order') });

export default function TrackOrder() {
  const { settings } = useSettings();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    setErr(''); setOrder(null);
    try { const { data } = await api.post('/orders/track', v); setOrder(data.order); } catch (e) { setErr(apiError(e).message); }
  });
  return (
    <>
      <div className="pagehead"><div className="wrap"><p className="eyebrow">Order status</p><h1>Track your order</h1></div></div>
      <div className="wrap grid max-w-4xl gap-8 py-10">
        <form className="card card-b grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]" onSubmit={onSubmit} noValidate>
          <Field label="Order number" htmlFor="on" error={errors.orderNumber?.message}><input id="on" className={cn('in uppercase', errors.orderNumber && 'err')} placeholder="PB-10432" {...register('orderNumber')} /></Field>
          <Field label="Email" htmlFor="em" error={errors.email?.message}><input id="em" type="email" className={cn('in', errors.email && 'err')} {...register('email')} /></Field>
          <div className="flex items-end"><button className="btn btn-p w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />} Find order</button></div>
          {err && <p className="errbox sm:col-span-3" role="alert">{err}</p>}
        </form>
        {order && <div className="card card-b"><h2 className="mb-4 font-sans text-xl font-extrabold">{order.orderNumber}</h2><OrderView order={order} address={settings?.business?.address} /></div>}
      </div>
    </>
  );
}
