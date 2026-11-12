import { createContext, useContext, useEffect, useReducer } from 'react';
import { DEV_CATEGORIES } from '../utils/formatting.js';

export { DEV_CATEGORIES };
export const DEFAULT_MILESTONES = [
  { milestone_name: 'Advance on project confirmation', percentage: '40' },
  { milestone_name: 'After development milestone', percentage: '30' },
  { milestone_name: 'Before final delivery', percentage: '30' },
];
export const DRAFT_KEY = 'fps_draft';

export const blankState = () => ({
  id: null, clientId: null, step: 0, dirty: false, saved: null,
  project: { project_name: '', client_name: '', company: '', email: '', phone: '', project_description: '', category_id: null, project_type: '', complexity: 'basic' },
  selected: {}, custom: [],
  dev: DEV_CATEGORIES.map((category) => ({ category, hours: '', team_member_id: null, completion_days: '' })),
  timeline_override_days: '',
  expenses: [],
  pricing: {
    pricing_method: 'feature', fixed_price: '0', hourly_rate: '0', custom_price: '0', margin_mode: 'margin', profit_margin: '30', markup_pct: '0',
    contingency_pct: '10', contingency_in_client_price: false, discount_pct: '0', additional_charges: '0', minimum_price: '0',
    gst_enabled: false, gst_rate: '18', maintenance: { package: 'none', billing: 'monthly', custom_amount: '', months: 12 },
  },
  milestones: DEFAULT_MILESTONES.map((m) => ({ ...m })),
});

const touch = (s, patch) => ({ ...s, ...patch, dirty: true });
const replaceAt = (arr, i, values) => arr.map((x, idx) => (idx === i ? { ...x, ...values } : x));

export function reducer(s, a) {
  switch (a.type) {
    case 'patch': return touch(s, { [a.section]: { ...s[a.section], ...a.values } });
    case 'maintenance': return touch(s, { pricing: { ...s.pricing, maintenance: { ...s.pricing.maintenance, ...a.values } } });
    case 'set': return touch(s, { [a.key]: a.value });
    case 'category': return touch(s, { project: { ...s.project, category_id: a.id, project_type: '' }, selected: {} });
    case 'toggle_feature': {
      const selected = { ...s.selected };
      if (selected[a.id]) delete selected[a.id]; else selected[a.id] = { qty: 1 };
      return touch(s, { selected });
    }
    case 'set_qty': return touch(s, { selected: { ...s.selected, [a.id]: { qty: Math.max(1, Math.min(1000, Number(a.qty) || 1)) } } });
    case 'custom_add': return touch(s, { custom: [...s.custom, { name: '', description: '', unit_price: '', estimated_hours: '', internal_cost: '', quantity: 1, ...a.values }] });
    case 'custom_update': return touch(s, { custom: replaceAt(s.custom, a.index, a.values) });
    case 'custom_remove': return touch(s, { custom: s.custom.filter((_, i) => i !== a.index) });
    case 'dev_update': return touch(s, { dev: replaceAt(s.dev, a.index, a.values) });
    case 'expense_add': return touch(s, { expenses: [...s.expenses, { name: '', category: 'Other expenses', amount: '', expense_type: 'one_time', billing_type: 'client_billed', notes: '', ...a.values }] });
    case 'expense_update': return touch(s, { expenses: replaceAt(s.expenses, a.index, a.values) });
    case 'expense_remove': return touch(s, { expenses: s.expenses.filter((_, i) => i !== a.index) });
    case 'step': return { ...s, step: a.step };
    case 'saved': return { ...s, id: a.estimate.id, clientId: a.estimate.client_id, saved: a.estimate, dirty: false };
    case 'load': return { ...blankState(), ...a.state, dirty: false };
    case 'reset': return blankState();
    default: return s;
  }
}

const Ctx = createContext(null);
export const useEstimateContext = () => useContext(Ctx);

export function EstimateProvider({ children, initial }) {
  const [state, dispatch] = useReducer(reducer, initial, (i) => i || blankState());
  useEffect(() => {
    try { if (state.dirty || state.id == null) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...state, saved: null })); } catch { /* storage full or blocked */ }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export const readLocalDraft = () => {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
export const clearLocalDraft = () => localStorage.removeItem(DRAFT_KEY);
