from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import Estimate, Quotation
from app.schemas.quotation import QuotationCreate, QuotationOut, QuotationUpdate, StatusIn
from app.services import quotation_service as svc

router = APIRouter(prefix="/api/quotations", tags=["quotations"], dependencies=[Depends(get_current_user)])


def _get(db: Session, qid: int) -> Quotation:
    q = db.get(Quotation, qid)
    if q is None:
        raise HTTPException(404, "Quotation not found")
    return q


@router.get("", response_model=list[QuotationOut])
def list_quotations(db: Session = Depends(get_db)):
    svc.expire_overdue(db)
    return db.query(Quotation).order_by(Quotation.id.desc()).all()


@router.post("", response_model=QuotationOut, status_code=201)
def create(body: QuotationCreate, db: Session = Depends(get_db)):
    est = db.get(Estimate, body.estimate_id)
    if est is None or est.deleted_at:
        raise HTTPException(404, "Estimate not found")
    return svc.create_quotation(db, est, body.issue_date, body.validity_days)


@router.get("/{qid}", response_model=QuotationOut)
def read(qid: int, db: Session = Depends(get_db)):
    return _get(db, qid)


@router.put("/{qid}", response_model=QuotationOut)
def update(qid: int, body: QuotationUpdate, db: Session = Depends(get_db)):
    q = _get(db, qid)
    if body.issue_date:
        q.issue_date = body.issue_date
    if body.expiry_date:
        q.expiry_date = body.expiry_date
    if q.expiry_date < q.issue_date:
        raise HTTPException(422, "expiry_date cannot be before issue_date")
    db.commit()
    db.refresh(q)
    return q


@router.put("/{qid}/status", response_model=QuotationOut)
def set_status(qid: int, body: StatusIn, db: Session = Depends(get_db)):
    return svc.set_status(db, _get(db, qid), body.status)
