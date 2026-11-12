from decimal import Decimal as D

import pytest

from app.database.connection import SessionLocal
from app.models import BusinessSettings, Client, Estimate, EstimateItem, Expense, Feature, ServiceCategory, TeamMember
from app.schemas.estimate import DevLineIn, EstimateIn, ExpenseIn, ItemIn, MaintenanceIn, MilestoneIn, PricingIn
from app.services import calculation_service as calc
from app.services.calculation_service import (
    AllocLine, CalcInput, CalculationError, ExpenseLine, ItemLine, calculate, payment_schedule, split_milestones,
)
from app.services import estimate_service
from app.utils.currency import format_inr
from app.utils.numbering import format_number, next_sequence


def rate_card_items():
    # Example project from the rate card: 52,000 development + 11,000 deployment
    rows = [("Standard website", 25000), ("Authentication", 7000), ("Admin dashboard", 10000),
            ("Database integration", 6000), ("API integration", 4000), ("Frontend deployment", 3000),
            ("Backend deployment", 5000), ("Database configuration", 2000), ("Domain and SSL", 1000)]
    return [ItemLine(n, 1, D(p), D(0), D(0)) for n, p in rows]


def base(**kw):
    inp = CalcInput(items=rate_card_items(), alloc=[AllocLine("Frontend", D(60), D(500), 1), AllocLine("Backend", D(40), D(400), 2)],
                    expenses=[ExpenseLine("Tools", D(2000), "one_time", "absorbed")], contingency_pct=D(10))
    for k, v in kw.items():
        setattr(inp, k, v)
    return inp


def test_rate_card_example_total():
    r = calculate(base())
    assert r["development_price"] == D("63000.00")
    assert r["final_client_price"] == D("63000.00")


def test_internal_cost_profit_and_margin():
    r = calculate(base())
    assert r["internal_development_cost"] == D("46000.00")
    assert r["contingency_amount"] == D("4800.00")
    assert r["total_internal_cost"] == D("52800.00")
    assert r["estimated_profit"] == D("10200.00")
    assert r["profit_margin"] == D("16.19")


def test_gst_and_discount():
    r = calculate(base(gst_enabled=True, gst_rate=D(18), discount_pct=D(10)))
    assert r["discount_amount"] == D("6300.00")
    assert r["taxable_amount"] == D("56700.00")
    assert r["gst_amount"] == D("10206.00")
    assert r["final_client_price"] == D("66906.00")
    assert r["revenue_excluding_gst"] == D("56700.00")


def test_gst_disabled_ignores_rate():
    r = calculate(base(gst_enabled=False, gst_rate=D(18)))
    assert r["gst_amount"] == D("0.00")


def test_no_double_count_allocation_wins_over_item_costs():
    items = [ItemLine("X", 1, D(1000), D(10), D(9999))]
    r = calculate(CalcInput(items=items, alloc=[AllocLine("A", D(10), D(100), 1)]))
    assert r["internal_development_cost"] == D("1000.00")
    assert r["internal_cost_source"] == "allocation"


def test_item_costs_used_without_allocation():
    r = calculate(CalcInput(items=[ItemLine("X", 1, D(1000), D(10), D(700), 1)]))
    assert r["internal_development_cost"] == D("700.00")
    assert r["hours_by_developer"] == {"1": D("10.00")}


def test_contingency_billed_once():
    absorbed = calculate(base())
    billed = calculate(base(contingency_in_client_price=True))
    assert billed["subtotal"] - absorbed["subtotal"] == D("4800.00")
    assert billed["total_internal_cost"] == absorbed["total_internal_cost"]


