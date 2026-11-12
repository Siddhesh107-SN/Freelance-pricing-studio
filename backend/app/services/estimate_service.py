"""Estimate persistence. Resolves configuration, snapshots it, and recalculates through calculation_service."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal as D

from sqlalchemy.orm import Session

from app.models import (BusinessSettings, Client, Estimate, EstimateItem, Expense, Feature,
                        PaymentMilestone, TeamMember)
from app.schemas.estimate import EstimateIn
from app.services import calculation_service as calc
from app.utils.numbering import format_number, next_sequence

DEFAULT_MILESTONES = [("Advance on project confirmation", D(40)), ("After development milestone", D(30)),
                      ("Before final delivery", D(30))]


class EstimateError(Exception):
    status_code = 422


def get_settings_row(db: Session) -> BusinessSettings:
    row = db.query(BusinessSettings).first()
    if row is None:
        row = BusinessSettings()
        db.add(row)
        db.flush()
    return row


def _d(v) -> D:
    return v if isinstance(v, D) else D(str(v if v not in (None, "") else 0))


def resolve(db: Session, p: EstimateIn) -> dict:
    """Turn a request into snapshot rows using the configured prices and developer rates, never client totals."""
    members = {m.id: m for m in db.query(TeamMember).filter(TeamMember.active.is_(True))}

    def rate(mid):
        if mid is None:
            return D(0)
        if mid not in members:
            raise EstimateError(f"Unknown or inactive team member: {mid}")
        return members[mid].internal_hourly_rate

    items = []
    for it in p.items:
        if it.feature_id is not None:
            f = db.get(Feature, it.feature_id)
            if f is None or f.deleted_at is not None:
                raise EstimateError(f"Feature {it.feature_id} no longer exists")
            price = {"basic": f.basic_price, "intermediate": f.intermediate_price, "advanced": f.advanced_price}[p.complexity]
            name, desc = f.name, f.description or ""
            unit_hours = it.estimated_hours if it.estimated_hours > 0 else f.estimated_hours
            explicit = f.default_internal_cost
        else:
            price, name, desc = it.unit_price, it.name.strip(), it.description
            unit_hours, explicit = it.estimated_hours, it.internal_cost
        hours = _d(unit_hours) * it.quantity
        internal = _d(explicit) * it.quantity if _d(explicit) > 0 else hours * rate(it.assigned_team_member_id)
        items.append({"feature_id": it.feature_id, "name": name, "description": desc, "quantity": it.quantity,
                      "unit_price": _d(price), "hours": hours, "team_member_id": it.assigned_team_member_id,
                      "internal_cost": calc.q(internal)})

    alloc = [{"category": l.category, "hours": l.estimated_hours, "team_member_id": l.team_member_id,
              "rate": rate(l.team_member_id), "completion_days": l.completion_days}
             for l in p.dev_allocation if l.estimated_hours > 0]
    return {
        "items": items, "alloc": alloc,
        "expenses": [e.model_dump() for e in p.expenses],
        "pricing": p.pricing.model_dump(mode="json"),
        "pricing_method": p.pricing_method, "timeline_override_days": p.timeline_override_days,
    }


def to_calc_input(res: dict, settings: BusinessSettings) -> calc.CalcInput:
    pr = res["pricing"]
    mt = pr.get("maintenance", {})
    extra = settings.extra_defaults or {}
    prices = {k: _d(v) for k, v in {**{k: str(v) for k, v in calc.MAINTENANCE_DEFAULTS.items()},
                                    **extra.get("maintenance_prices", {})}.items()}
    return calc.CalcInput(
        pricing_method=res["pricing_method"],
        items=[calc.ItemLine(i["name"], i["quantity"], _d(i["unit_price"]), _d(i["hours"]), _d(i["internal_cost"]),
                             i["team_member_id"]) for i in res["items"]],
        alloc=[calc.AllocLine(a["category"], _d(a["hours"]), _d(a["rate"]), a["team_member_id"]) for a in res["alloc"]],
        expenses=[calc.ExpenseLine(e["name"], _d(e["amount"]), e["expense_type"], e["billing_type"]) for e in res["expenses"]],
        fixed_price=_d(pr["fixed_price"]), hourly_rate=_d(pr["hourly_rate"]), custom_price=_d(pr["custom_price"]),
        margin_mode=pr["margin_mode"], profit_margin=_d(pr["profit_margin"]), markup_pct=_d(pr["markup_pct"]),
        contingency_pct=_d(pr["contingency_pct"]), contingency_in_client_price=pr["contingency_in_client_price"],
        discount_pct=_d(pr["discount_pct"]), additional_charges=_d(pr["additional_charges"]),
        minimum_price=_d(pr["minimum_price"]), gst_enabled=pr["gst_enabled"], gst_rate=_d(pr["gst_rate"]),
        maintenance_package=mt.get("package", "none"), maintenance_billing=mt.get("billing", "monthly"),
        maintenance_custom_amount=None if mt.get("custom_amount") is None else _d(mt["custom_amount"]),
        maintenance_months=mt.get("months", 12), maintenance_prices=prices,
        hours_per_day=_d(extra.get("hours_per_day", 6)), timeline_override_days=res["timeline_override_days"],
    )


def preview(db: Session, p: EstimateIn) -> dict:
    res = resolve(db, p)
    result = calc.calculate(to_calc_input(res, get_settings_row(db)))
    ms = [(m.milestone_name, m.percentage) for m in p.milestones] if p.milestones else DEFAULT_MILESTONES
    result["payment_schedule"] = calc.payment_schedule(result["final_client_price"], ms, result.get("client_paid_total", D("0")))
    return result


def _jsonable(d: dict) -> dict:
    def conv(v):
        if isinstance(v, D):
            return str(v)
        if isinstance(v, dict):
            return {k: conv(x) for k, x in v.items()}
        if isinstance(v, list):
            return [conv(x) for x in v]
        return v
    return conv(d)


def _apply(est: Estimate, result: dict) -> None:
    for col in ("subtotal", "discount_amount", "taxable_amount", "gst_rate", "gst_amount", "final_client_price",
                "internal_development_cost", "internal_expenses", "contingency_amount", "total_internal_cost"):
        setattr(est, col, result[col])
    if result.get("profit_evaluable", True) and result.get("estimated_profit") is not None:
        est.estimated_profit = result["estimated_profit"]
        est.profit_margin = result["profit_margin"]
    else:
        est.estimated_profit = D("0")
        est.profit_margin = D("0")
    est.estimated_hours = result["total_hours"]
    est.estimated_delivery_days = result["estimated_delivery_days"]
    est.calc_details = _jsonable(result)


def _write_milestones(est: Estimate, p_milestones, final: D) -> None:
    pairs = [(m.milestone_name, m.percentage) for m in p_milestones] if p_milestones else DEFAULT_MILESTONES
    est.milestones = [PaymentMilestone(**row) for row in calc.split_milestones(final, pairs)]


def _resolve_client(db: Session, p: EstimateIn) -> Client | None:
    if p.client_id is not None:
        c = db.get(Client, p.client_id)
        if c is None or c.deleted_at is not None:
            raise EstimateError("Client not found")
        if p.client is not None:  # edits made in the estimate form update the same client row
            for k, v in p.client.model_dump().items():
                setattr(c, k, v)
        return c
    if p.client is not None:
        c = Client(**p.client.model_dump())
        db.add(c)
        db.flush()
        return c
    return None


def _next_number(db: Session, prefix: str, existing_query) -> str:
    year = datetime.now(timezone.utc).year
    existing = [n for (n,) in existing_query]
    return format_number(prefix, year, next_sequence(existing, prefix, year))


def save(db: Session, p: EstimateIn, user_id: int | None, estimate: Estimate | None = None) -> Estimate:
    """Create or update an estimate in one transaction."""
    try:
        settings = get_settings_row(db)
        res = resolve(db, p)
        result = calc.calculate(to_calc_input(res, settings))
        ms = [(m.milestone_name, m.percentage) for m in p.milestones] if p.milestones else DEFAULT_MILESTONES
        result["payment_schedule"] = calc.payment_schedule(result["final_client_price"], ms, result.get("client_paid_total", D("0")))
        client = _resolve_client(db, p)
        is_new = estimate is None
        if is_new:
            estimate = Estimate(estimate_number=_next_number(db, "EST", db.query(Estimate.estimate_number)),
                                status="Draft", created_by=user_id)
        estimate.client_id = client.id if client else None
        estimate.project_name = p.project_name
        estimate.project_description = p.project_description
        estimate.project_type = p.project_type
        estimate.category_id = p.category_id
        estimate.complexity = p.complexity
        estimate.pricing_method = p.pricing_method
        estimate.timeline_override_days = p.timeline_override_days
        estimate.adjustments = res["pricing"]
        estimate.dev_allocation = _jsonable({"lines": res["alloc"]})["lines"]
        estimate.items = [EstimateItem(
            feature_id=i["feature_id"], feature_name_snapshot=i["name"], description_snapshot=i["description"],
            quantity=i["quantity"], unit_price=i["unit_price"], estimated_hours=i["hours"],
            assigned_team_member_id=i["team_member_id"], internal_cost=i["internal_cost"],
            total_price=calc.q(i["unit_price"] * i["quantity"])) for i in res["items"]]
        estimate.expenses = [Expense(**e) for e in res["expenses"]]
        _apply(estimate, result)
        _write_milestones(estimate, p.milestones, result["final_client_price"])
        if is_new:
            db.add(estimate)
        db.commit()
        db.refresh(estimate)
        return estimate
    except Exception:
        db.rollback()
        raise


def rebuild_resolved(est: Estimate) -> dict:
    """Rebuild calculation input from stored snapshot rows, so old estimates keep their original prices and rates."""
    return {
        "items": [{"name": i.feature_name_snapshot, "quantity": i.quantity, "unit_price": i.unit_price,
                   "hours": i.estimated_hours, "internal_cost": i.internal_cost,
                   "team_member_id": i.assigned_team_member_id} for i in est.items],
        "alloc": [{"category": a["category"], "hours": a["hours"], "rate": a["rate"],
                   "team_member_id": a.get("team_member_id")} for a in (est.dev_allocation or [])],
        "expenses": [{"name": e.name, "amount": e.amount, "expense_type": e.expense_type,
                      "billing_type": e.billing_type} for e in est.expenses],
        "pricing": est.adjustments, "pricing_method": est.pricing_method,
        "timeline_override_days": est.timeline_override_days,
    }


def recalculate(db: Session, est: Estimate) -> Estimate:
    result = calc.calculate(to_calc_input(rebuild_resolved(est), get_settings_row(db)))
    pairs = [(m.milestone_name, m.percentage) for m in est.milestones] or DEFAULT_MILESTONES
    result["payment_schedule"] = calc.payment_schedule(result["final_client_price"], pairs, result.get("client_paid_total", D("0")))
    _apply(est, result)
    est.milestones = [PaymentMilestone(**r) for r in calc.split_milestones(result["final_client_price"], pairs)]
    db.commit()
    db.refresh(est)
    return est


def duplicate(db: Session, est: Estimate, user_id: int | None) -> Estimate:
    new = Estimate(estimate_number=_next_number(db, "EST", db.query(Estimate.estimate_number)), status="Draft",
                   created_by=user_id)
    for col in ("client_id", "project_description", "project_type", "category_id", "complexity", "pricing_method",
                "timeline_override_days", "adjustments", "dev_allocation"):
        setattr(new, col, getattr(est, col))
    new.project_name = f"{est.project_name} (copy)"
    new.items = [EstimateItem(feature_id=i.feature_id, feature_name_snapshot=i.feature_name_snapshot,
                              description_snapshot=i.description_snapshot, quantity=i.quantity, unit_price=i.unit_price,
                              estimated_hours=i.estimated_hours, assigned_team_member_id=i.assigned_team_member_id,
                              internal_cost=i.internal_cost, total_price=i.total_price) for i in est.items]
    new.expenses = [Expense(name=e.name, category=e.category, amount=e.amount, expense_type=e.expense_type,
                            billing_type=e.billing_type, notes=e.notes) for e in est.expenses]
    new.milestones = [PaymentMilestone(milestone_name=m.milestone_name, percentage=m.percentage, amount=m.amount,
                                       sequence_number=m.sequence_number) for m in est.milestones]
    db.add(new)
    db.flush()
    _apply(new, calc.calculate(to_calc_input(rebuild_resolved(new), get_settings_row(db))))
    db.commit()
    db.refresh(new)
    return new
