import { describe, expect, it } from 'vitest';
import { computeLocal, paymentSchedule } from '../utils/pricing.js';

// Same project as backend/tests/test_calculation.py (rate card example plus costs).
const base = () => ({
  method: 'feature',
  items: [25000, 7000, 10000, 6000, 4000, 3000, 5000, 2000, 1000].map((p) => ({ unit_price: p, quantity: 1, hours: 0, internal_cost: 0 })),
  alloc: [{ hours: 60, rate: 500, team_member_id: 1 }, { hours: 40, rate: 400, team_member_id: 2 }],
  expenses: [{ amount: 2000, expense_type: 'one_time', billing_type: 'absorbed' }],
  pricing: { fixed_price: 0, hourly_rate: 0, custom_price: 0, margin_mode: 'margin', profit_margin: 30, markup_pct: 0, contingency_pct: 10, contingency_in_client_price: false, discount_pct: 0, additional_charges: 0, minimum_price: 0, gst_enabled: false, gst_rate: 18, maintenance: { package: 'none' } },
});

describe('computeLocal matches the backend vectors', () => {
  it('totals, cost, profit and margin', () => {
    const r = computeLocal(base());
    expect(r.final_client_price).toBe(63000);
    expect(r.internal_development_cost).toBe(46000);
    expect(r.contingency_amount).toBe(4800);
    expect(r.total_internal_cost).toBe(52800);
    expect(r.estimated_profit).toBe(10200);
    expect(r.profit_margin).toBe(16.19);
    expect(r.auto_delivery_days).toBe(10);
  });

  it('GST and discount', () => {
    const b = base();
    b.pricing = { ...b.pricing, gst_enabled: true, discount_pct: 10 };
    const r = computeLocal(b);
    expect(r.discount_amount).toBe(6300);
    expect(r.gst_amount).toBe(10206);
    expect(r.final_client_price).toBe(66906);
  });

  it('bills contingency once and annualises recurring expenses into subtotal', () => {
    const b = base();
    b.pricing.contingency_in_client_price = true;
    b.expenses.push({ amount: 1000, expense_type: 'recurring', billing_type: 'client_billed' });
    // 63000 + 4800 (contingency) + 12000 (1000 x 12 client paid) = 79800
    expect(computeLocal(b).subtotal).toBe(79800);
  });

  it('handles zero values and the other pricing methods', () => {
    const empty = computeLocal({ ...base(), items: [], alloc: [], expenses: [] });
    expect(empty.final_client_price).toBe(0);
    expect(empty.profit_evaluable).toBe(false);
    expect(empty.profit_margin).toBe(null);
    expect(empty.suggested_development_price).toBe(null);
    const hourly = computeLocal({ ...base(), method: 'hourly', pricing: { ...base().pricing, hourly_rate: 900 } });
    expect(hourly.development_price).toBe(90000);
  });

  it('uses the timeline override when set', () => {
    expect(computeLocal({ ...base(), timelineOverride: '21' }).estimated_delivery_days).toBe(21);
  });
});