def test_expense_classification():
    ex = [ExpenseLine("Domain", D(800), "one_time", "client_billed"), ExpenseLine("Tool", D(500), "one_time", "absorbed"),
          ExpenseLine("Hosting", D(1000), "recurring", "client_billed"), ExpenseLine("Monitor", D(300), "recurring", "absorbed")]
    r = calculate(CalcInput(pricing_method="fixed", fixed_price=D(10000), expenses=ex))
    assert r["client_billed_expenses"] == D("12800.00")
    assert r["internal_expenses"] == D("4100.00")
    assert r["subtotal"] == D("22800.00")
    assert r["recurring_client_monthly"] == D("1000.00")
    assert r["recurring_absorbed_monthly"] == D("300.00")
    assert r["total_internal_cost"] == D("4100.00")


def test_pricing_methods():
    a = [AllocLine("A", D(20), D(100), 1)]
    assert calculate(CalcInput(pricing_method="hourly", hourly_rate=D(900), alloc=a))["development_price"] == D("18000.00")
    assert calculate(CalcInput(pricing_method="fixed", fixed_price=D(30000)))["development_price"] == D("30000.00")
    assert calculate(CalcInput(pricing_method="custom", custom_price=D(12345.5)))["development_price"] == D("12345.50")
    with pytest.raises(CalculationError):
        calculate(CalcInput(pricing_method="bogus"))


def test_zero_values():
    r = calculate(CalcInput())
    assert r["final_client_price"] == D("0.00")
    assert r["profit_evaluable"] is False
    assert r["profit_margin"] is None
    assert "Internal cost is ₹0. Enter developer hours in Step 3 or internal expenses in Step 4 so profit can be evaluated." in r["warnings"]
    assert "Development price is zero." in r["warnings"]


def test_suggested_price_margin_and_markup():
    r = calculate(CalcInput(items=[], alloc=[AllocLine("A", D(10), D(1000), 1)], profit_margin=D(20)))
    assert r["suggested_revenue"] == D("12500.00")
    r = calculate(CalcInput(alloc=[AllocLine("A", D(10), D(1000), 1)], margin_mode="markup", markup_pct=D(50)))
    assert r["suggested_revenue"] == D("15000.00")


def test_minimum_price_warning_and_validation():
    assert any("minimum" in w for w in calculate(base(minimum_price=D(100000)))["warnings"])
    with pytest.raises(CalculationError):
        calculate(base(discount_pct=D(120)))
    with pytest.raises(CalculationError):
        calculate(base(gst_enabled=True, gst_rate=D(150)))


def test_maintenance_and_first_year():
    r = calculate(base(maintenance_package="standard"))
    assert r["maintenance_monthly"] == D("3000.00") and r["maintenance_annual"] == D("36000.00")
    assert r["first_year_total"] == D("99000.00")
    with pytest.raises(CalculationError):
        calculate(base(maintenance_package="basic", maintenance_billing="custom"))


def test_timeline_parallel_and_override():
    r = calculate(base())
    assert r["auto_delivery_days"] == 10
    assert calculate(base(timeline_override_days=21))["estimated_delivery_days"] == 21


def test_milestones():
    rows = split_milestones(D("10001.00"), [("Advance", D(40)), ("Dev", D(30)), ("Final", D(30))])
    assert sum(r["amount"] for r in rows) == D("10001.00")
    with pytest.raises(CalculationError):
        split_milestones(D(100), [("A", D(50)), ("B", D(40))])


def test_helpers():
    assert format_inr(125000) == "\u20b91,25,000.00"
    assert format_inr(D("1234567.5")) == "\u20b912,34,567.50"
    assert format_inr(999) == "\u20b9999.00"
    assert format_number("QT", 2026, 7) == "QT-2026-0007"
    assert next_sequence(["QT-2026-0003", "QT-2025-0009"], "QT", 2026) == 4


# --- Section 8 Required Test Cases ---

