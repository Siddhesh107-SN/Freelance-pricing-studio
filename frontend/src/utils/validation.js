import { z } from 'zod';
import { num } from './formatting.js';

export const PROJECT_TYPES = {
  website: ['Business website', 'Portfolio website', 'Landing page', 'Corporate website', 'Website redesign', 'E-commerce website'],
  dashboard: ['Admin dashboard', 'Analytics dashboard', 'CRM dashboard', 'Business management dashboard', 'Custom reporting dashboard'],
  'web app': ['Appointment management system', 'Enquiry management system', 'Custom SaaS application', 'Internal business application'],
  automation: ['AI workflow automation', 'AI chatbot integration', 'AI document processing', 'Custom AI business workflows'],
  voice: ['Incoming enquiry agent', 'Appointment booking agent', 'Customer support voice agent', 'Custom AI calling agent'],
};
export const typesFor = (name = '') => {
  const n = name.toLowerCase();
  const key = Object.keys(PROJECT_TYPES).find((k) => n.includes(k)) || (n.includes('application') ? 'web app' : null);
  return key ? PROJECT_TYPES[key] : [];
};

export const projectSchema = z.object({
  project_name: z.string().trim().min(1, 'Project name is required'),
  client_name: z.string().trim().min(1, 'Client name is required'),
  company: z.string().optional(),
  email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number').or(z.literal('')),
  project_description: z.string().optional(),
  category_id: z.number({ required_error: 'Choose a category', invalid_type_error: 'Choose a category' }),
  project_type: z.string().min(1, 'Choose a project type'),
  complexity: z.enum(['basic', 'intermediate', 'advanced']),
});

const fromZod = (r) => {
  if (r.success) return {};
  const out = {};
  r.error.issues.forEach((i) => { const k = i.path.join('.'); if (!out[k]) out[k] = i.message; });
  return out;
};

export function validateStep(step, s) {
  const errors = {};
  if (step === 0) Object.assign(errors, fromZod(projectSchema.safeParse(s.project)));
  if (step === 1) {
    if (!Object.keys(s.selected).length && !s.custom.length) errors.features = 'Select at least one feature or add a custom one.';
    s.custom.forEach((c, i) => {
      if (!c.name.trim()) errors[`custom.${i}`] = 'Custom feature needs a name.';
      else if (num(c.unit_price) < 0 || num(c.estimated_hours) < 0 || num(c.internal_cost) < 0) errors[`custom.${i}`] = 'Values cannot be negative.';
    });
  }
  if (step === 2) {
    s.dev.forEach((d, i) => {
      if (num(d.hours) < 0) errors[`dev.${i}`] = 'Hours cannot be negative.';
      else if (num(d.hours) > 0 && !d.team_member_id) errors[`dev.${i}`] = 'Assign a developer.';
    });
    if (s.timeline_override_days !== '' && num(s.timeline_override_days) < 0) errors.timeline = 'Timeline cannot be negative.';
  }
  if (step === 3) {
    s.expenses.forEach((e, i) => {
      if (!e.name.trim()) errors[`expense.${i}`] = 'Expense needs a name.';
      else if (num(e.amount) < 0) errors[`expense.${i}`] = 'Amount cannot be negative.';
    });
  }
  if (step === 4) {
    const p = s.pricing;
    const pct = (k, label, max = 100) => { if (num(p[k]) < 0 || num(p[k]) > max) errors[k] = `${label} must be between 0 and ${max}.`; };
    pct('discount_pct', 'Discount'); pct('contingency_pct', 'Contingency');
    if (p.margin_mode === 'margin' && (num(p.profit_margin) < 0 || num(p.profit_margin) >= 100)) errors.profit_margin = 'Margin must be at least 0 and below 100.';
    if (p.gst_enabled) pct('gst_rate', 'GST rate');
    ['fixed_price', 'hourly_rate', 'custom_price', 'additional_charges', 'minimum_price'].forEach((k) => { if (num(p[k]) < 0) errors[k] = 'Cannot be negative.'; });
    if (p.maintenance.billing === 'custom' && p.maintenance.package !== 'none' && p.maintenance.custom_amount === '') errors.maintenance = 'Enter the custom maintenance amount.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export const milestoneTotal = (ms) => ms.reduce((s, m) => s + num(m.percentage), 0);
export const milestonesValid = (ms) => ms.length > 0 && Math.abs(milestoneTotal(ms) - 100) < 1e-9 && ms.every((m) => m.milestone_name.trim() && num(m.percentage) > 0);
