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

const schema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const next = params.get('next');
  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try {
      const u = await login(v.email, v.password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      nav(next && next.startsWith('/') ? next : u.role === 'staff' ? '/admin' : '/account', { replace: true });
    } catch (e) { setErr(apiError(e).message); }
  });
  return (
    <div className="wrap flex justify-center py-16">
      <form className="card card-b w-full max-w-md" onSubmit={onSubmit} noValidate>
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="text-center text-4xl text-wine-ink">Sign in</h1>
        <p className="mb-6 mt-1 text-center text-sm muted">Customers and staff sign in here.</p>
        {err && <p className="errbox mb-4" role="alert">{err}</p>}
        <div className="flex flex-col gap-4">
          <Field label="Email" htmlFor="le" error={errors.email?.message}><input id="le" type="email" autoComplete="email" className={cn('in', errors.email && 'err')} {...register('email')} /></Field>
          <Field label="Password" htmlFor="lp" error={errors.password?.message}><input id="lp" type="password" autoComplete="current-password" className={cn('in', errors.password && 'err')} {...register('password')} /></Field>
          <button className="btn btn-p btn-lg w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />} Sign in</button>
        </div>
        <p className="mt-5 text-center text-sm">New here? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></p>
      </form>
    </div>
  );
}