def test_req_1_internal_cost_contingency_and_margin():
    # 1. Internal cost 71,000 (e.g. 142 h x ₹500), contingency 10% -> adjusted ₹78,100.00;
    # margin 35% -> suggested ₹120,153.85. Margin 30% -> 35% updates the suggested price immediately.
    inp_35 = CalcInput(
        pricing_method="fixed", fixed_price=D("100000"),
        alloc=[AllocLine("Dev", D(142), D(500), 1)],
        contingency_pct=D(10), profit_margin=D(35), margin_mode="margin"
    )
    r_35 = calculate(inp_35)
    assert r_35["internal_development_cost"] == D("71000.00")
    assert r_35["contingency_amount"] == D("7100.00")
    assert r_35["total_internal_cost"] == D("78100.00")
    assert r_35["suggested_development_price"] == D("120153.85")

    inp_30 = CalcInput(
        pricing_method="fixed", fixed_price=D("100000"),
        alloc=[AllocLine("Dev", D(142), D(500), 1)],
        contingency_pct=D(10), profit_margin=D(30), margin_mode="margin"
    )
    r_30 = calculate(inp_30)
    # 78100 / 0.7 = 111571.43
    assert r_30["suggested_development_price"] == D("111571.43")
    assert r_35["suggested_development_price"] != r_30["suggested_development_price"]


def test_req_2_contingency_zero_to_ten_counted_once():
    # 2. Contingency 0% -> 10% changes adjusted cost and suggested price; it is counted once.
    inp_0 = CalcInput(
        pricing_method="fixed", fixed_price=D("50000"),
        alloc=[AllocLine("Dev", D(50), D(500), 1)],
        expenses=[ExpenseLine("Tools", D(5000), "one_time", "absorbed")],
        contingency_pct=D(0), profit_margin=D(20), margin_mode="margin"
    )
    r_0 = calculate(inp_0)
    assert r_0["internal_development_cost"] == D("25000.00")
    assert r_0["internal_expenses"] == D("5000.00")
    assert r_0["contingency_amount"] == D("0.00")
    assert r_0["total_internal_cost"] == D("30000.00")
    assert r_0["suggested_development_price"] == D("37500.00")

    inp_10 = CalcInput(
        pricing_method="fixed", fixed_price=D("50000"),
        alloc=[AllocLine("Dev", D(50), D(500), 1)],
        expenses=[ExpenseLine("Tools", D(5000), "one_time", "absorbed")],
        contingency_pct=D(10), profit_margin=D(20), margin_mode="margin"
    )
    r_10 = calculate(inp_10)
    assert r_10["contingency_amount"] == D("3000.00")
    assert r_10["total_internal_cost"] == D("33000.00")
    assert r_10["suggested_development_price"] == D("41250.00")


def test_req_3_client_billed_monthly_hosting_profit_unchanged():
    # 3. Client-billed monthly hosting ₹2,000 -> ₹24,000 in Deployment & Setup Cost; profit unchanged.
    without_exp = CalcInput(
        pricing_method="fixed", fixed_price=D("100000"),
        alloc=[AllocLine("Dev", D(100), D(500), 1)]
    )
    r_no = calculate(without_exp)

    with_exp = CalcInput(
        pricing_method="fixed", fixed_price=D("100000"),
        alloc=[AllocLine("Dev", D(100), D(500), 1)],
        expenses=[ExpenseLine("Hosting", D(2000), "recurring", "client_billed")]
    )
    r_yes = calculate(with_exp)
    assert r_yes["client_paid_total"] == D("24000.00")
    assert r_yes["client_billed_expenses"] == D("24000.00")
    assert r_yes["development_revenue"] == r_no["development_revenue"]
    assert r_yes["estimated_profit"] == r_no["estimated_profit"]


def test_req_4_client_billed_yearly_domain_counted_once():
    # 4. Client-billed yearly domain ₹1,000 -> counted once (₹1,000).
    inp = CalcInput(
        pricing_method="fixed", fixed_price=D("50000"),
        expenses=[ExpenseLine("Domain", D(1000), "yearly", "client_billed")]
    )
    r = calculate(inp)
    assert r["client_paid_total"] == D("1000.00")
    assert r["subtotal"] == D("51000.00")


