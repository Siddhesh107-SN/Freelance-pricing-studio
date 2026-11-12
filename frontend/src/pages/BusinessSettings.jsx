import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '../components/common/Toast.jsx';
import { Button, ErrorBanner, Field, Spinner } from '../components/common/ui.jsx';
import api, { errorMessage } from '../services/api.js';

const schema = z.object({
  business_name: z.string().trim().min(1, 'Business name is required'),
  tagline: z.string().optional(),
  brand_color: z.string().optional(),
  upi_id: z.string().optional(),
  gstin: z.string().optional(),
  email: z.string().email('Enter a valid email').or(z.literal('')),
  phone: z.string().optional(), whatsapp: z.string().optional(), address: z.string().optional(), website: z.string().optional(),
  default_currency: z.literal('INR'),
  quotation_prefix: z.string().trim().min(1, 'Prefix is required').max(20),
  quotation_validity_days: z.coerce.number().int().min(1).max(365),
  payment_terms: z.string().optional(), revision_policy: z.string().optional(), terms_and_conditions: z.string().optional(),
});

export default function BusinessSettings() {
  const notify = useToast();
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({ resolver: zodResolver(schema) });
  const load = () => api.get('/settings').then((r) => { setLoaded(r.data); reset({ ...r.data, email: r.data.email || '' }); }).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (v) => {
    try {
      const { data } = await api.put('/settings', { ...loaded, ...v, email: v.email || null });
      setLoaded(data); reset({ ...data, email: data.email || '' }); notify('Settings saved');
    } catch (e) { notify(errorMessage(e), 'error'); }
  };
  const uploadLogo = async (file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { const { data } = await api.post('/settings/logo', fd); setLoaded(data); notify('Logo uploaded'); } catch (e) { notify(errorMessage(e), 'error'); }
  };

  if (error) return <div className="py-8"><ErrorBanner message={error} onRetry={() => { setError(null); load(); }} /></div>;
  if (!loaded) return <Spinner />;
  const txt = (k, label, props = {}) => <Field label={label} error={errors[k]?.message}><input aria-label={label} {...register(k)} {...props} /></Field>;
  const area = (k, label) => <Field label={label}><textarea rows={4} aria-label={label} {...register(k)} /></Field>;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Business settings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {txt('business_name', 'Business name')}{txt('tagline', 'Business tagline')}{txt('brand_color', 'Brand color (e.g. #111827 or #2563eb)')}
        {txt('upi_id', 'UPI ID (for quotation QR payments)')}{txt('gstin', 'GSTIN (Tax identification number)')}
        {txt('email', 'Business email', { type: 'email' })}{txt('phone', 'Business phone')}{txt('whatsapp', 'WhatsApp number')}{txt('website', 'Website')}
        {txt('default_currency', 'Default currency', { readOnly: true })}{txt('quotation_prefix', 'Quotation numbering prefix')}{txt('quotation_validity_days', 'Quotation validity (days)', { type: 'number' })}
      </div>
      {area('address', 'Business address')}
      <Field label="Business logo" hint={loaded.logo_path ? `Current file: ${loaded.logo_path}. PNG, JPEG or WebP under 1 MB.` : 'PNG, JPEG or WebP under 1 MB.'}>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadLogo(e.target.files?.[0])} />
      </Field>
      {area('payment_terms', 'Default payment terms')}{area('revision_policy', 'Default revision policy')}{area('terms_and_conditions', 'Default terms and conditions (one per line)')}
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save settings</Button>
    </form>
  );
}
