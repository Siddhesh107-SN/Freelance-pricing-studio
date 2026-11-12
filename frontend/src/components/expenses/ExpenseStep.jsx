import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState } from '../common/ui.jsx';
import { formatINR } from '../../utils/currency.js';
import { num } from '../../utils/formatting.js';

export const EXPENSE_CATEGORIES = [
  'Deployment & server setup',
  'Hosting',
  'Domain registration',
  'Testing & QA',
  'Cloud infrastructure',
  'AI API usage',
  'Third-party subscriptions',
  'Email services',
  'SMS services',
  'Payment gateway charges',
  'Other expenses',
];

export default function ExpenseStep({ est, errors }) {
  const { state, addExpense, updateExpense, removeExpense } = est;
  const sum = (type, billing) => state.expenses.filter((e) => e.expense_type === type && e.billing_type === billing).reduce((s, e) => s + num(e.amount), 0);
  const clientPaidTotal = state.expenses
    .filter((e) => e.billing_type === 'client_billed')
    .reduce((s, e) => s + (e.expense_type === 'recurring' ? num(e.amount) * 12 : num(e.amount)), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What else will this project require?</h1>
      <p className="text-sm text-gray-600">Client-billed deployment and setup expenses (hosting, domain, testing) calculate directly into the project quote. Absorbed ones become internal cost. Recurring expenses are monthly charges.</p>

      <div className="flex flex-wrap gap-2">
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => addExpense({ name: c === 'Other expenses' ? '' : c, category: c, expense_type: 'one_time', billing_type: 'client_billed' })}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-ink"><Plus className="h-3 w-3" />{c}</button>
        ))}
      </div>

      {!state.expenses.length && <EmptyState title="No expenses yet" text="Pick a category above, or skip this step if there are none." />}
      <div className="space-y-3">
        {state.expenses.map((e, i) => (
          <Card key={i} className="grid items-end gap-3 sm:grid-cols-12">
            <div className="sm:col-span-3"><label>Name</label><input aria-label="Expense name" value={e.name} onChange={(ev) => updateExpense(i, { name: ev.target.value })} /></div>
            <div className="sm:col-span-2"><label>Category</label>
              <select aria-label="Expense category" value={e.category} onChange={(ev) => updateExpense(i, { category: ev.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="sm:col-span-2">
              <label>{e.expense_type === 'usage' ? 'Estimated budget (INR)' : 'Amount (INR)'}</label>
              <input aria-label={e.expense_type === 'usage' ? 'Estimated budget' : 'Expense amount'} type="number" min="0" value={e.amount} onChange={(ev) => updateExpense(i, { amount: ev.target.value })} />
            </div>
            <div className="sm:col-span-2"><label>Type</label>
              <select aria-label="Expense type" value={e.expense_type} onChange={(ev) => updateExpense(i, { expense_type: ev.target.value })}>
                <option value="one_time">One-time</option>
                <option value="recurring">Recurring (monthly)</option>
                <option value="yearly">Yearly</option>
                <option value="usage">Usage-based</option>
              </select></div>
            <div className="sm:col-span-2"><label>Billing</label>
              <select aria-label="Expense billing" value={e.billing_type} onChange={(ev) => updateExpense(i, { billing_type: ev.target.value })}><option value="client_billed">Client-billed</option><option value="absorbed">Absorbed by us</option></select></div>
            <Button variant="ghost" aria-label={`Remove ${e.name || 'expense'}`} onClick={() => removeExpense(i)}><Trash2 className="h-4 w-4" /></Button>
            <div className="sm:col-span-12"><input aria-label="Expense notes" placeholder="Notes (optional)" value={e.notes} onChange={(ev) => updateExpense(i, { notes: ev.target.value })} />
              {errors[`expense.${i}`] && <p role="alert" className="mt-1 text-xs text-red-600">{errors[`expense.${i}`]}</p>}</div>
          </Card>
        ))}
      </div>
      <Button variant="secondary" onClick={() => addExpense({})}><Plus className="h-4 w-4" /> Add custom expense</Button>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><p className="text-xs text-gray-500">One-time, client-billed</p><p className="text-xl font-semibold tabular-nums">{formatINR(sum('one_time', 'client_billed'))}</p></Card>
        <Card><p className="text-xs text-gray-500">One-time, absorbed</p><p className="text-xl font-semibold tabular-nums">{formatINR(sum('one_time', 'absorbed'))}</p></Card>
        <Card><p className="text-xs text-gray-500">Recurring per month, client</p><p className="text-xl font-semibold tabular-nums">{formatINR(sum('recurring', 'client_billed'))}</p></Card>
        <Card><p className="text-xs text-gray-500">Recurring per month, absorbed</p><p className="text-xl font-semibold tabular-nums">{formatINR(sum('recurring', 'absorbed'))}</p></Card>
        <Card><p className="text-xs text-gray-500">Deployment &amp; setup total (client)</p><p className="text-xl font-semibold tabular-nums">{formatINR(clientPaidTotal)}</p></Card>
      </div>
    </div>
  );
}