def test_req_5_absorbed_expense_reduces_profit():
    # 5. Absorbed expense added -> profit decreases by that annualised amount.
    base_inp = CalcInput(
        pricing_method="fixed", fixed_price=D("100000"),
        alloc=[AllocLine("Dev", D(100), D(500), 1)],
        contingency_pct=D(0)
    )
    r_base = calculate(base_inp)

    # Added one-time absorbed of 5,000
    with_absorbed_one = CalcInput(
        pricing_method="fixed", fixed_price=D("100000"),
        alloc=[AllocLine("Dev", D(100), D(500), 1)],
        contingency_pct=D(0),
        expenses=[ExpenseLine("Plugin", D(5000), "one_time", "absorbed")]
    )
    r_one = calculate(with_absorbed_one)
    assert r_base["estimated_profit"] - r_one["estimated_profit"] == D("5000.00")

    # Added recurring absorbed of 1,000/mo -> 12,000/yr
    with_absorbed_rec = CalcInput(
        pricing_method="fixed", fixed_price=D("100000"),
        alloc=[AllocLine("Dev", D(100), D(500), 1)],
        contingency_pct=D(0),
        expenses=[ExpenseLine("SaaS", D(1000), "recurring", "absorbed")]
    )
    r_rec = calculate(with_absorbed_rec)
    assert r_base["estimated_profit"] - r_rec["estimated_profit"] == D("12000.00")


def test_req_6_zero_internal_cost_not_evaluated():
    # 6. Zero internal cost -> profit_evaluable=false, warning shown, no 100%.
    inp = CalcInput(pricing_method="fixed", fixed_price=D("50000"))
    r = calculate(inp)
    assert r["total_internal_cost"] == D("0.00")
    assert r["profit_evaluable"] is False
    assert r["profit_margin"] is None
    assert r["estimated_profit"] is None
    assert r["suggested_development_price"] is None
    assert "Internal cost is ₹0. Enter developer hours in Step 3 or internal expenses in Step 4 so profit can be evaluated." in r["warnings"]


def test_req_7_payment_schedule_example_and_sum():
    # 7. Payment schedule example from section 4; total equals final exactly.
    # final ₹86,199.00, deployment ₹15,199.00, 40/30/30 ->
    # ₹34,479.60 | ₹25,859.70 | ₹15,199.00 | ₹10,660.70 (total ₹86,199.00).
    final = D("86199.00")
    dep = D("15199.00")
    ms = [("Advance", D(40)), ("Milestone", D(30)), ("Delivery", D(30))]
    res = payment_schedule(final, ms, dep)
    rows = res["rows"]
    assert len(rows) == 4
    assert rows[0]["amount"] == D("34479.60")
    assert rows[1]["amount"] == D("25859.70")
    assert rows[2]["amount"] == D("15199.00")
    assert rows[2]["milestone_name"] == "Deployment & setup expenses (before deployment)"
    assert rows[3]["amount"] == D("10660.70")
    assert sum(r["amount"] for r in rows) == final
    assert res["warning"] is None
    assert res["shortfall"] == D("0")


def test_req_8_no_deployment_last_milestone_unchanged():
    # 8. No deployment expenses -> last milestone unchanged.
    final = D("90000.00")
    ms = [("Advance", D(40)), ("Milestone", D(30)), ("Delivery", D(30))]
    res = payment_schedule(final, ms, D("0"))
    assert len(res["rows"]) == 3
    assert res["rows"][2]["amount"] == D("27000.00")
    assert res["rows"][2]["milestone_name"] == "Delivery"
    assert sum(r["amount"] for r in res["rows"]) == final


