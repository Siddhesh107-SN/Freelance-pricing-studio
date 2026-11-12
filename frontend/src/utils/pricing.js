// Live, display-only mirror of backend/app/services/calculation_service.py.
// The backend is the authority: it recalculates everything before saving.
import { num } from './formatting.js';

const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
export const MAINTENANCE_PRICES = { basic: 1500, standard: 3000, premium: 5000 };
export const ANNUAL_MONTHS = 12;

export function annualiseExpense(amount, expenseType) {
  const a = num(amount);
  if (expenseType === 'recurring') return r2(a * ANNUAL_MONTHS);
  return r2(a);
}

export function computeLocal({ method, items = [], alloc = [], expenses = [], pricing = {}, hoursPerDay = 6, timelineOverride = null }) {
  const allocHours = alloc.reduce((s, a) => s + num(a.hours), 0);
  const useAlloc = allocHours > 0;
  const totalHours = useAlloc ? allocHours : items.reduce((s, i) => s + num(i.hours), 0);
  const internalDev = r2(useAlloc ? alloc.reduce((s, a) => s + num(a.hours) * num(a.rate), 0) : items.reduce((s, i) => s + num(i.internal_cost), 0));

  const itemsTotal = items.reduce((s, i) => s + r2(num(i.unit_price) * num(i.quantity || 1)), 0);
  const devPrice = r2({ fixed: num(pricing.fixed_price), hourly: totalHours * num(pricing.hourly_rate), feature: itemsTotal, custom: num(pricing.custom_price) }[method] ?? 0);

  const clientPaidTotal = r2(expenses.filter((e) => e.billing_type === 'client_billed').reduce((s, e) => s + annualiseExpense(e.amount, e.expense_type), 0));
  const absorbedTotal = r2(expenses.filter((e) => e.billing_type === 'absorbed').reduce((s, e) => s + annualiseExpense(e.amount, e.expense_type), 0));

  const clientRecurring = r2(expenses.filter((e) => e.expense_type === 'recurring' && e.billing_type === 'client_billed').reduce((s, e) => s + num(e.amount), 0));
  const absorbedRecurring = r2(expenses.filter((e) => e.expense_type === 'recurring' && e.billing_type === 'absorbed').reduce((s, e) => s + num(e.amount), 0));

  const contingency = r2(((internalDev + absorbedTotal) * num(pricing.contingency_pct)) / 100);
  const totalInternal = r2(internalDev + absorbedTotal + contingency);
  const billedContingency = pricing.contingency_in_client_price ? contingency : 0;
  const subtotal = r2(devPrice + billedContingency + num(pricing.additional_charges) + clientPaidTotal);
  const discount = r2((subtotal * num(pricing.discount_pct)) / 100);
  const taxable = r2(subtotal - discount);
  const gstRate = pricing.gst_enabled ? num(pricing.gst_rate) : 0;
  const gst = r2((taxable * gstRate) / 100);
  const final = r2(taxable + gst);

  const developmentRevenue = r2(taxable - clientPaidTotal);
  const warnings = [];
  let profitEvaluable = true;
  let profit = null;
  let margin = null;

  if (totalInternal === 0) {
    profitEvaluable = false;
    profit = null;
    margin = null;
    warnings.push('Internal cost is ₹0. Enter developer hours in Step 3 or internal expenses in Step 4 so profit can be evaluated.');
  } else {
    profitEvaluable = true;
    profit = r2(developmentRevenue - totalInternal);
    margin = developmentRevenue > 0 ? r2((profit / developmentRevenue) * 100) : 0;
  }

  let suggestedDev = null;
  let suggestedRevenue = null;
  let suggestedClientPrice = null;

  if (totalInternal > 0) {
    let target = totalInternal;
    const mode = pricing.margin_mode || 'margin';
    if (mode === 'margin') target = totalInternal / (1 - num(pricing.profit_margin) / 100);
    if (mode === 'markup') target = totalInternal * (1 + num(pricing.markup_pct) / 100);
    let devTarget = r2(target);
    if (num(pricing.minimum_price) > 0) devTarget = Math.max(devTarget, num(pricing.minimum_price));
    suggestedDev = devTarget;
    suggestedRevenue = devTarget;
    const suggBeforeGst = r2(suggestedDev + clientPaidTotal);
    suggestedClientPrice = pricing.gst_enabled && gstRate > 0 ? r2(suggBeforeGst * (1 + gstRate / 100)) : suggBeforeGst;
  }

  const byDev = {};
  (useAlloc ? alloc : items).forEach((l) => {
    const k = l.team_member_id ?? 'unassigned';
    byDev[k] = (byDev[k] || 0) + num(l.hours);
  });
  const maxHours = Math.max(0, ...Object.values(byDev));
  const auto = hoursPerDay > 0 ? Math.ceil(maxHours / hoursPerDay) : 0;

  const mt = pricing.maintenance || { package: 'none' };
  const monthly = mt.package === 'none' ? 0 : mt.billing === 'custom' ? num(mt.custom_amount) : MAINTENANCE_PRICES[mt.package] || 0;
  const months = Math.max(Number(mt.months) || 12, 1);
  const maintenanceAnnual = r2(monthly * 12);
  const firstYearTotal = r2(final + monthly * months);

  const belowMinimum = num(pricing.minimum_price) > 0 && developmentRevenue < num(pricing.minimum_price);
  if (belowMinimum) warnings.push('Price before GST is below the minimum acceptable project price.');
  if (profit !== null && profit < 0) warnings.push('Estimated profit is negative.');
  if (devPrice === 0 && method !== 'custom') warnings.push('Development price is zero.');

  return {
    total_hours: r2(totalHours),
    hours_by_developer: byDev,
    development_price: devPrice,
    deployment_cost: clientPaidTotal,
    client_billed_expenses: clientPaidTotal,
    client_paid_total: clientPaidTotal,
    subtotal,
    discount_amount: discount,
    taxable_amount: taxable,
    gst_rate: gstRate,
    gst_amount: gst,
    final_client_price: final,
    internal_development_cost: internalDev,
    internal_expenses: absorbedTotal,
    absorbed_total: absorbedTotal,
    contingency_amount: contingency,
    total_internal_cost: totalInternal,
    revenue_excluding_gst: taxable,
    development_revenue: developmentRevenue,
    profit_evaluable: profitEvaluable,
    estimated_profit: profit,
    profit_margin: margin,
    suggested_revenue: suggestedRevenue,
    suggested_development_price: suggestedDev,
    suggested_client_price: suggestedClientPrice,
    maintenance_monthly: monthly,
    maintenance_annual: maintenanceAnnual,
    first_year_total: firstYearTotal,
    recurring_client_monthly: clientRecurring,
    recurring_absorbed_monthly: absorbedRecurring,
    auto_delivery_days: auto,
    estimated_delivery_days: timelineOverride != null && timelineOverride !== '' ? num(timelineOverride) : auto,
    below_minimum: belowMinimum,
    warnings,
  };
}

