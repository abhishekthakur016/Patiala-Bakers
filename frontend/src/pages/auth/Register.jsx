import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { apiError } from '../../api/client.js';
import { Field, Logo, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../utils/format.js';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().optional(),
  password: z.string().min(8, 'Use at least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function Register() {
  const { register: signUp } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [err, setErr] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async ({ confirm, ...v }) => {
    setErr('');
    try {
      await signUp(v);
      toast.success('Account created');
      const next = params.get('next');
      nav(next && next.startsWith('/') ? next : '/account', { replace: true });
    } catch (e) {
      const ae = apiError(e);
      setErr(ae.message);
      Object.entries(ae.fields).forEach(([k, m]) => setError(k, { message: m }));
    }
  });
  return (
    <div className="wrap flex justify-center py-16">
      <form className="card card-b w-full max-w-md" onSubmit={onSubmit} noValidate>
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="text-center text-4xl text-wine-ink">Create an account</h1>
        <p className="mb-6 mt-1 text-center text-sm muted">Track orders, reorder favourites and check out faster.</p>
        {err && <p className="errbox mb-4" role="alert">{err}</p>}
        <div className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="rn" error={errors.name?.message}><input id="rn" autoComplete="name" className={cn('in', errors.name && 'err')} {...register('name')} /></Field>
          <Field label="Email" htmlFor="re" error={errors.email?.message}><input id="re" type="email" autoComplete="email" className={cn('in', errors.email && 'err')} {...register('email')} /></Field>
          <Field label="Mobile (optional)" htmlFor="rp"><input id="rp" autoComplete="tel" className="in" {...register('phone')} /></Field>
          <Field label="Password" htmlFor="rw" error={errors.password?.message}><input id="rw" type="password" autoComplete="new-password" className={cn('in', errors.password && 'err')} {...register('password')} /></Field>
          <Field label="Confirm password" htmlFor="rc" error={errors.confirm?.message}><input id="rc" type="password" autoComplete="new-password" className={cn('in', errors.confirm && 'err')} {...register('confirm')} /></Field>
          <button className="btn btn-p btn-lg w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />} Create account</button>
        </div>
        <p className="mt-5 text-center text-sm">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