describe('Section 8 Required Test Cases in Frontend', () => {
  it('1. Internal cost 71,000, contingency 10% -> 78,100; margin 35% -> suggested 120,153.85', () => {
    const r35 = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 142, rate: 500, team_member_id: 1 }],
      pricing: { fixed_price: 100000, contingency_pct: 10, margin_mode: 'margin', profit_margin: 35 },
    });
    expect(r35.internal_development_cost).toBe(71000);
    expect(r35.contingency_amount).toBe(7100);
    expect(r35.total_internal_cost).toBe(78100);
    expect(r35.suggested_development_price).toBe(120153.85);

    const r30 = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 142, rate: 500, team_member_id: 1 }],
      pricing: { fixed_price: 100000, contingency_pct: 10, margin_mode: 'margin', profit_margin: 30 },
    });
    expect(r30.suggested_development_price).toBe(111571.43);
    expect(r35.suggested_development_price).not.toBe(r30.suggested_development_price);
  });

  it('2. Contingency 0% -> 10% changes adjusted cost and suggested price; counted once', () => {
    const r0 = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 50, rate: 500, team_member_id: 1 }],
      expenses: [{ amount: 5000, expense_type: 'one_time', billing_type: 'absorbed' }],
      pricing: { fixed_price: 50000, contingency_pct: 0, margin_mode: 'margin', profit_margin: 20 },
    });
    expect(r0.contingency_amount).toBe(0);
    expect(r0.total_internal_cost).toBe(30000);
    expect(r0.suggested_development_price).toBe(37500);

    const r10 = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 50, rate: 500, team_member_id: 1 }],
      expenses: [{ amount: 5000, expense_type: 'one_time', billing_type: 'absorbed' }],
      pricing: { fixed_price: 50000, contingency_pct: 10, margin_mode: 'margin', profit_margin: 20 },
    });
    expect(r10.contingency_amount).toBe(3000);
    expect(r10.total_internal_cost).toBe(33000);
    expect(r10.suggested_development_price).toBe(41250);
  });

  it('3. Client-billed monthly hosting 2,000 -> 24,000 in Deployment & Setup Cost; profit unchanged', () => {
    const rNo = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 100, rate: 500, team_member_id: 1 }],
      pricing: { fixed_price: 100000 },
    });
    const rYes = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 100, rate: 500, team_member_id: 1 }],
      expenses: [{ amount: 2000, expense_type: 'recurring', billing_type: 'client_billed' }],
      pricing: { fixed_price: 100000 },
    });
    expect(rYes.client_paid_total).toBe(24000);
    expect(rYes.development_revenue).toBe(rNo.development_revenue);
    expect(rYes.estimated_profit).toBe(rNo.estimated_profit);
  });

  it('4. Client-billed yearly domain 1,000 -> counted once', () => {
    const r = computeLocal({
      method: 'fixed',
      expenses: [{ amount: 1000, expense_type: 'yearly', billing_type: 'client_billed' }],
      pricing: { fixed_price: 50000 },
    });
    expect(r.client_paid_total).toBe(1000);
    expect(r.subtotal).toBe(51000);
  });

  it('5. Absorbed expense added -> profit decreases by that annualised amount', () => {
    const rBase = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 100, rate: 500, team_member_id: 1 }],
      pricing: { fixed_price: 100000, contingency_pct: 0 },
    });
    const rOne = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 100, rate: 500, team_member_id: 1 }],
      expenses: [{ amount: 5000, expense_type: 'one_time', billing_type: 'absorbed' }],
      pricing: { fixed_price: 100000, contingency_pct: 0 },
    });
    expect(rBase.estimated_profit - rOne.estimated_profit).toBe(5000);

    const rRec = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 100, rate: 500, team_member_id: 1 }],
      expenses: [{ amount: 1000, expense_type: 'recurring', billing_type: 'absorbed' }],
      pricing: { fixed_price: 100000, contingency_pct: 0 },
    });
    expect(rBase.estimated_profit - rRec.estimated_profit).toBe(12000);
  });

  it('6. Zero internal cost -> profit_evaluable=false, warning shown, no 100%', () => {
    const r = computeLocal({
      method: 'fixed',
      pricing: { fixed_price: 50000 },
    });
    expect(r.total_internal_cost).toBe(0);
    expect(r.profit_evaluable).toBe(false);
    expect(r.profit_margin).toBe(null);
    expect(r.estimated_profit).toBe(null);
    expect(r.suggested_development_price).toBe(null);
    expect(r.warnings).toContain('Internal cost is ₹0. Enter developer hours in Step 3 or internal expenses in Step 4 so profit can be evaluated.');
  });

  it('7. Payment schedule example from section 4; total equals final exactly', () => {
    const final = 86199;
    const dep = 15199;
    const ms = [
      { milestone_name: 'Advance', percentage: 40 },
      { milestone_name: 'Milestone', percentage: 30 },
      { milestone_name: 'Delivery', percentage: 30 },
    ];
    const res = paymentSchedule(final, ms, dep);
    expect(res.rows.length).toBe(4);
    expect(res.rows[0].amount).toBe(34479.6);
    expect(res.rows[1].amount).toBe(25859.7);
    expect(res.rows[2].amount).toBe(15199);
    expect(res.rows[2].milestone_name).toBe('Deployment & setup expenses (before deployment)');
    expect(res.rows[3].amount).toBe(10660.7);
    const sum = res.rows.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(final);
    expect(res.warning).toBe(null);
    expect(res.shortfall).toBe(0);
  });

  it('8. No deployment expenses -> last milestone unchanged', () => {
    const final = 90000;
    const ms = [
      { milestone_name: 'Advance', percentage: 40 },
      { milestone_name: 'Milestone', percentage: 30 },
      { milestone_name: 'Delivery', percentage: 30 },
    ];
    const res = paymentSchedule(final, ms, 0);
    expect(res.rows.length).toBe(3);
    expect(res.rows[2].amount).toBe(27000);
    expect(res.rows[2].milestone_name).toBe('Delivery');
    expect(res.rows.reduce((s, r) => s + r.amount, 0)).toBe(final);
  });

  it('9. Deployment > last milestone -> warning and correct shortfall', () => {
    const final = 10000;
    const dep = 4000;
    const ms = [
      { milestone_name: 'Advance', percentage: 40 },
      { milestone_name: 'Milestone', percentage: 30 },
      { milestone_name: 'Delivery', percentage: 30 },
    ];
    const res = paymentSchedule(final, ms, dep);
    expect(res.shortfall).toBe(1000);
    expect(res.warning).toContain('Deployment expenses exceed the final milestone by ₹1,000.00.');
    expect(res.rows[res.rows.length - 2].amount).toBe(3000);
    expect(res.rows[res.rows.length - 1].amount).toBe(0);
    expect(res.rows.reduce((s, r) => s + r.amount, 0)).toBe(final);
  });

  it('10. GST on/off -> taxable, GST, final and milestone amounts all update', () => {
    const baseArgs = { method: 'fixed', pricing: { fixed_price: 50000, gst_rate: 18 } };
    const rOff = computeLocal({ ...baseArgs, pricing: { ...baseArgs.pricing, gst_enabled: false } });
    const rOn = computeLocal({ ...baseArgs, pricing: { ...baseArgs.pricing, gst_enabled: true } });

    expect(rOff.taxable_amount).toBe(50000);
    expect(rOff.gst_amount).toBe(0);
    expect(rOff.final_client_price).toBe(50000);

    expect(rOn.taxable_amount).toBe(50000);
    expect(rOn.gst_amount).toBe(9000);
    expect(rOn.final_client_price).toBe(59000);

    const ms = [{ name: 'Adv', percentage: 50 }, { name: 'Final', percentage: 50 }];
    const schedOff = paymentSchedule(rOff.final_client_price, ms);
    const schedOn = paymentSchedule(rOn.final_client_price, ms);
    expect(schedOff.rows[0].amount).toBe(25000);
    expect(schedOn.rows[0].amount).toBe(29500);
  });

  it('11. Maintenance: stored prices, "none" gives zero, annual = monthly x months', () => {
    ['basic', 'standard', 'premium'].forEach((pkg) => {
      const price = { basic: 1500, standard: 3000, premium: 5000 }[pkg];
      const r = computeLocal({
        method: 'fixed',
        pricing: { fixed_price: 40000, maintenance: { package: pkg, months: 12 } },
      });
      expect(r.maintenance_monthly).toBe(price);
      expect(r.maintenance_annual).toBe(price * 12);
      expect(r.final_client_price).toBe(40000);
      expect(r.first_year_total).toBe(40000 + price * 12);
    });

    const rNone = computeLocal({
      method: 'fixed',
      pricing: { fixed_price: 40000, maintenance: { package: 'none' } },
    });
    expect(rNone.maintenance_monthly).toBe(0);
    expect(rNone.maintenance_annual).toBe(0);
    expect(rNone.first_year_total).toBe(40000);
  });

  it('14. Frontend computeLocal() and backend calculate() return identical numbers for same inputs', () => {
    const r = computeLocal({
      method: 'fixed',
      alloc: [{ hours: 40, rate: 500, team_member_id: 1 }],
      expenses: [
        { amount: 1000, expense_type: 'recurring', billing_type: 'client_billed' },
        { amount: 2000, expense_type: 'one_time', billing_type: 'absorbed' },
      ],
      pricing: {
        fixed_price: 50000,
        contingency_pct: 10,
        profit_margin: 30,
        gst_enabled: true,
        gst_rate: 18,
      },
    });

    expect(r.internal_development_cost).toBe(20000);
    expect(r.absorbed_total).toBe(2000);
    expect(r.contingency_amount).toBe(2200);
    expect(r.total_internal_cost).toBe(24200);
    expect(r.client_paid_total).toBe(12000);
    expect(r.subtotal).toBe(62000);
    expect(r.taxable_amount).toBe(62000);
    expect(r.gst_amount).toBe(11160);
    expect(r.final_client_price).toBe(73160);
    expect(r.development_revenue).toBe(50000);
    expect(r.estimated_profit).toBe(25800);
    expect(r.profit_margin).toBe(51.6);
    expect(r.suggested_development_price).toBe(34571.43);
    expect(r.suggested_client_price).toBe(54954.29);
  });
});
