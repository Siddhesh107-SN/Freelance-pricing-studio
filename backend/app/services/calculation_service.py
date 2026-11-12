"""Authoritative financial calculations. Decimal only, no I/O.

Double-counting rules
- Internal development cost comes from the developer allocation (step 3) when it has hours.
  Only when there is no allocation does it fall back to the per-feature internal cost.
- Client-paid deployment and server expenses sit inside the project total (annualised) as pass-through.
- Recurring expenses are annualised (x12) when computing project totals.
- Contingency is always part of the internal cost. It is also billed to the client only when
  contingency_in_client_price is true, and then it is added once to the subtotal.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal as D

ZERO, HUNDRED, CENT = D("0"), D("100"), D("0.01")
ANNUAL_MONTHS = D("12")
MAINTENANCE_DEFAULTS = {"basic": D("1500"), "standard": D("3000"), "premium": D("5000")}
METHODS = ("fixed", "hourly", "feature", "custom")


class CalculationError(ValueError):
    pass


def q(v) -> D:
    return D(v).quantize(CENT, rounding=ROUND_HALF_UP)


def annualise_expense(amount: D, expense_type: str) -> D:
    """Annualisation rule:
    one_time  -> amount
    recurring -> amount x 12 (ANNUAL_MONTHS = 12 constant)
    yearly    -> amount (counted once, never x12)
    usage     -> amount (treated as an estimate, counted once, flagged as estimate)
    """
    amt = q(amount)
    if expense_type == "recurring":
        return q(amt * ANNUAL_MONTHS)
    return amt


@dataclass
class ItemLine:
    name: str
    quantity: int
    unit_price: D
    hours: D  # line total
    internal_cost: D  # line total
    team_member_id: int | None = None


@dataclass
class AllocLine:
    category: str
    hours: D
    rate: D
    team_member_id: int | None = None


@dataclass
class ExpenseLine:
    name: str
    amount: D
    expense_type: str = "one_time"  # one_time | recurring | yearly | usage
    billing_type: str = "client_billed"  # client_billed | absorbed


@dataclass
class CalcInput:
    pricing_method: str = "feature"
    items: list[ItemLine] = field(default_factory=list)
    alloc: list[AllocLine] = field(default_factory=list)
    expenses: list[ExpenseLine] = field(default_factory=list)
    fixed_price: D = ZERO
    hourly_rate: D = ZERO
    custom_price: D = ZERO
    margin_mode: str = "margin"  # margin | markup | none
    profit_margin: D = ZERO
    markup_pct: D = ZERO
    contingency_pct: D = ZERO
    contingency_in_client_price: bool = False
    discount_pct: D = ZERO
    additional_charges: D = ZERO
    minimum_price: D = ZERO
    gst_enabled: bool = False
    gst_rate: D = ZERO
    maintenance_package: str = "none"
    maintenance_billing: str = "monthly"  # monthly | annual | custom
    maintenance_custom_amount: D | None = None
    maintenance_months: int = 12
    maintenance_prices: dict = field(default_factory=lambda: dict(MAINTENANCE_DEFAULTS))
    hours_per_day: D = D("6")
    timeline_override_days: int | None = None


def _by_dev(pairs) -> dict[str, D]:
    out: dict[str, D] = {}
    for mid, hrs in pairs:
        k = str(mid) if mid is not None else "unassigned"
        out[k] = out.get(k, ZERO) + hrs
    return out


def calculate(i: CalcInput) -> dict:
    if i.pricing_method not in METHODS:
        raise CalculationError(f"Unknown pricing method: {i.pricing_method}")
    if i.gst_enabled and not (ZERO <= i.gst_rate <= HUNDRED):
        raise CalculationError("GST rate must be between 0 and 100")
    for name in ("discount_pct", "contingency_pct"):
        if not (ZERO <= getattr(i, name) <= HUNDRED):
            raise CalculationError(f"{name} must be between 0 and 100")
    if i.margin_mode == "margin" and not (ZERO <= i.profit_margin < HUNDRED):
        raise CalculationError("profit_margin must be at least 0 and below 100")
    warnings: list[str] = []

    # --- hours and internal development cost (no double counting) ---
    alloc_hours = sum((l.hours for l in i.alloc), ZERO)
    if alloc_hours > 0:
        source, total_hours = "allocation", alloc_hours
        internal_dev = q(sum((l.hours * l.rate for l in i.alloc), ZERO))
        by_dev = _by_dev((l.team_member_id, l.hours) for l in i.alloc)
    else:
        source = "items"
        total_hours = sum((l.hours for l in i.items), ZERO)
        internal_dev = q(sum((l.internal_cost for l in i.items), ZERO))
        by_dev = _by_dev((l.team_member_id, l.hours) for l in i.items if l.hours > 0)

    # --- development price ---
    items_total = sum((q(l.unit_price * l.quantity) for l in i.items), ZERO)
    if i.pricing_method == "fixed":
        dev_price = q(i.fixed_price)
    elif i.pricing_method == "hourly":
        dev_price = q(total_hours * i.hourly_rate)
    elif i.pricing_method == "feature":
        dev_price = q(items_total)
    else:
        dev_price = q(i.custom_price)

    # --- expenses (annualised) ---
    client_paid_total = q(sum((annualise_expense(e.amount, e.expense_type) for e in i.expenses if e.billing_type == "client_billed"), ZERO))
    absorbed_total = q(sum((annualise_expense(e.amount, e.expense_type) for e in i.expenses if e.billing_type == "absorbed"), ZERO))

    client_recurring = q(sum((e.amount for e in i.expenses if e.expense_type == "recurring" and e.billing_type == "client_billed"), ZERO))
    absorbed_recurring = q(sum((e.amount for e in i.expenses if e.expense_type == "recurring" and e.billing_type == "absorbed"), ZERO))

    # --- internal cost ---
    contingency = q((internal_dev + absorbed_total) * i.contingency_pct / HUNDRED)
    total_internal = q(internal_dev + absorbed_total + contingency)

    # --- client price ---
    billed_contingency = contingency if i.contingency_in_client_price else ZERO
    additional = q(i.additional_charges)
    subtotal = q(dev_price + billed_contingency + additional + client_paid_total)
    discount = q(subtotal * i.discount_pct / HUNDRED)
    taxable = q(subtotal - discount)
    gst_rate = i.gst_rate if i.gst_enabled else ZERO
    gst = q(taxable * gst_rate / HUNDRED)
    final = q(taxable + gst)

    # --- profit fix & zero internal cost ---
    development_revenue = q(taxable - client_paid_total)
    revenue = taxable

    if total_internal == ZERO:
        profit_evaluable = False
        profit = None
        margin = None
        warnings.append("Internal cost is ₹0. Enter developer hours in Step 3 or internal expenses in Step 4 so profit can be evaluated.")
    else:
        profit_evaluable = True
        profit = q(development_revenue - total_internal)
        margin = q(profit / development_revenue * HUNDRED) if development_revenue > 0 else ZERO

    # --- suggested price ---
    if total_internal == ZERO:
        suggested_development_price = None
        suggested_revenue = None
        suggested_client_price = None
    else:
        if i.margin_mode == "margin":
            target = total_internal / (1 - i.profit_margin / HUNDRED)
        elif i.margin_mode == "markup":
            target = total_internal * (1 + i.markup_pct / HUNDRED)
        else:
            target = total_internal
        suggested_dev = q(target)
        if i.minimum_price > 0:
            suggested_dev = max(suggested_dev, q(i.minimum_price))
        suggested_development_price = q(suggested_dev)
        suggested_revenue = suggested_development_price  # compatibility key
        suggested_before_gst = q(suggested_development_price + client_paid_total)
        if i.gst_enabled and gst_rate > 0:
            suggested_client_price = q(suggested_before_gst + q(suggested_before_gst * gst_rate / HUNDRED))
        else:
            suggested_client_price = suggested_before_gst

    # --- maintenance (recurring, separate from the one-time price) ---
    m_month = ZERO
    if i.maintenance_package != "none":
        if i.maintenance_billing == "custom":
            if i.maintenance_custom_amount is None:
                raise CalculationError("Custom maintenance billing needs an amount")
            m_month = q(i.maintenance_custom_amount)
        else:
            if i.maintenance_package not in i.maintenance_prices:
                raise CalculationError(f"Unknown maintenance package: {i.maintenance_package}")
            m_month = q(i.maintenance_prices[i.maintenance_package])
    months = max(int(i.maintenance_months), 1)
    maintenance_annual = q(m_month * 12)
    first_year = q(final + m_month * months)

    # --- timeline ---
    if by_dev and max(by_dev.values()) > 0 and i.hours_per_day > 0:
        auto_days = int(math.ceil(max(by_dev.values()) / i.hours_per_day))
    else:
        auto_days = 0
    days = i.timeline_override_days if i.timeline_override_days is not None else auto_days

    if i.minimum_price > 0 and development_revenue < i.minimum_price:
        warnings.append("Price before GST is below the minimum acceptable project price.")
    if profit is not None and profit < 0:
        warnings.append("Estimated profit is negative.")
    if dev_price == 0 and i.pricing_method != "custom":
        warnings.append("Development price is zero.")

    return {
        "internal_cost_source": source,
        "total_hours": q(total_hours),
        "hours_by_developer": {k: q(v) for k, v in by_dev.items()},
        "development_price": dev_price,
        "billed_contingency": billed_contingency,
        "additional_charges": additional,
        "client_billed_expenses": client_paid_total,
        "client_paid_total": client_paid_total,
        "subtotal": subtotal,
        "discount_amount": discount,
        "taxable_amount": taxable,
        "gst_rate": gst_rate,
        "gst_amount": gst,
        "final_client_price": final,
        "internal_development_cost": internal_dev,
        "internal_expenses": absorbed_total,
        "absorbed_total": absorbed_total,
        "contingency_amount": contingency,
        "total_internal_cost": total_internal,
        "revenue_excluding_gst": revenue,
        "development_revenue": development_revenue,
        "profit_evaluable": profit_evaluable,
        "estimated_profit": profit,
        "profit_margin": margin,
        "suggested_revenue": suggested_revenue,
        "suggested_development_price": suggested_development_price,
        "suggested_client_price": suggested_client_price,
        "recurring_client_monthly": client_recurring,
        "recurring_absorbed_monthly": absorbed_recurring,
        "maintenance_monthly": m_month,
        "maintenance_annual": maintenance_annual,
        "first_year_total": first_year,
        "auto_delivery_days": auto_days,
        "estimated_delivery_days": days,
        "warnings": warnings,
    }


def split_milestones(final: D, milestones: list[tuple[str, D]]) -> list[dict]:
    """Split the final price. Percentages must sum to exactly 100. The last milestone takes the rounding remainder."""
    if not milestones:
        raise CalculationError("At least one milestone is required")
    if sum((p for _, p in milestones), ZERO) != HUNDRED:
        raise CalculationError("Milestone percentages must add up to 100")
    rows, running = [], ZERO
    for idx, (name, pct) in enumerate(milestones, start=1):
        last = idx == len(milestones)
        amount = q(final - running) if last else q(final * pct / HUNDRED)
        running += amount
        rows.append({"milestone_name": name, "percentage": pct, "amount": amount, "sequence_number": idx})
    return rows


def payment_schedule(final: D, milestones: list, deployment_total: D = ZERO) -> dict:
    """Derive payment schedule. Deducts deployment_total from the last milestone.
    Amounts for milestones 1..N-1 = round(final x pct / 100); last = final - sum of the others.
    If deployment_total > 0: inserts computed row before the last milestone.
    If deployment_total > last_amount: returns shortfall and warning.
    """
    final = q(final)
    deployment_total = q(deployment_total)
    if not milestones:
        raise CalculationError("At least one milestone is required")

    pairs = []
    for m in milestones:
        if isinstance(m, tuple):
            name, pct = m[0], D(str(m[1]))
        elif isinstance(m, dict):
            name = m.get("milestone_name") or m.get("name", "")
            pct = D(str(m.get("percentage", 0)))
        else:
            name = getattr(m, "milestone_name", getattr(m, "name", ""))
            pct = D(str(getattr(m, "percentage", 0)))
        pairs.append((name, pct))

    if sum((p for _, p in pairs), ZERO) != HUNDRED:
        raise CalculationError("Milestone percentages must add up to 100")

    base_rows = []
    running = ZERO
    for idx, (name, pct) in enumerate(pairs, start=1):
        last = idx == len(pairs)
        amount = q(final - running) if last else q(final * pct / HUNDRED)
        running += amount
        base_rows.append({
            "milestone_name": name,
            "name": name,
            "percentage": pct,
            "amount": amount,
            "sequence_number": idx,
            "is_deployment": False,
        })

    warning = None
    shortfall = ZERO
    rows = [dict(r) for r in base_rows]
    if deployment_total > ZERO:
        last_amount = rows[-1]["amount"]
        deployment_row_amount = min(deployment_total, last_amount)
        rows[-1]["amount"] = q(last_amount - deployment_row_amount)
        dep_row = {
            "milestone_name": "Deployment & setup expenses (before deployment)",
            "name": "Deployment & setup expenses (before deployment)",
            "percentage": None,
            "amount": deployment_row_amount,
            "sequence_number": len(rows),
            "is_deployment": True,
        }
        rows.insert(-1, dep_row)
        for i, r in enumerate(rows, start=1):
            r["sequence_number"] = i

        if deployment_total > last_amount:
            shortfall = q(deployment_total - last_amount)
            warning = (f"Deployment expenses exceed the final milestone by ₹{shortfall:,.2f}. "
                       f"Collect ₹{shortfall:,.2f} more before deployment, e.g. raise the advance %.")

    return {
        "rows": rows,
        "warning": warning,
        "shortfall": shortfall,
    }
