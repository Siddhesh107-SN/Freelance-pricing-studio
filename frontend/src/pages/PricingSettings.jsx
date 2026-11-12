import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import { useToast } from '../components/common/Toast.jsx';
import { Button, Card, ErrorBanner, Field, Spinner } from '../components/common/ui.jsx';
import api, { errorMessage } from '../services/api.js';
import { formatINR } from '../utils/currency.js';
import { num } from '../utils/formatting.js';
import { milestonesValid } from '../utils/validation.js';
import MilestoneEditor from '../components/quotation/MilestoneEditor.jsx';

const blankFeature = (category_id) => ({ category_id, name: '', description: '', basic_price: '0', intermediate_price: '0', advanced_price: '0', estimated_hours: '0', default_internal_cost: '0', active: true });

export default function PricingSettings() {
  const notify = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [catId, setCatId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [catDraft, setCatDraft] = useState(null);
  const [del, setDel] = useState(null);
  const [defaults, setDefaults] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cats, feats, members, settings] = await Promise.all([
        api.get('/categories', { params: { include_inactive: true } }), api.get('/features', { params: { include_inactive: true } }), api.get('/team-members'), api.get('/settings')]);
      setData({ cats: cats.data, feats: feats.data, members: members.data });
      setDefaults((d) => d || { ...settings.data, milestones: (settings.data.extra_defaults?.milestones || []).map(([milestone_name, percentage]) => ({ milestone_name, percentage: String(percentage) })) });
      setCatId((c) => c ?? cats.data[0]?.id ?? null);
    } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => { try { await fn(); if (ok) notify(ok); await load(); return true; } catch (e) { notify(errorMessage(e), 'error'); return false; } };
  if (error) return <div className="py-8"><ErrorBanner message={error} onRetry={load} /></div>;
  if (!data) return <Spinner />;

  const feats = data.feats.filter((f) => f.category_id === catId);
  const move = (i, d) => {
    const ids = feats.map((f) => f.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.post('/features/reorder', { ids }));
  };
  const saveFeature = async () => {
    const f = editing;
    const body = { ...f, estimated_hours: String(num(f.estimated_hours)), basic_price: String(num(f.basic_price)), intermediate_price: String(num(f.intermediate_price)), advanced_price: String(num(f.advanced_price)), default_internal_cost: String(num(f.default_internal_cost)) };
    if (!(await run(() => (f.id ? api.put(`/features/${f.id}`, body) : api.post('/features', body)), 'Feature saved'))) return;
    setEditing(null);
  };
  const saveDefaults = () => {
    if (!milestonesValid(defaults.milestones)) return notify('Milestones must add up to 100%.', 'error');
    const { milestones, id, logo_path, ...rest } = defaults; // eslint-disable-line no-unused-vars
    return run(() => api.put('/settings', { ...rest, extra_defaults: { ...rest.extra_defaults, milestones: milestones.map((m) => [m.milestone_name, num(m.percentage)]) } }), 'Defaults saved');
  };
  const dset = (k, v) => setDefaults({ ...defaults, [k]: v });
  const xset = (k, v) => setDefaults({ ...defaults, extra_defaults: { ...defaults.extra_defaults, [k]: v } });
  const inp = (label, key, props = {}) => <Field label={label}><input aria-label={label} value={defaults[key] ?? ''} onChange={(e) => dset(key, e.target.value)} {...props} /></Field>;

  return (
    <div className="space-y-10 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Pricing configuration</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Service categories</h2>
        <div className="flex flex-wrap items-center gap-2">
          {data.cats.map((c) => (
            <button key={c.id} onClick={() => setCatId(c.id)} className={`rounded-full border px-3 py-1.5 text-sm ${catId === c.id ? 'border-ink bg-ink text-white' : 'border-line bg-white'} ${c.active ? '' : 'opacity-50'}`}>{c.name}</button>
          ))}
          <Button variant="secondary" onClick={() => setCatDraft({ name: '', description: '', active: true, sort_order: data.cats.length })}><Plus className="h-4 w-4" /> Category</Button>
        </div>
        {catDraft && (
          <Card className="grid items-end gap-3 sm:grid-cols-5">
            <Field label="Name" className="sm:col-span-2"><input aria-label="Category name" value={catDraft.name} onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })} /></Field>
            <Field label="Description" className="sm:col-span-2"><input value={catDraft.description || ''} onChange={(e) => setCatDraft({ ...catDraft, description: e.target.value })} /></Field>
            <label className="flex items-center gap-2"><input type="checkbox" checked={catDraft.active} onChange={(e) => setCatDraft({ ...catDraft, active: e.target.checked })} /> Active</label>
            <div className="flex gap-2 sm:col-span-5"><Button onClick={async () => { if (await run(() => (catDraft.id ? api.put(`/categories/${catDraft.id}`, catDraft) : api.post('/categories', catDraft)), 'Category saved')) setCatDraft(null); }}>Save category</Button>
              <Button variant="ghost" onClick={() => setCatDraft(null)}>Cancel</Button></div>
          </Card>
        )}
        {catId && <Button variant="ghost" onClick={() => setCatDraft(data.cats.find((c) => c.id === catId))}><Pencil className="h-4 w-4" /> Edit selected category</Button>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Features</h2>
          <Button variant="secondary" disabled={!catId} onClick={() => setEditing(blankFeature(catId))}><Plus className="h-4 w-4" /> Add feature</Button></div>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[780px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-gray-500"><th className="p-3">Feature</th><th className="p-3 text-right">Basic</th><th className="p-3 text-right">Intermediate</th><th className="p-3 text-right">Advanced</th><th className="p-3 text-right">Hours</th><th className="p-3">Active</th><th className="p-3" /></tr></thead>
            <tbody>{feats.map((f, i) => (
              <tr key={f.id} className={`border-b border-line last:border-0 ${f.active ? '' : 'text-gray-400'}`}>
                <td className="p-3 font-medium">{f.name}</td>
                {['basic_price', 'intermediate_price', 'advanced_price'].map((k) => <td key={k} className="p-3 text-right tabular-nums">{formatINR(f[k])}</td>)}
                <td className="p-3 text-right tabular-nums">{num(f.estimated_hours)}</td><td className="p-3">{f.active ? 'Yes' : 'No'}</td>
                <td className="p-3"><div className="flex justify-end">
                  <Button variant="ghost" aria-label={`Move ${f.name} up`} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" aria-label={`Move ${f.name} down`} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" aria-label={`Delete ${f.name}`} onClick={() => setDel(f)}><Trash2 className="h-4 w-4" /></Button></div></td>
              </tr>))}</tbody>
          </table>
        </div>
        {editing && (
          <Card className="grid gap-3 sm:grid-cols-4">
            <Field label="Name" className="sm:col-span-2"><input aria-label="Feature name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Category"><select value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: Number(e.target.value) })}>{data.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <label className="flex items-center gap-2 self-end"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
            <Field label="Description" className="sm:col-span-4"><input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            {[['basic_price', 'Basic price'], ['intermediate_price', 'Intermediate price'], ['advanced_price', 'Advanced price'], ['estimated_hours', 'Estimated hours'], ['default_internal_cost', 'Default internal cost']].map(([k, l]) => (
              <Field key={k} label={l}><input aria-label={l} type="number" min="0" value={editing[k]} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} /></Field>))}
            <div className="flex items-end gap-2 sm:col-span-4"><Button onClick={saveFeature}>Save feature</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Developers</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.members.map((m) => <MemberCard key={m.id} m={m} onSave={(body) => run(() => api.put(`/team-members/${m.id}`, body), 'Developer saved')} />)}
        </div>
        {data.members.length < 2 && <Button variant="secondary" onClick={() => run(() => api.post('/team-members', { name: `Developer ${data.members.length + 1}`, internal_hourly_rate: '500' }), 'Developer added')}>Add developer</Button>}
      </section>

      {defaults && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Business defaults</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {inp('Default profit margin (%)', 'default_profit_margin', { type: 'number' })}
            {inp('Default contingency (%)', 'default_contingency', { type: 'number' })}
            {inp('Default GST rate (%)', 'default_gst_rate', { type: 'number' })}
            {inp('Quotation validity (days)', 'quotation_validity_days', { type: 'number' })}
            <Field label="Revision limit"><input aria-label="Revision limit" type="number" min="0" value={defaults.extra_defaults?.revision_limit ?? 2} onChange={(e) => xset('revision_limit', Number(e.target.value))} /></Field>
            <Field label="Working hours per day"><input aria-label="Working hours per day" type="number" min="1" max="24" value={defaults.extra_defaults?.hours_per_day ?? 6} onChange={(e) => xset('hours_per_day', Number(e.target.value))} /></Field>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!defaults.default_gst_enabled} onChange={(e) => dset('default_gst_enabled', e.target.checked)} /> Charge GST by default</label>
          <div className="grid gap-4 sm:grid-cols-3">
            {['basic', 'standard', 'premium'].map((k) => (
              <Field key={k} label={`Maintenance ${k} (INR per month)`}><input type="number" min="0" value={defaults.extra_defaults?.maintenance_prices?.[k] ?? ''} onChange={(e) => xset('maintenance_prices', { ...defaults.extra_defaults?.maintenance_prices, [k]: e.target.value })} /></Field>))}
          </div>
          <div><p className="mb-2 text-sm font-medium">Default payment milestones</p><MilestoneEditor milestones={defaults.milestones} onChange={(m) => dset('milestones', m)} finalPrice={100} /></div>
          <Button onClick={saveDefaults}>Save defaults</Button>
        </section>
      )}

      <ConfirmDialog open={!!del} danger title="Delete this feature?" text="Existing estimates keep their saved prices. New estimates will no longer offer it." confirmLabel="Delete"
        onCancel={() => setDel(null)} onConfirm={() => { run(() => api.delete(`/features/${del.id}`), 'Feature deleted'); setDel(null); }} />
    </div>
  );
}

function MemberCard({ m, onSave }) {
  const [v, setV] = useState({ name: m.name, internal_hourly_rate: String(m.internal_hourly_rate), active: m.active });
  return (
    <Card className="grid items-end gap-3 sm:grid-cols-3">
      <Field label="Name"><input aria-label="Developer name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Hourly rate (INR)"><input aria-label="Developer hourly rate" type="number" min="0" value={v.internal_hourly_rate} onChange={(e) => setV({ ...v, internal_hourly_rate: e.target.value })} /></Field>
      <Button variant="secondary" onClick={() => onSave({ ...v, internal_hourly_rate: String(num(v.internal_hourly_rate)) })}>Save</Button>
    </Card>
  );
}
