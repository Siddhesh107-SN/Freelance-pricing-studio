import { describe, expect, it } from 'vitest';
import { blankState, reducer } from '../context/EstimateContext.jsx';
import { formatINR } from '../utils/currency.js';
import { milestonesValid, typesFor, validateStep } from '../utils/validation.js';

const filled = () => {
  const s = blankState();
  s.project = { ...s.project, project_name: 'Site', client_name: 'Asha', category_id: 1, project_type: 'Business website' };
  return s;
};

describe('step validation', () => {
  it('blocks step 1 until required fields are present', () => {
    const r = validateStep(0, blankState());
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(['project_name', 'client_name', 'category_id']));
    expect(validateStep(0, filled()).ok).toBe(true);
  });
  it('rejects a bad email and phone', () => {
    const s = filled();
    s.project.email = 'nope'; s.project.phone = 'abc';
    expect(Object.keys(validateStep(0, s).errors)).toEqual(expect.arrayContaining(['email', 'phone']));
  });
  it('requires at least one feature', () => {
    expect(validateStep(1, blankState()).ok).toBe(false);
    const s = reducer(blankState(), { type: 'toggle_feature', id: 5 });
    expect(validateStep(1, s).ok).toBe(true);
  });
  it('requires a developer when hours are entered', () => {
    let s = reducer(blankState(), { type: 'dev_update', index: 0, values: { hours: '10' } });
    expect(validateStep(2, s).errors['dev.0']).toBeTruthy();
    s = reducer(s, { type: 'dev_update', index: 0, values: { team_member_id: 1 } });
    expect(validateStep(2, s).ok).toBe(true);
  });
  it('validates expenses, percentages and GST', () => {
    let s = reducer(blankState(), { type: 'expense_add', values: { name: '', amount: '5' } });
    expect(validateStep(3, s).ok).toBe(false);
    s = reducer(blankState(), { type: 'patch', section: 'pricing', values: { discount_pct: '120' } });
    expect(validateStep(4, s).errors.discount_pct).toBeTruthy();
    s = reducer(blankState(), { type: 'patch', section: 'pricing', values: { gst_enabled: true, gst_rate: '150' } });
    expect(validateStep(4, s).errors.gst_rate).toBeTruthy();
  });
  it('checks milestone totals', () => {
    expect(milestonesValid(blankState().milestones)).toBe(true);
    expect(milestonesValid([{ milestone_name: 'A', percentage: '60' }, { milestone_name: 'B', percentage: '30' }])).toBe(false);
  });
});

describe('guided navigation state', () => {
  it('keeps entered data when moving between steps', () => {
    let s = reducer(blankState(), { type: 'patch', section: 'project', values: { project_name: 'Keep me' } });
    s = reducer(s, { type: 'step', step: 3 });
    s = reducer(s, { type: 'step', step: 0 });
    expect(s.project.project_name).toBe('Keep me');
  });
  it('clears selected features when the category changes', () => {
    let s = reducer(blankState(), { type: 'toggle_feature', id: 1 });
    s = reducer(s, { type: 'category', id: 2 });
    expect(s.selected).toEqual({});
  });
});

describe('formatting', () => {
  it('uses Indian grouping', () => {
    expect(formatINR(125000)).toContain('1,25,000');
    expect(typesFor('Website Development')).toContain('Landing page');
  });
});
