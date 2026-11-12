import { Download, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, ErrorBanner } from '../common/ui.jsx';
import { useToast } from '../common/Toast.jsx';
import DocumentPreview from '../quotation/DocumentPreview.jsx';
import MilestoneEditor from '../quotation/MilestoneEditor.jsx';
import { estimateService } from '../../services/estimateService.js';
import { quotationService } from '../../services/quotationService.js';
import { errorMessage } from '../../services/api.js';
import { formatINR } from '../../utils/currency.js';
import { formatDate, num } from '../../utils/formatting.js';
import { paymentSchedule } from '../../utils/pricing.js';
import { milestonesValid } from '../../utils/validation.js';

const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

export default function ReviewStep({ est, onSave, saving }) {
  const { state, set } = est;
  const e = state.saved;
  const notify = useToast();
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState(e?.status || 'Draft');
  const [error, setError] = useState(null);
  useEffect(() => setStatus(e?.status || 'Draft'), [e?.status]);

  if (!e) return <ErrorBanner message="The estimate has not been saved yet. Go back and press Continue to save it." />;
  const cd = e.calc_details || {};
  const money = (v) => formatINR(v, 2);

  const clientExpenses = (e.expenses || []).filter((x) => x.billing_type === 'client_billed');
  const deploymentItems = clientExpenses.map((x) => ({
    ...x,
    annual_amount: x.expense_type === 'recurring' ? num(x.amount) * 12 : num(x.amount),
  }));
  const deploymentCost = num(cd.client_paid_total ?? cd.client_billed_expenses ?? deploymentItems.reduce((s, x) => s + x.annual_amount, 0));
  const devPrice = num(cd.development_price ?? (num(e.subtotal) - deploymentCost - num(cd.billed_contingency || 0) - num(cd.additional_charges || 0)));

  const mt = (e.adjustments || {}).maintenance || {};
  const hasMaintenance = mt.package && mt.package !== 'none';
  const maintenanceMonthly = num(cd.maintenance_monthly || 0);
  const maintenanceMonths = num(mt.months || 12);
  const maintenanceAnnual = num(cd.maintenance_annual || maintenanceMonthly * 12);

  const profitEvaluable = cd.profit_evaluable !== false && e.estimated_profit != null && num(e.total_internal_cost) > 0;
  const profitDisplay = profitEvaluable ? `${money(e.estimated_profit)} (${num(e.profit_margin)}%)` : 'Not evaluated';

  const schedule = cd.payment_schedule || paymentSchedule(e.final_client_price, state.milestones, deploymentCost);

  const download = async (kind) => {
    setError(null);
    try {
      await estimateService.download(e.id, kind, `${e.estimate_number}-${kind}.pdf`);
      notify('PDF downloaded');
    } catch {
      setPreview(kind);
      notify('Opened quotation preview. Click "Print / Save PDF" to save as PDF without installing GTK.', 'info');
    }
  };
  const changeStatus = async (next) => {
    try { await quotationService.setStatusForEstimate(e.id, next); setStatus(next); notify(`Status set to ${next}`); }
    catch (x) { notify(errorMessage(x), 'error'); }
  };
  const row = (k, v, strong) => <div className={`flex justify-between ${strong ? 'border-t border-ink pt-2 font-semibold' : ''}`}><dt className="text-gray-600">{k}</dt><dd className="tabular-nums">{v}</dd></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your project estimate is ready.</h1>
        <p className="mt-1 text-sm text-gray-500">{e.estimate_number}{e.quotation_number ? ` · ${e.quotation_number}` : ''}</p>
      </div>
      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">Project</h2>
          <p className="font-medium">{e.project_name}</p><p className="text-sm text-gray-600">{e.project_type} · {e.complexity}</p>
          {e.project_description && <p className="mt-2 text-sm">{e.project_description}</p>}</Card>
        <Card><h2 className="mb-2 font-semibold">Client</h2>
          <p className="font-medium">{e.client?.name}</p><p className="text-sm text-gray-600">{[e.client?.company, e.client?.email, e.client?.phone].filter(Boolean).join(' · ')}</p></Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-xl font-semibold">Final Bill & Investment Breakdown</h2>
            <p className="text-xs text-gray-500">Transparent summary of development, deployment, and ongoing maintenance</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Client Quotation</span>
        </div>

        {/* 1. Development Cost */}
        <div className="rounded-xl border border-line bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-semibold text-ink">1. Development Cost</span>
              <p className="text-xs text-gray-500">{e.items.length} scope feature{e.items.length === 1 ? '' : 's'} · {num(e.estimated_hours)}h development</p>
            </div>
            <span className="text-lg font-semibold tabular-nums text-ink">{money(devPrice)}</span>
          </div>
          <ul className="divide-y divide-gray-200/60 text-xs text-gray-600 mt-2">
            {e.items.map((i) => (
              <li key={i.id} className="flex justify-between py-1.5">
                <span>{i.feature_name_snapshot}{i.quantity > 1 ? ` (x${i.quantity})` : ''}</span>
                <span className="tabular-nums font-medium text-gray-800">{money(i.total_price)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Deployment Cost */}
        <div className="rounded-xl border border-line bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-semibold text-ink">2. Deployment &amp; Setup Cost</span>
              <p className="text-xs text-gray-500">Hosting, domain, testing &amp; environment launch</p>
            </div>
            <span className="text-lg font-semibold tabular-nums text-ink">{money(deploymentCost)}</span>
          </div>
          {deploymentItems.length ? (
            <ul className="divide-y divide-gray-200/60 text-xs text-gray-600 mt-2">
              {deploymentItems.map((x, i) => (
                <li key={i} className="flex justify-between py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-800">{x.name}</span>
                    <span className="rounded bg-gray-200/70 px-1.5 py-0.5 text-[10px] text-gray-600">{x.category}</span>
                    {x.expense_type === 'recurring' && <span className="text-[10px] text-gray-500">(12 months)</span>}
                  </span>
                  <span className="tabular-nums font-medium text-gray-800">{money(x.annual_amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-gray-400 mt-1">No deployment expenses added (hosting, domain, testing, etc.).</p>
          )}
        </div>

        {/* Additional lines if any (Contingency / Extra charges) */}
        {(num(cd.billed_contingency) > 0 || num(cd.additional_charges) > 0) && (
          <div className="rounded-xl border border-line bg-gray-50/50 p-3 text-xs space-y-1">
            {num(cd.billed_contingency) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Project management &amp; delivery assurance</span>
                <span className="tabular-nums font-medium">{money(cd.billed_contingency)}</span>
              </div>
            )}
            {num(cd.additional_charges) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Additional charges</span>
                <span className="tabular-nums font-medium">{money(cd.additional_charges)}</span>
              </div>
            )}
          </div>
        )}

        {/* One-Time Project Totals */}
        <div className="border-t border-line pt-3 space-y-1.5 text-sm">
          {row('One-Time Subtotal', money(e.subtotal))}
          {num(e.discount_amount) > 0 && row('Discount', `-${money(e.discount_amount)}`)}
          {row('Taxable amount', money(e.taxable_amount))}
          {num(e.gst_amount) > 0 && row(`GST (${num(e.gst_rate)}%)`, money(e.gst_amount))}
          <div className="flex justify-between border-t border-ink pt-2 text-base font-bold">
            <dt>Total Project Price (One-Time)</dt>
            <dd className="tabular-nums text-primary">{money(e.final_client_price)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-xs text-gray-500">
            <dt>Total internal cost: {money(e.total_internal_cost)}</dt>
            <dd>Estimated profit: {profitDisplay}</dd>
          </div>
        </div>
        {(cd.warnings || []).map((w) => <p key={w} className="mt-1 text-xs text-amber-700">{w}</p>)}

        {/* 3. Maintenance Pack (Ongoing Support) */}
        <div className="rounded-xl border border-line bg-amber-50/40 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-ink">3. Maintenance Pack (Ongoing Support)</span>
            {hasMaintenance && maintenanceMonthly > 0 ? (
              <span className="font-semibold tabular-nums text-amber-900">{money(maintenanceMonthly)} / month</span>
            ) : (
              <span className="text-xs text-gray-500 font-medium">None selected</span>
            )}
          </div>
          {hasMaintenance && maintenanceMonthly > 0 ? (
            <div className="text-xs text-gray-600 space-y-1 mt-1">
              <p><strong className="capitalize">{mt.package} Plan:</strong> Bug fixes, security patches, performance monitoring and updates.</p>
              <p className="text-gray-500">Proposed term: {maintenanceMonths} months ({money(maintenanceMonthly * maintenanceMonths)} total for {maintenanceMonths} months)</p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No maintenance plan selected.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-3 font-semibold">Development workload</h2>
          <dl className="space-y-1.5 text-sm">
            {row('Total hours', `${num(e.estimated_hours)} h`)}
            {Object.entries(cd.hours_by_developer || {}).map(([k, h]) => row(`Developer ${k === 'unassigned' ? '(unassigned)' : `#${k}`}`, `${num(h)} h`))}
            {row('Delivery timeline', `${e.estimated_delivery_days} working days`)}
            {row('Internal development cost', money(e.internal_development_cost))}
          </dl></Card>
        <Card><h2 className="mb-3 font-semibold">All expenses</h2>
          {e.expenses.length ? <ul className="space-y-1 text-sm">{e.expenses.map((x, i) => <li key={i} className="flex justify-between"><span>{x.name} <span className="text-gray-500">({x.expense_type}, {x.billing_type === 'client_billed' ? 'client' : 'absorbed'})</span></span><span className="tabular-nums">{money(x.amount)}</span></li>)}</ul> : <p className="text-sm text-gray-500">None.</p>}</Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Payment milestones</h2>
        <MilestoneEditor milestones={state.milestones} onChange={(m) => set('milestones', m)} finalPrice={e.final_client_price} />
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" loading={saving} disabled={!milestonesValid(state.milestones) || !state.dirty} onClick={onSave}>Save milestone changes</Button>
        </div>

        {/* Derived payment schedule */}
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="text-sm font-semibold mb-2">Derived Payment Schedule (with Deployment &amp; Setup)</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-gray-500">
                <th className="py-1">Milestone</th>
                <th className="py-1 text-right">Share</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedule.rows.map((r, i) => (
                <tr key={i} className={r.is_deployment ? 'bg-amber-50/60 font-medium' : ''}>
                  <td className="py-1.5">{r.name || r.milestone_name}</td>
                  <td className="py-1.5 text-right text-gray-500">{r.percentage != null ? `${r.percentage}%` : '—'}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-gray-500">Deployment &amp; setup expenses are deducted from the final milestone, not added to the total.</p>
          {schedule.warning && (
            <div role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 font-medium">
              {schedule.warning}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[['internal', 'Internal project estimate', 'Costs, hourly rates and profit. For the team only.'], ['client', 'Client quotation', 'Client-facing prices, scope, milestones and terms.']].map(([kind, title, text]) => (
          <Card key={kind}>
            <h2 className="font-semibold">{title}</h2><p className="mb-4 text-sm text-gray-600">{text}</p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={state.dirty} onClick={() => setPreview(kind)}><Eye className="h-4 w-4" /> Preview</Button>
              <Button variant={kind === 'client' ? 'accent' : 'primary'} disabled={state.dirty} onClick={() => download(kind)}><Download className="h-4 w-4" /> Download PDF</Button>
            </div>
          </Card>
        ))}
      </div>
      {state.dirty && <p className="text-sm text-amber-700">You have unsaved changes. Save them before generating documents.</p>}

      <Card className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Quotation status</span>
        <select aria-label="Quotation status" className="max-w-[12rem]" value={status} onChange={(ev) => changeStatus(ev.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <span className="text-xs text-gray-500">Created {formatDate(e.created_at)}</span>
      </Card>

      {preview && <DocumentPreview id={e.id} kind={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
