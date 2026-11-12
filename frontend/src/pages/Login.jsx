import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { Button, ErrorBanner, Field } from '../components/common/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });

export default function Login() {
  const { user, login, expired } = useAuth();
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit(async (v) => { setError(null); try { await login(v.email, v.password); } catch (e) { setError(errorMessage(e)); } })} className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logic Loops" className="h-9 w-9 rounded-full object-cover" />
          <h1 className="text-2xl font-semibold tracking-tight">Logic Loops</h1>
        </div>
        {expired && <p className="text-sm text-amber-700">Your session expired. Sign in again.</p>}
        <ErrorBanner message={error} />
        <Field label="Email" error={errors.email?.message}><input type="email" autoComplete="username" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><input type="password" autoComplete="current-password" {...register('password')} /></Field>
        <Button type="submit" loading={isSubmitting} className="w-full">Sign in</Button>
      </form>
    </div>
  );
}
