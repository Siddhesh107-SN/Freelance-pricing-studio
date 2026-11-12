import { useEffect, useMemo, useState } from 'react';
import { estimateService } from '../services/estimateService.js';
import { COMPLEXITY_HOURS, num } from '../utils/formatting.js';
import { computeLocal } from '../utils/pricing.js';
import { toPayload } from './useEstimate.js';

const PRICE_KEY = { basic: 'basic_price', intermediate: 'intermediate_price', advanced: 'advanced_price' };

export function localInput(state, features = [], members = [], hoursPerDay = 6) {
  const mult = COMPLEXITY_HOURS[state.project.complexity] || 1;
  const byId = Object.fromEntries(features.map((f) => [String(f.id), f]));
  const rate = Object.fromEntries(members.map((m) => [String(m.id), num(m.internal_hourly_rate)]));
  const items = [
    ...Object.entries(state.selected).filter(([id]) => byId[id]).map(([id, v]) => ({
      unit_price: num(byId[id][PRICE_KEY[state.project.complexity]]), quantity: v.qty,
      hours: num(byId[id].estimated_hours) * mult * v.qty, internal_cost: num(byId[id].default_internal_cost) * v.qty,
    })),
    ...state.custom.map((c) => ({
      unit_price: num(c.unit_price), quantity: Number(c.quantity) || 1, hours: num(c.estimated_hours) * (Number(c.quantity) || 1),
      internal_cost: num(c.internal_cost) * (Number(c.quantity) || 1),
    })),
  ];
  const alloc = state.dev.filter((d) => num(d.hours) > 0).map((d) => ({ hours: num(d.hours), rate: rate[String(d.team_member_id)] || 0, team_member_id: d.team_member_id }));

  return {
    method: state.pricing.pricing_method, items, alloc, hoursPerDay, timelineOverride: state.timeline_override_days,
    pricing: state.pricing,
    expenses: state.expenses.map((e) => ({ amount: e.amount, expense_type: e.expense_type, billing_type: e.billing_type })),
  };
}

/** Instant local estimate, plus an optional debounced check against the backend (the authority). */
export function usePricing(state, features, members, { server = false, hoursPerDay = 6 } = {}) {
  const local = useMemo(() => computeLocal(localInput(state, features, members, hoursPerDay)), [state, features, members, hoursPerDay]);
  const [remote, setRemote] = useState(null);
  const [remoteError, setRemoteError] = useState(null);
  const [loading, setLoading] = useState(false);

  const key = useMemo(() => (server ? JSON.stringify(toPayload(state, features)) : ''), [server, state, features]);
  useEffect(() => {
    if (!server || !state.project.client_name.trim()) return undefined;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      estimateService.preview(JSON.parse(key))
        .then((r) => { if (!cancelled) { setRemote(r); setRemoteError(null); } })
        .catch((e) => { if (!cancelled) { setRemote(null); setRemoteError(e.userMessage || e.message); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [key, server]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = remote
    ? Object.fromEntries(Object.entries(remote).map(([k, v]) => [k, typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v]))
    : local;
  return { local, display, verified: !!remote, loading, error: remoteError };
}