def test_req_9_deployment_exceeds_last_milestone_warning():
    # 9. Deployment > last milestone -> warning and correct shortfall.
    final = D("10000.00")
    dep = D("4000.00")  # last milestone is 30% of 10000 = 3000 -> shortfall = 1000
    ms = [("Advance", D(40)), ("Milestone", D(30)), ("Delivery", D(30))]
    res = payment_schedule(final, ms, dep)
    assert res["shortfall"] == D("1000.00")
    assert "Deployment expenses exceed the final milestone by ₹1,000.00." in res["warning"]
    assert res["rows"][-2]["amount"] == D("3000.00")  # capped at last_amount
    assert res["rows"][-1]["amount"] == D("0.00")
    assert sum(r["amount"] for r in res["rows"]) == final


def test_req_10_gst_toggle_updates_all():
    # 10. GST on/off -> taxable, GST, final and milestone amounts all update.
    base_args = dict(pricing_method="fixed", fixed_price=D("50000"), gst_rate=D(18))
    r_off = calculate(CalcInput(**base_args, gst_enabled=False))
    r_on = calculate(CalcInput(**base_args, gst_enabled=True))

    assert r_off["taxable_amount"] == D("50000.00")
    assert r_off["gst_amount"] == D("0.00")
    assert r_off["final_client_price"] == D("50000.00")

    assert r_on["taxable_amount"] == D("50000.00")
    assert r_on["gst_amount"] == D("9000.00")
    assert r_on["final_client_price"] == D("59000.00")

    ms = [("Adv", D(50)), ("Final", D(50))]
    sched_off = payment_schedule(r_off["final_client_price"], ms)
    sched_on = payment_schedule(r_on["final_client_price"], ms)
    assert sched_off["rows"][0]["amount"] == D("25000.00")
    assert sched_on["rows"][0]["amount"] == D("29500.00")


def test_req_11_maintenance_stored_prices_and_package_none():
    # 11. Maintenance: each existing plan uses its stored price; "none" gives zero;
    # annual = monthly x months; stays out of the one-time total.
    prices = {"basic": D("1500"), "standard": D("3000"), "premium": D("5000")}
    for pkg, price in prices.items():
        r = calculate(CalcInput(pricing_method="fixed", fixed_price=D("40000"), maintenance_package=pkg, maintenance_months=12))
        assert r["maintenance_monthly"] == price
        assert r["maintenance_annual"] == price * 12
        assert r["final_client_price"] == D("40000.00")  # stays out of one-time total
        assert r["first_year_total"] == D("40000.00") + (price * 12)

    r_none = calculate(CalcInput(pricing_method="fixed", fixed_price=D("40000"), maintenance_package="none"))
    assert r_none["maintenance_monthly"] == D("0.00")
    assert r_none["maintenance_annual"] == D("0.00")
    assert r_none["first_year_total"] == D("40000.00")


