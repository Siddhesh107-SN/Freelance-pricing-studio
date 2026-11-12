import { useMemo } from 'react';
import { DEV_CATEGORIES, blankState, useEstimateContext } from '../context/EstimateContext.jsx';
import { COMPLEXITY_HOURS, num, str } from '../utils/formatting.js';

export function useEstimate() {
  const { state, dispatch } = useEstimateContext();
  const actions = useMemo(() => ({
    patch: (section, values) => dispatch({ type: 'patch', section, values }),
    set: (key, value) => dispatch({ type: 'set', key, value }),
    maintenance: (values) => dispatch({ type: 'maintenance', values }),
    setCategory: (id) => dispatch({ type: 'category', id }),
    toggleFeature: (id) => dispatch({ type: 'toggle_feature', id }),
    setQty: (id, qty) => dispatch({ type: 'set_qty', id, qty }),
    addCustom: (values) => dispatch({ type: 'custom_add', values }),
    updateCustom: (index, values) => dispatch({ type: 'custom_update', index, values }),
    removeCustom: (index) => dispatch({ type: 'custom_remove', index }),
    updateDev: (index, values) => dispatch({ type: 'dev_update', index, values }),
    addExpense: (values) => dispatch({ type: 'expense_add', values }),
    updateExpense: (index, values) => dispatch({ type: 'expense_update', index, values }),
    removeExpense: (index) => dispatch({ type: 'expense_remove', index }),
    goto: (step) => dispatch({ type: 'step', step }),
    saved: (estimate) => dispatch({ type: 'saved', estimate }),
    load: (s) => dispatch({ type: 'load', state: s }),
    reset: () => dispatch({ type: 'reset' }),
  }), [dispatch]);
  return { state, ...actions };
}

export function toPayload(s, features = []) {
  const mult = COMPLEXITY_HOURS[s.project.complexity] || 1;
  const byId = Object.fromEntries(features.map((f) => [String(f.id), f]));
  const p = s.pricing;
  const mt = p.maintenance;
  return {
    client_id: s.clientId || undefined,
    client: { name: s.project.client_name.trim(), company: s.project.company || null, email: s.project.email || null, phone: s.project.phone || null },
    project_name: s.project.project_name.trim() || 'Untitled project',
    project_description: s.project.project_description || '',
    project_type: s.project.project_type || '',
    category_id: s.project.category_id,
    complexity: s.project.complexity,
    pricing_method: p.pricing_method,
    pricing: {
      fixed_price: str(p.fixed_price), hourly_rate: str(p.hourly_rate), custom_price: str(p.custom_price), margin_mode: p.margin_mode,
      profit_margin: str(p.profit_margin), markup_pct: str(p.markup_pct), contingency_pct: str(p.contingency_pct),
      contingency_in_client_price: !!p.contingency_in_client_price, discount_pct: str(p.discount_pct),
      additional_charges: str(p.additional_charges), minimum_price: str(p.minimum_price), gst_enabled: !!p.gst_enabled, gst_rate: str(p.gst_rate),
      maintenance: { package: mt.package, billing: mt.billing, custom_amount: mt.custom_amount === '' ? null : str(mt.custom_amount), months: Number(mt.months) || 12 },
    },
    items: [
      ...Object.entries(s.selected).filter(([id]) => byId[id]).map(([id, v]) => ({
        feature_id: Number(id), quantity: v.qty, estimated_hours: (num(byId[id].estimated_hours) * mult).toFixed(2),
      })),
      ...s.custom.map((c) => ({
        name: c.name, description: c.description || '', quantity: Number(c.quantity) || 1, unit_price: str(c.unit_price),
        estimated_hours: str(c.estimated_hours), internal_cost: str(c.internal_cost),
      })),
    ],
    dev_allocation: s.dev.filter((d) => num(d.hours) > 0).map((d) => ({
      category: d.category, estimated_hours: str(d.hours), team_member_id: d.team_member_id ? Number(d.team_member_id) : null,
      completion_days: d.completion_days === '' ? null : str(d.completion_days),
    })),
    expenses: s.expenses.map((e) => ({ name: e.name.trim(), category: e.category, amount: str(e.amount), expense_type: e.expense_type, billing_type: e.billing_type, notes: e.notes || null })),
    milestones: s.milestones.map((m) => ({ milestone_name: m.milestone_name.trim(), percentage: str(m.percentage) })),
    timeline_override_days: s.timeline_override_days === '' ? null : Number(s.timeline_override_days),
  };
}

export function fromEstimate(e) {
  const b = blankState();
  const selected = {};
  const custom = [];
  e.items.forEach((i) => {
    if (i.feature_id != null) selected[i.feature_id] = { qty: i.quantity };
    else custom.push({
      name: i.feature_name_snapshot, description: i.description_snapshot || '', quantity: i.quantity, unit_price: String(i.unit_price),
      estimated_hours: String(num(i.estimated_hours) / i.quantity), internal_cost: String(num(i.internal_cost) / i.quantity),
    });
  });
  const dev = DEV_CATEGORIES.map((category) => {
    const a = (e.dev_allocation || []).find((x) => x.category === category);
    return { category, hours: a ? String(a.hours) : '', team_member_id: a?.team_member_id ?? null, completion_days: a?.completion_days ?? '' };
  });
  (e.dev_allocation || []).filter((a) => !DEV_CATEGORIES.includes(a.category)).forEach((a) => dev.push({
    category: a.category, hours: String(a.hours), team_member_id: a.team_member_id ?? null, completion_days: a.completion_days ?? '',
  }));
  const p = e.adjustments || {};
  return {
    ...b, id: e.id, clientId: e.client_id, saved: e, step: 0,
    project: {
      project_name: e.project_name, client_name: e.client?.name || '', company: e.client?.company || '', email: e.client?.email || '',
      phone: e.client?.phone || '', project_description: e.project_description || '', category_id: e.category_id,
      project_type: e.project_type || '', complexity: e.complexity,
    },
    selected, custom, dev, timeline_override_days: e.timeline_override_days ?? '',
    expenses: e.expenses.map((x) => ({ name: x.name, category: x.category, amount: String(x.amount), expense_type: x.expense_type, billing_type: x.billing_type, notes: x.notes || '' })),
    pricing: { ...b.pricing, ...p, pricing_method: e.pricing_method, maintenance: { ...b.pricing.maintenance, ...(p.maintenance || {}), custom_amount: p.maintenance?.custom_amount ?? '' } },
    milestones: e.milestones.length ? e.milestones.map((m) => ({ milestone_name: m.milestone_name, percentage: String(num(m.percentage)) })) : b.milestones,
  };
}