export function paymentSchedule(finalPrice, milestones = [], deploymentTotal = 0) {
  const final = r2(finalPrice);
  const depTotal = r2(deploymentTotal);
  if (!milestones.length) return { rows: [], warning: null, shortfall: 0 };
  const pairs = milestones.map((m) => [m.milestone_name || m.name, num(m.percentage)]);
  const baseRows = [];
  let running = 0;
  pairs.forEach(([name, pct], idx) => {
    const isLast = idx === pairs.length - 1;
    const amt = isLast ? r2(final - running) : r2((final * pct) / 100);
    running = r2(running + amt);
    baseRows.push({ milestone_name: name, name, percentage: pct, amount: amt, sequence_number: idx + 1, is_deployment: false });
  });
  const rows = [...baseRows];
  let warning = null;
  let shortfall = 0;
  if (depTotal > 0 && rows.length > 0) {
    const last = rows[rows.length - 1];
    const lastAmount = last.amount;
    const depRowAmount = Math.min(depTotal, lastAmount);
    last.amount = r2(lastAmount - depRowAmount);
    const depRow = {
      milestone_name: 'Deployment & setup expenses (before deployment)',
      name: 'Deployment & setup expenses (before deployment)',
      percentage: null,
      amount: depRowAmount,
      sequence_number: rows.length,
      is_deployment: true,
    };
    rows.splice(rows.length - 1, 0, depRow);
    rows.forEach((r, i) => { r.sequence_number = i + 1; });
    if (depTotal > lastAmount) {
      shortfall = r2(depTotal - lastAmount);
      const fmt = shortfall.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      warning = `Deployment expenses exceed the final milestone by ₹${fmt}. Collect ₹${fmt} more before deployment, e.g. raise the advance %.`;
    }
  }
  return { rows, warning, shortfall };
}