def test_req_12_and_13_save_reload_persistence_and_inactive_feature():
    # 12. Old saved estimate (e.g. with an inactive Deployment item) reopens with the same items;
    # saving does not drop the Deployment line or silently change its development price.
    # 13. Save, reload: components, expenses, adjustments, maintenance and calculated values persist.
    db = SessionLocal()
    try:
        # Create a test service category & feature
        cat = db.query(ServiceCategory).first()
        if not cat:
            cat = ServiceCategory(name="Test Web")
            db.add(cat)
            db.flush()

        dep_feat = db.query(Feature).filter(Feature.name == "Deployment", Feature.category_id == cat.id).first()
        if not dep_feat:
            dep_feat = Feature(category_id=cat.id, name="Deployment", basic_price=D("5000"),
                               intermediate_price=D("8000"), advanced_price=D("12000"),
                               estimated_hours=D("6"), active=False)
            db.add(dep_feat)
            db.flush()
        else:
            dep_feat.active = False
            db.flush()

        member = db.query(TeamMember).first()
        if not member:
            member = TeamMember(name="Dev 1", internal_hourly_rate=D(500))
            db.add(member)
            db.flush()

        payload = EstimateIn(
            project_name="Signum legacy test",
            complexity="basic",
            category_id=cat.id,
            pricing_method="feature",
            pricing=PricingIn(
                contingency_pct=D("10"),
                profit_margin=D("30"),
                gst_enabled=True,
                gst_rate=D("18"),
                maintenance=MaintenanceIn(package="standard", months=12)
            ),
            items=[
                ItemIn(feature_id=dep_feat.id, quantity=1, estimated_hours=D("6"))
            ],
            dev_allocation=[
                DevLineIn(category="Deployment", estimated_hours=D("6"), team_member_id=member.id)
            ],
            expenses=[
                ExpenseIn(name="Custom Hosting", category="Deployment & server setup", amount=D("2500"), expense_type="yearly", billing_type="client_billed"),
                ExpenseIn(name="Dev Tool", category="Other expenses", amount=D("1000"), expense_type="one_time", billing_type="absorbed"),
            ],
            milestones=[
                MilestoneIn(milestone_name="Advance", percentage=D(40)),
                MilestoneIn(milestone_name="Milestone", percentage=D(30)),
                MilestoneIn(milestone_name="Final", percentage=D(30)),
            ]
        )

        # Save estimate
        est = estimate_service.save(db, payload, user_id=None)
        assert est.id is not None
        assert len(est.items) == 1
        assert est.items[0].feature_name_snapshot == "Deployment"
        assert est.items[0].unit_price == dep_feat.basic_price
        assert len(est.expenses) == 2

        # Reopen / reload and verify
        reloaded = db.get(Estimate, est.id)
        assert reloaded is not None
        assert len(reloaded.items) == 1
        assert reloaded.items[0].feature_name_snapshot == "Deployment"
        assert reloaded.items[0].unit_price == dep_feat.basic_price

        # Re-save with estimate_service.save to verify inactive feature is NOT dropped
        est_updated = estimate_service.save(db, payload, user_id=None, estimate=reloaded)
        assert len(est_updated.items) == 1
        assert est_updated.items[0].feature_name_snapshot == "Deployment"
        assert est_updated.items[0].unit_price == dep_feat.basic_price
        assert est_updated.final_client_price == reloaded.final_client_price
    finally:
        db.close()


def test_req_14_backend_and_formula_consistency():
    # 14. Verification of the exact formula mirrors:
    # dev_price=50000, client_paid=12000, absorbed=2000, contingency=10%, gst=18%
    inp = CalcInput(
        pricing_method="fixed", fixed_price=D("50000"),
        alloc=[AllocLine("Dev", D(40), D(500), 1)],  # internal_dev = 20,000
        expenses=[
            ExpenseLine("Hosting", D(1000), "recurring", "client_billed"),  # 12,000
            ExpenseLine("Tool", D(2000), "one_time", "absorbed")             # 2,000
        ],
        contingency_pct=D(10),
        profit_margin=D(30),
        gst_enabled=True,
        gst_rate=D(18)
    )
    r = calculate(inp)
    assert r["internal_development_cost"] == D("20000.00")
    assert r["absorbed_total"] == D("2000.00")
    assert r["contingency_amount"] == D("2200.00")  # (20000 + 2000) * 10%
    assert r["total_internal_cost"] == D("24200.00")
    assert r["client_paid_total"] == D("12000.00")
    assert r["subtotal"] == D("62000.00")  # 50000 + 12000
    assert r["taxable_amount"] == D("62000.00")
    assert r["gst_amount"] == D("11160.00")
    assert r["final_client_price"] == D("73160.00")
    assert r["development_revenue"] == D("50000.00")  # 62000 - 12000
    assert r["estimated_profit"] == D("25800.00")     # 50000 - 24200
    assert r["profit_margin"] == D("51.60")           # 25800 / 50000 * 100
    # Suggested dev price: 24200 / 0.7 = 34571.43
    assert r["suggested_development_price"] == D("34571.43")
    # Suggested client price: (34571.43 + 12000) * 1.18 = 46571.43 * 1.18 = 54954.29
    assert r["suggested_client_price"] == D("54954.29")
