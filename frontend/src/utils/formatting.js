export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const str = (v) => String(v === '' || v == null ? 0 : v);
export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
export const formatPct = (v) => `${num(v).toFixed(2)}%`;
export const COMPLEXITY_HOURS = { basic: 1, intermediate: 1.5, advanced: 2 };
export const COMPLEXITY_LABEL = {
  basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced',
};

export const DEV_CATEGORIES = [
  'UI/UX design',
  'Frontend development',
  'Backend development',
  'Database development',
  'API integration',
  'Testing',
  'Deployment',
];

export function mapFeatureToDevCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('ui/ux') || (n.includes('design') && !n.includes('responsive')) || n.includes('analysis') || n.includes('configuration')) {
    return 'UI/UX design';
  }
  if (n.includes('frontend') || n.includes('responsive') || n.includes('page') || n.includes('interface') || n.includes('chart') || n.includes('form') || n.includes('seo') || n.includes('admin panel')) {
    return 'Frontend development';
  }
  if (n.includes('database') || n.includes('schema') || n.includes('architecture')) {
    return 'Database development';
  }
  if (n.includes('api') || n.includes('integration') || n.includes('speech') || n.includes('text-to-speech') || n.includes('telephony') || n.includes('crm') || n.includes('webhook')) {
    return 'API integration';
  }
  if (n.includes('test')) {
    return 'Testing';
  }
  if (n.includes('deploy')) {
    return 'Deployment';
  }
  return 'Backend development';
}

export function calculateHoursPerDevCategory(selected = {}, custom = [], features = [], complexity = 'basic') {
  const mult = COMPLEXITY_HOURS[complexity] || 1;
  const byId = Object.fromEntries(features.map((f) => [String(f.id), f]));
  const hoursMap = {};
  for (const cat of DEV_CATEGORIES) {
    hoursMap[cat] = 0;
  }

  for (const [id, v] of Object.entries(selected)) {
    const f = byId[id];
    if (f && v.qty > 0) {
      const h = num(f.estimated_hours) * mult * v.qty;
      const cat = mapFeatureToDevCategory(f.name);
      hoursMap[cat] = (hoursMap[cat] || 0) + h;
    }
  }

  for (const c of custom) {
    const qty = Number(c.quantity) || 1;
    const h = num(c.estimated_hours) * qty;
    if (h > 0) {
      const cat = mapFeatureToDevCategory(c.name);
      hoursMap[cat] = (hoursMap[cat] || 0) + h;
    }
  }

  return hoursMap;
}
