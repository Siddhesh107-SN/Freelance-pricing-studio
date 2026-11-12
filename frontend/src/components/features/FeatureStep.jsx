import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field } from '../common/ui.jsx';
import { formatINR } from '../../utils/currency.js';
import { COMPLEXITY_HOURS, num } from '../../utils/formatting.js';

const PRICE_KEY = { basic: 'basic_price', intermediate: 'intermediate_price', advanced: 'advanced_price' };
const EMPTY = { name: '', description: '', unit_price: '', estimated_hours: '', internal_cost: '' };

export default function FeatureStep({ est, features, errors }) {
  const { state, toggleFeature, setQty, addCustom, updateCustom, removeCustom } = est;
  const { complexity } = state.project;
  const [draft, setDraft] = useState(EMPTY);
  const [draftError, setDraftError] = useState('');

  const add = () => {
    if (!draft.name.trim()) return setDraftError('Give the feature a name.');
    if ([draft.unit_price, draft.estimated_hours, draft.internal_cost].some((v) => num(v) < 0)) return setDraftError('Values cannot be negative.');
    setDraftError('');
    addCustom(draft);
    return setDraft(EMPTY);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What does this project need?</h1>
      {errors.features && <p role="alert" className="text-sm text-red-600">{errors.features}</p>}
      {!features.length && <p className="text-sm text-gray-500">No active features for this category yet. Add them on the Pricing page, or add a custom feature below.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const on = !!state.selected[f.id];
          return (
            <div key={f.id} className={`rounded-2xl border p-4 transition ${on ? 'border-ink bg-white ring-1 ring-ink' : 'border-line bg-white hover:border-ink'}`}>
              <button type="button" aria-pressed={on} aria-label={f.name} onClick={() => toggleFeature(f.id)} className="block w-full text-left">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium">{f.name}</span>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>{on && <Check className="h-3 w-3" />}</span>
                </span>
                {f.description && <span className="mt-1 block text-xs text-gray-500">{f.description}</span>}
                <span className="mt-3 flex items-baseline justify-between">
                  <span className="text-lg font-semibold tabular-nums">{formatINR(f[PRICE_KEY[complexity]])}</span>
                  <span className="text-xs text-gray-500">{(num(f.estimated_hours) * COMPLEXITY_HOURS[complexity]).toFixed(1)} h</span>
                </span>
              </button>
              {on && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Quantity</span>
                  <button aria-label={`Decrease ${f.name} quantity`} className="rounded border border-line p-1" onClick={() => setQty(f.id, state.selected[f.id].qty - 1)}><Minus className="h-3 w-3" /></button>
                  <span className="w-6 text-center tabular-nums" data-testid={`qty-${f.id}`}>{state.selected[f.id].qty}</span>
                  <button aria-label={`Increase ${f.name} quantity`} className="rounded border border-line p-1" onClick={() => setQty(f.id, state.selected[f.id].qty + 1)}><Plus className="h-3 w-3" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section aria-label="Custom features" className="space-y-3">
        <h2 className="text-lg font-semibold">Custom features</h2>
        {state.custom.map((c, i) => (
          <Card key={i} className="grid items-end gap-3 sm:grid-cols-6">
            <Field label="Name" className="sm:col-span-2" error={errors[`custom.${i}`]}><input value={c.name} onChange={(e) => updateCustom(i, { name: e.target.value })} /></Field>
            <Field label="Price (INR)"><input type="number" min="0" value={c.unit_price} onChange={(e) => updateCustom(i, { unit_price: e.target.value })} /></Field>
            <Field label="Hours"><input type="number" min="0" value={c.estimated_hours} onChange={(e) => updateCustom(i, { estimated_hours: e.target.value })} /></Field>
            <Field label="Internal cost"><input type="number" min="0" value={c.internal_cost} onChange={(e) => updateCustom(i, { internal_cost: e.target.value })} /></Field>
            <Button variant="ghost" aria-label={`Remove ${c.name || 'custom feature'}`} onClick={() => removeCustom(i)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
        <Card className="grid items-end gap-3 sm:grid-cols-6">
          <Field label="New feature name" className="sm:col-span-2"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Price (INR)"><input type="number" min="0" value={draft.unit_price} onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })} /></Field>
          <Field label="Hours"><input type="number" min="0" value={draft.estimated_hours} onChange={(e) => setDraft({ ...draft, estimated_hours: e.target.value })} /></Field>
          <Field label="Internal cost"><input type="number" min="0" value={draft.internal_cost} onChange={(e) => setDraft({ ...draft, internal_cost: e.target.value })} /></Field>
          <Button variant="secondary" onClick={add}>Add feature</Button>
          <Field label="Description" className="sm:col-span-6" error={draftError}><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
        </Card>
      </section>
    </div>
  );
}
