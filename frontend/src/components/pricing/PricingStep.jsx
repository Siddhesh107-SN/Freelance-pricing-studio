import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, Field, Segmented } from '../common/ui.jsx';
import { formatINR } from '../../utils/currency.js';
import { num } from '../../utils/formatting.js';

const METHODS = [
  { value: 'feature', label: 'Feature-based' }, { value: 'fixed', label: 'Fixed price' },
  { value: 'hourly', label: 'Hourly' }, { value: 'custom', label: 'Custom override' },
];
const PACKAGES = [
  { v: 'none', t: 'No maintenance', d: 'One-time project only.' },
  { v: 'basic', t: 'Basic', d: 'Bug fixes, technical support, backups.' },
  { v: 'standard', t: 'Standard', d: 'Basic plus security updates, performance monitoring, minor content updates.' },
  { v: 'premium', t: 'Premium', d: 'Standard plus priority support, advanced monitoring, extra maintenance hours.' },
];
const COLORS = ['#111827', '#16a34a', '#ea580c'];

export default function PricingStep({ est, pricing, verified, serverError, loading, errors }) {
  const { state, patch, maintenance } = est;
  const p = state.pricing;
  const setP = (values) => patch('pricing', values);
  const numField = (key, label, extra = {}) => (
    <Field label={label} error={errors[key]} hint={extra.hint}>
      <input aria-label={label} type="number" min="0" value={p[key]} onChange={(e) => setP({ [key]: e.target.value })} />
    </Field>
  );
  const chart = [
    { name: 'Internal cost', value: Math.max(num(pricing.total_internal_cost), 0) },
    { name: 'Profit', value: Math.max(num(pricing.estimated_profit), 0) },
    { name: 'GST', value: Math.max(num(pricing.gst_amount), 0) },
  ].filter((d) => d.value > 0);

  const deploymentCost = (pricing.client_paid_total ?? pricing.client_billed_expenses ?? pricing.deployment_cost) || 0;
  const targetMarginDisplay = p.margin_mode === 'margin' ? `${p.profit_margin}%` : (p.margin_mode === 'markup' ? `${p.markup_pct}% markup` : 'Cost only');
  const profitMarginFormatted = pricing.profit_margin != null ? `${num(pricing.profit_margin).toFixed(1)}%` : '';
  const profitDisplay = pricing.profit_evaluable === false || pricing.estimated_profit == null || num(pricing.total_internal_cost) === 0
    ? 'Not evaluated'
    : `${formatINR(pricing.estimated_profit, 2)}${profitMarginFormatted ? ` (${profitMarginFormatted})` : ''}`;
  const suggDevDisplay = pricing.suggested_development_price != null ? formatINR(pricing.suggested_development_price, 2) : '—';
  const suggClientDisplay = pricing.suggested_client_price != null ? formatINR(pricing.suggested_client_price, 2) : '—';
  const annualMaint = pricing.maintenance_annual ?? ((pricing.maintenance_monthly || 0) * 12);

  const rows = [
    ['Development price', pricing.development_price],
    ...(deploymentCost > 0 ? [['Deployment & setup cost', deploymentCost]] : []),
    ['Subtotal', pricing.subtotal],
    ...(pricing.discount_amount > 0 ? [['Discount', -pricing.discount_amount]] : []),
    ['Taxable amount', pricing.taxable_amount],
    ...(pricing.gst_amount > 0 ? [['GST', pricing.gst_amount]] : []),
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Let's calculate your final price.</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pricing method</h2>
        <Segmented label="Pricing method" value={p.pricing_method} onChange={(v) => setP({ pricing_method: v })} options={METHODS} />
        <div className="grid gap-4 sm:grid-cols-3">
          {p.pricing_method === 'fixed' && (
            <div className="space-y-1 sm:col-span-2">
              {numField('fixed_price', 'Fixed price (INR)')}
              {pricing.suggested_development_price != null && (
                <button
                  type="button"
                  onClick={() => setP({ fixed_price: String(pricing.suggested_development_price) })}
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  Use suggested price ({formatINR(pricing.suggested_development_price, 2)})
                </button>
              )}
            </div>
          )}
          {p.pricing_method === 'hourly' && numField('hourly_rate', 'Client hourly rate (INR)', { hint: 'Multiplied by total hours.' })}
          {p.pricing_method === 'custom' && (
            <div className="space-y-1 sm:col-span-2">
              {numField('custom_price', 'Custom development price (INR)', { hint: 'Replaces the development price.' })}
              {pricing.suggested_development_price != null && (
                <button
                  type="button"
                  onClick={() => setP({ custom_price: String(pricing.suggested_development_price) })}
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  Use suggested price ({formatINR(pricing.suggested_development_price, 2)})
                </button>
              )}
            </div>
          )}
          {p.pricing_method === 'feature' && <p className="text-sm text-gray-600 sm:col-span-3">Development price is the sum of the selected feature prices.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Business adjustments</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Profit method"><select aria-label="Profit method" value={p.margin_mode} onChange={(e) => setP({ margin_mode: e.target.value })}>
            <option value="margin">Target margin</option><option value="markup">Fixed markup</option><option value="none">Cost only</option></select></Field>
          {p.margin_mode === 'margin' && numField('profit_margin', 'Profit margin (%)', { hint: 'Used for the suggested price.' })}
          {p.margin_mode === 'markup' && numField('markup_pct', 'Markup (%)')}
          {numField('contingency_pct', 'Contingency (%)')}
          {numField('discount_pct', 'Discount (%)')}
          {numField('additional_charges', 'Additional charges (INR)')}
          {numField('minimum_price', 'Minimum acceptable price (INR)')}
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.contingency_in_client_price} onChange={(e) => setP({ contingency_in_client_price: e.target.checked })} />
          Include contingency in the client price (otherwise we absorb it)</label>
        {pricing.suggested_development_price != null && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-gray-50 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Suggested price based on {p.margin_mode === 'margin' ? `${p.profit_margin}% target margin` : (p.margin_mode === 'markup' ? `${p.markup_pct}% markup` : 'internal cost')}
              </p>
              <p className="text-lg font-semibold text-ink">
                {formatINR(pricing.suggested_development_price, 2)}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (Client total{p.gst_enabled ? ' incl. GST' : ''}: {formatINR(pricing.suggested_client_price, 2)})
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setP({ pricing_method: 'custom', custom_price: String(pricing.suggested_development_price) })}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
            >
              Apply suggested price to project
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">GST</h2>
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.gst_enabled} onChange={(e) => setP({ gst_enabled: e.target.checked })} /> Charge GST on this project</label>
        {p.gst_enabled && <div className="max-w-xs">{numField('gst_rate', 'GST rate (%)')}</div>}
        <p className="text-xs text-gray-500">Not every project is subject to GST. Confirm the correct tax treatment for your business before issuing a quotation.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Maintenance (optional)</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {PACKAGES.map((x) => (
            <button key={x.v} type="button" aria-pressed={p.maintenance.package === x.v} onClick={() => maintenance({ package: x.v })}
              className={`rounded-2xl border p-3 text-left text-sm ${p.maintenance.package === x.v ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink'} bg-white`}>
              <span className="block font-medium">{x.t}</span><span className="text-xs text-gray-500">{x.d}</span>
            </button>
          ))}
        </div>
        {p.maintenance.package !== 'none' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Billing"><select aria-label="Maintenance billing" value={p.maintenance.billing} onChange={(e) => maintenance({ billing: e.target.value })}>
              <option value="monthly">Monthly</option><option value="annual">Annual (12 months)</option><option value="custom">Custom amount</option></select></Field>
            {p.maintenance.billing === 'custom' && <Field label="Custom monthly amount (INR)" error={errors.maintenance}>
              <input type="number" min="0" value={p.maintenance.custom_amount} onChange={(e) => maintenance({ custom_amount: e.target.value })} /></Field>}
            <Field label="Months in first-year proposal"><input type="number" min="1" value={p.maintenance.months} onChange={(e) => maintenance({ months: e.target.value })} /></Field>
          </div>
        )}
        {pricing.maintenance_monthly > 0 && <p className="text-sm">{formatINR(pricing.maintenance_monthly)} per month, billed separately from the project price.</p>}
      </section>

      <Card className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Breakdown</h2>
            <span className={`text-xs ${verified ? 'text-green-700' : 'text-gray-500'}`}>{loading ? 'Checking with server...' : verified ? 'Verified by server' : 'Live estimate'}</span>
          </div>
          <dl className="space-y-1.5 text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-gray-600">{k}</dt><dd className="tabular-nums">{formatINR(v, 2)}</dd></div>)}
            <div className="flex justify-between border-t border-ink pt-2 text-base font-semibold"><dt>Final client price</dt><dd className="tabular-nums">{formatINR(pricing.final_client_price, 2)}</dd></div>
            <div className="flex justify-between pt-2"><dt className="text-gray-600">Internal development cost</dt><dd className="tabular-nums">{formatINR(pricing.internal_development_cost, 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Internal (absorbed) expenses</dt><dd className="tabular-nums">{formatINR(pricing.internal_expenses, 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Client-paid deployment expenses</dt><dd className="tabular-nums">{formatINR(deploymentCost, 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Contingency</dt><dd className="tabular-nums">{formatINR(pricing.contingency_amount, 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Total internal cost</dt><dd className="tabular-nums">{formatINR(pricing.total_internal_cost, 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Target margin</dt><dd className="tabular-nums">{targetMarginDisplay}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Estimated profit</dt><dd className={`tabular-nums ${pricing.estimated_profit != null && pricing.estimated_profit < 0 ? 'text-red-600' : (pricing.estimated_profit != null ? 'text-green-700' : 'text-gray-600')}`}>{profitDisplay}</dd></div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Suggested development price</dt>
              <dd className="flex items-center gap-2 tabular-nums">
                <span>{suggDevDisplay}</span>
                {pricing.suggested_development_price != null && (
                  <button
                    type="button"
                    onClick={() => setP({ pricing_method: 'custom', custom_price: String(pricing.suggested_development_price) })}
                    className="text-xs font-semibold text-blue-600 underline hover:text-blue-800"
                  >
                    Apply
                  </button>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Suggested client price</dt>
              <dd className="flex items-center gap-2 tabular-nums">
                <span>{suggClientDisplay}</span>
                {pricing.suggested_development_price != null && (
                  <button
                    type="button"
                    onClick={() => setP({ pricing_method: 'custom', custom_price: String(pricing.suggested_development_price) })}
                    className="text-xs font-semibold text-blue-600 underline hover:text-blue-800"
                  >
                    Apply
                  </button>
                )}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-gray-600">Annual maintenance</dt><dd className="tabular-nums">{formatINR(annualMaint, 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">First-year estimate</dt><dd className="tabular-nums">{formatINR(pricing.first_year_total, 2)}</dd></div>
          </dl>
          {pricing.below_minimum && <p role="alert" className="mt-3 text-sm text-amber-700">Price before GST is below your minimum acceptable price.</p>}
          {(pricing.warnings || []).map((w) => <p key={w} className="mt-1 text-sm text-amber-700">{w}</p>)}
          {serverError && <p role="alert" className="mt-3 text-sm text-red-600">Server check failed: {serverError}</p>}
        </div>
        <div className="h-56" aria-label="Where the client price goes">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {chart.map((d) => <Cell key={d.name} fill={COLORS[['Internal cost', 'Profit', 'GST'].indexOf(d.name)]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
