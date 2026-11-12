"""Two serializers, two templates. The client serializer is an explicit whitelist: nothing internal can reach it."""
from __future__ import annotations

import base64
import mimetypes
import urllib.parse
from datetime import date
from decimal import Decimal as D
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.services import calculation_service as calc
from app.utils.currency import amount_in_words_inr, format_inr
from app.utils.qr import QrCode

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=select_autoescape(["html"]))
env.filters["inr"] = format_inr
env.filters["words_inr"] = amount_in_words_inr

MAINTENANCE_TERMS = {
    "basic": "Bug fixes, technical support and backups. Up to 1 hour of work per month.",
    "standard": "Everything in Basic, plus security updates, performance monitoring and minor content updates. Up to 3 hours per month.",
    "premium": "Everything in Standard, plus priority support, advanced monitoring and additional maintenance hours. Up to 6 hours per month.",
}


def _logo_uri(logo_path: str | None, upload_dir: str | None) -> str | None:
    if not logo_path or not upload_dir:
        return None
    p = Path(upload_dir) / logo_path
    if not p.is_file():
        return None
    mime = mimetypes.guess_type(p.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"


def _business(settings, upload_dir):
    return {
        "name": settings.business_name or "Logic Loops",
        "tagline": getattr(settings, "tagline", None) or "Software Architecture & Design Studio",
        "brand_color": getattr(settings, "brand_color", None) or "#111827",
        "upi_id": getattr(settings, "upi_id", None) or "",
        "gstin": getattr(settings, "gstin", None) or "",
        "email": settings.email,
        "phone": settings.phone,
        "whatsapp": settings.whatsapp,
        "address": settings.address,
        "website": settings.website,
        "logo": _logo_uri(settings.logo_path, upload_dir),
    }


def serialize_client(est, settings, quotation, upload_dir=None) -> dict:
    """Whitelist only. Never pass the estimate object or the calc_details dict to the template."""
    cd = est.calc_details or {}
    feature_mode = est.pricing_method == "feature"
    client_expenses = []
    for e in est.expenses:
        if e.billing_type == "client_billed":
            amt = e.amount
            ann_amt = amt * D(12) if e.expense_type == "recurring" else amt
            client_expenses.append({
                "name": e.name,
                "category": e.category,
                "amount": amt,
                "annual_amount": ann_amt,
                "recurring": e.expense_type == "recurring",
                "expense_type": e.expense_type,
            })
    deployment_items = client_expenses
    deployment_total = sum((e["annual_amount"] for e in deployment_items), D("0"))
    m_month = D(str(cd.get("maintenance_monthly", 0)))
    pkg = (est.adjustments or {}).get("maintenance", {}).get("package", "none")
    months = int((est.adjustments or {}).get("maintenance", {}).get("months", 12))
    days = est.estimated_delivery_days or 0
    dev_price = D(str(cd.get("development_price", 0)))
    base_milestones = [(m.milestone_name, m.percentage) for m in est.milestones]
    if not base_milestones:
        base_milestones = [("Advance Payment", D("50")), ("Design Approval", D("30")), ("On Delivery", D("20"))]
    schedule = calc.payment_schedule(est.final_client_price, base_milestones, deployment_total)
    milestones = schedule["rows"]

    # 1. Clean client data (filter out placeholders like 'user')
    raw_client = est.client
    placeholders = {"user", "admin", "dev1", "dev2", "placeholder", "test", "demo", "none", "null"}
    c_name = raw_client.name.strip() if (raw_client and raw_client.name and raw_client.name.strip().lower() not in placeholders) else None
    c_company = raw_client.company.strip() if (raw_client and raw_client.company and raw_client.company.strip().lower() not in placeholders) else None
    c_email = raw_client.email.strip() if (raw_client and raw_client.email and raw_client.email.strip().lower() not in placeholders and "@example.com" not in raw_client.email.lower()) else None
    c_phone = raw_client.phone.strip() if (raw_client and raw_client.phone and raw_client.phone.strip()) else None

    # 2. Group line items: 4-6 deliverables max with bold title, description, and right-aligned price
    line_items = []
    raw_items = list(est.items)
    raw_client_expenses = [e for e in est.expenses if e.billing_type == "client_billed"]

    all_raw = []
    for i in raw_items:
        p = i.total_price if (feature_mode and i.total_price) else (dev_price / len(raw_items) if len(raw_items) else D(0))
        all_raw.append({
            "title": i.feature_name_snapshot,
            "description": (i.description_snapshot or "Feature architecture, design and verification").strip(),
            "price": p,
        })
    for ce in raw_client_expenses:
        all_raw.append({
            "title": ce.name or "Third-party / Infrastructure",
            "description": (ce.category or "Domain, hosting, or pass-through expense").strip(),
            "price": ce.amount,
        })

    if not all_raw:
        all_raw.append({
            "title": "Full-Stack Custom Engineering",
            "description": "Complete application engineering and deliverable execution",
            "price": dev_price if dev_price > 0 else est.subtotal,
        })

    if len(all_raw) <= 6:
        line_items = all_raw
    else:
        # Keep top 5 items and bundle remaining into the 6th
        sorted_all = sorted(all_raw, key=lambda x: x["price"] or D(0), reverse=True)
        top = sorted_all[:5]
        rem = sorted_all[5:]
        rem_price = sum((x["price"] for x in rem), D(0))
        rem_names = ", ".join([x["title"] for x in rem[:2]])
        if len(rem) > 2:
            rem_names += f" + {len(rem) - 2} other deliverables"
        line_items = top + [{
            "title": "Additional Deliverables & Services",
            "description": f"Includes {rem_names}",
            "price": rem_price,
        }]

    # 3. Payment schedule: small 3-row table (50% advance / 30% at design approval / 20% on delivery)
    custom_milestones = list(est.milestones)
    if len(custom_milestones) == 3:
        payment_schedule_rows = []
        for m in custom_milestones:
            pct = D(str(m.percentage))
            amt = calc.q(est.final_client_price * (pct / D(100)))
            pct_label = f"{int(pct)}%" if pct == int(pct) else f"{pct}%"
            payment_schedule_rows.append({
                "name": m.milestone_name,
                "percentage": pct_label,
                "amount": amt,
            })
        diff = est.final_client_price - sum((r["amount"] for r in payment_schedule_rows), D(0))
        if payment_schedule_rows:
            payment_schedule_rows[-1]["amount"] += diff
    else:
        final_amt = est.final_client_price
        a1 = calc.q(final_amt * D("0.50"))
        a2 = calc.q(final_amt * D("0.30"))
        a3 = final_amt - a1 - a2
        payment_schedule_rows = [
            {"name": "Advance Payment", "percentage": "50%", "amount": a1},
            {"name": "Design Approval", "percentage": "30%", "amount": a2},
            {"name": "On Delivery", "percentage": "20%", "amount": a3},
        ]

    # 4. Advance amount & UPI QR
    advance_amount = payment_schedule_rows[0]["amount"] if payment_schedule_rows else calc.q(est.final_client_price * D("0.50"))
    b_dict = _business(settings, upload_dir)
    upi_id = b_dict.get("upi_id")
    b_name = b_dict.get("name") or "Logic Loops"
    q_num = quotation.quotation_number or "QT"
    if upi_id:
        encoded_b_name = urllib.parse.quote(b_name)
        upi_uri = f"upi://pay?pa={upi_id}&pn={encoded_b_name}&am={advance_amount:.2f}&cu=INR&tn={q_num}"
        try:
            qr_svg = QrCode.to_svg(upi_uri, border=1, size_px=76, fg=b_dict.get("brand_color") or "#111827")
        except Exception:
            qr_svg = None
    else:
        qr_svg = None

    # 5. Included and Not included (max 4 bullets each)
    included = [
        "Bespoke UI/UX design & responsive layouts",
        "Core feature implementation & business logic",
        "Production server deployment, custom domain & SSL",
        "30-day post-launch warranty & source code handover",
    ]
    not_included = [
        "Third-party paid API tokens & cloud infrastructure fees",
        "Raw copywriting, marketing & photographic media",
        "Feature additions outside agreed deliverables",
        "Ongoing annual maintenance (quoted separately)",
    ]

    return {
        "business": b_dict,
        "quotation_number": quotation.quotation_number,
        "issue_date": quotation.issue_date,
        "expiry_date": quotation.expiry_date,
        "client": {
            "name": c_name,
            "company": c_company,
            "email": c_email,
            "phone": c_phone,
        },
        "project": {
            "name": est.project_name or "Custom Software Solution",
            "type": est.project_type or "",
            "description": est.project_description or "",
        },
        "line_items": line_items,
        "subtotal": est.subtotal,
        "discount_amount": est.discount_amount,
        "gst_applies": est.gst_amount > 0,
        "gst_rate": est.gst_rate,
        "gst_amount": est.gst_amount,
        "final_price": est.final_client_price,
        "amount_in_words": amount_in_words_inr(est.final_client_price),
        "payment_schedule": payment_schedule_rows,
        "advance_amount": advance_amount,
        "qr_svg": qr_svg,
        "included": included,
        "not_included": not_included,
        "maintenance": ({"package": pkg.title(), "monthly": m_month, "months": months, "annual": m_month * months, "terms": MAINTENANCE_TERMS.get(pkg, "")}
                        if pkg != "none" and m_month > 0 else None),
        # Backward compatibility keys for existing templates / tests
        "scope": [{"name": i.feature_name_snapshot, "description": i.description_snapshot, "quantity": i.quantity,
                   "unit_price": i.unit_price if feature_mode else None,
                   "total": i.total_price if feature_mode else None} for i in est.items],
        "deliverables": [i.feature_name_snapshot for i in est.items],
        "show_item_prices": feature_mode,
        "development_price": dev_price,
        "deployment_items": deployment_items,
        "deployment_total": deployment_total,
        "delivery_days": days, "delivery_weeks": (days + 4) // 5 if days else 0,
        "extra_lines": ([{"label": "Project management and delivery assurance", "amount": D(str(cd["billed_contingency"]))}]
                        if D(str(cd.get("billed_contingency", 0))) > 0 else []) +
                       ([{"label": "Additional charges", "amount": D(str(cd["additional_charges"]))}]
                        if D(str(cd.get("additional_charges", 0))) > 0 else []),
        "client_expenses": deployment_items,
        "recurring_expenses": [e for e in client_expenses if e["recurring"]],
        "taxable_amount": est.taxable_amount,
        "milestones": milestones,
        "revision_policy": settings.revision_policy,
        "payment_terms": settings.payment_terms,
        "terms": [t.strip() for t in (settings.terms_and_conditions or "").splitlines() if t.strip()],
    }


def serialize_internal(est, settings, members: dict, upload_dir=None) -> dict:
    cd = est.calc_details or {}
    D_ = lambda k: D(str(cd.get(k, 0)))  # noqa: E731
    def member(k):
        return members.get(int(k), {}) if str(k).isdigit() else {}

    workload = [{"name": member(k).get("name", "Unassigned"), "hours": D(str(h)), "rate": member(k).get("rate")}
                for k, h in (cd.get("hours_by_developer") or {}).items()]
    for w in workload:
        w["cost"] = (w["hours"] * w["rate"]) if w["rate"] is not None else None

    profit_evaluable = cd.get("profit_evaluable", True)
    margin = cd.get("profit_margin")
    profit = cd.get("estimated_profit")
    profit_text = f"{format_inr(D(str(profit)))} ({margin}%)" if profit_evaluable and profit is not None and margin is not None else "Not evaluated"
    profit_amount_display = format_inr(D(str(profit))) if profit_evaluable and profit is not None else "Not evaluated"
    margin_display = f"{margin}%" if profit_evaluable and margin is not None else "Not evaluated"

    target_margin = (est.adjustments or {}).get("profit_margin")
    if (est.adjustments or {}).get("margin_mode") == "margin" and target_margin is not None:
        target_margin_display = f"{target_margin}%"
    else:
        target_margin_display = (est.adjustments or {}).get("margin_mode", "none").title()

    sugg_dev = cd.get("suggested_development_price")
    sugg_dev_display = format_inr(D(str(sugg_dev))) if sugg_dev is not None else "—"

    return {
        "business": _business(settings, upload_dir), "number": est.estimate_number, "status": est.status,
        "generated": date.today(),
        "client": {"name": est.client.name if est.client else "", "company": est.client.company if est.client else None,
                   "email": est.client.email if est.client else None, "phone": est.client.phone if est.client else None},
        "project": {"name": est.project_name, "description": est.project_description, "type": est.project_type,
                    "complexity": est.complexity.title(), "pricing_method": est.pricing_method.title()},
        "items": [{"name": i.feature_name_snapshot, "quantity": i.quantity, "hours": i.estimated_hours,
                   "client_price": i.total_price, "internal_cost": i.internal_cost,
                   "developer": members.get(i.assigned_team_member_id, {}).get("name", "")} for i in est.items],
        "allocation": [{"category": a["category"], "hours": D(str(a["hours"])), "rate": D(str(a["rate"])),
                        "developer": members.get(a.get("team_member_id"), {}).get("name", "Unassigned"),
                        "cost": D(str(a["hours"])) * D(str(a["rate"]))} for a in (est.dev_allocation or [])],
        "workload": workload,
        "expenses": [{"name": e.name, "category": e.category, "amount": e.amount,
                      "type": "Recurring (monthly)" if e.expense_type == "recurring" else ("Yearly" if e.expense_type == "yearly" else ("Usage-based" if e.expense_type == "usage" else "One-time")),
                      "billing": "Client-billed" if e.billing_type == "client_billed" else "Absorbed"} for e in est.expenses],
        "totals": {
            "internal_dev": est.internal_development_cost,
            "internal_expenses": est.internal_expenses,
            "deployment_cost": D_("client_paid_total") or D_("client_billed_expenses"),
            "contingency": est.contingency_amount,
            "total_cost": est.total_internal_cost,
            "target_margin": target_margin_display,
            "profit": profit_amount_display,
            "profit_val": D(str(profit)) if profit is not None else None,
            "margin": margin_display,
            "profit_text": profit_text,
            "profit_evaluable": profit_evaluable,
            "suggested_dev": sugg_dev_display,
            "final": est.final_client_price,
            "maintenance_monthly": D_("maintenance_monthly"),
            "maintenance_annual": D_("maintenance_annual") or (D_("maintenance_monthly") * 12),
            "first_year": D_("first_year_total"),
            "development_price": D_("development_price"),
            "subtotal": est.subtotal, "discount": est.discount_amount,
            "taxable": est.taxable_amount, "gst_rate": est.gst_rate, "gst": est.gst_amount,
            "billed_contingency": D_("billed_contingency"),
            "revenue": D_("revenue_excluding_gst"),
            "development_revenue": D_("development_revenue"),
            "suggested": format_inr(D(str(cd.get("suggested_client_price")))) if cd.get("suggested_client_price") is not None else "—",
            "hours": est.estimated_hours, "days": est.estimated_delivery_days,
            "recurring_absorbed": D_("recurring_absorbed_monthly"), "recurring_client": D_("recurring_client_monthly"),
        },
        "warnings": cd.get("warnings", []),
    }


def render_html(kind: str, context: dict) -> str:
    return env.get_template("client_quotation.html" if kind == "client" else "internal_estimate.html").render(**context)


def html_to_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:  # OSError: missing GTK/Pango libraries (common on Windows)
        raise RuntimeError("WeasyPrint is not available. On Windows install the GTK runtime, or run the backend in CI or Docker.") from exc
    return HTML(string=html).write_pdf()
