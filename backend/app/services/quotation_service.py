from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Estimate, Quotation
from app.services.estimate_service import EstimateError, get_settings_row
from app.utils.numbering import format_number, next_sequence

STATUSES = ("Draft", "Sent", "Accepted", "Rejected", "Expired")


def create_quotation(db: Session, est: Estimate, issue: date | None = None, validity_days: int | None = None) -> Quotation:
    s = get_settings_row(db)
    issue = issue or date.today()
    days = validity_days or s.quotation_validity_days
    year = datetime.now(timezone.utc).year
    existing = [n for (n,) in db.query(Quotation.quotation_number)]
    q = Quotation(estimate_id=est.id, status="Draft", issue_date=issue, expiry_date=issue + timedelta(days=days),
                  quotation_number=format_number(s.quotation_prefix, year, next_sequence(existing, s.quotation_prefix, year)))
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


def ensure_quotation(db: Session, est: Estimate) -> Quotation:
    return est.quotations[-1] if est.quotations else create_quotation(db, est)


def set_status(db: Session, q: Quotation, status: str) -> Quotation:
    if status not in STATUSES:
        raise EstimateError(f"Invalid status: {status}")
    q.status = status
    est = db.get(Estimate, q.estimate_id)
    est.status = status  # the estimate mirrors the status of its latest quotation
    db.commit()
    db.refresh(q)
    return q


def expire_overdue(db: Session) -> None:
    """Sent quotations past their expiry date become Expired."""
    changed = False
    for q in db.query(Quotation).filter(Quotation.status == "Sent", Quotation.expiry_date < date.today()):
        q.status = "Expired"
        est = db.get(Estimate, q.estimate_id)
        if est and est.status == "Sent":
            est.status = "Expired"
        changed = True
    if changed:
        db.commit()
