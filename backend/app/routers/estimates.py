from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import Estimate, User
from app.schemas.estimate import EstimateIn, EstimateListOut, EstimateOut
from app.services import estimate_service as svc
from app.services.calculation_service import CalculationError
from app.services.quotation_service import expire_overdue

router = APIRouter(prefix="/api/estimates", tags=["estimates"], dependencies=[Depends(get_current_user)])


def _get(db: Session, eid: int) -> Estimate:
    e = db.get(Estimate, eid)
    if e is None or e.deleted_at is not None:
        raise HTTPException(404, "Estimate not found")
    return e


def _guard(fn, *a):
    try:
        return fn(*a)
    except (svc.EstimateError, CalculationError) as exc:
        raise HTTPException(422, str(exc))


@router.get("", response_model=list[EstimateListOut])
def list_estimates(q: str | None = None, status: str | None = None, limit: int = 100, offset: int = 0,
                   db: Session = Depends(get_db)):
    expire_overdue(db)
    query = db.query(Estimate).filter(Estimate.deleted_at.is_(None))
    if status:
        query = query.filter(Estimate.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(Estimate.project_name.ilike(like) | Estimate.estimate_number.ilike(like))
    rows = query.order_by(Estimate.updated_at.desc()).offset(offset).limit(min(limit, 200)).all()
    return [EstimateListOut(id=e.id, estimate_number=e.estimate_number, project_name=e.project_name,
                            client_name=e.client.name if e.client else None, status=e.status,
                            final_client_price=e.final_client_price, quotation_number=e.quotation_number,
                            created_at=e.created_at, updated_at=e.updated_at) for e in rows]


@router.post("/preview")
def preview(body: EstimateIn, db: Session = Depends(get_db)):
    """Authoritative calculation without saving. The frontend uses this for the final review."""
    return _guard(svc.preview, db, body)


@router.post("", response_model=EstimateOut, status_code=201)
def create(body: EstimateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _guard(svc.save, db, body, user.id)


@router.get("/{eid}", response_model=EstimateOut)
def read(eid: int, db: Session = Depends(get_db)):
    return _get(db, eid)


@router.put("/{eid}", response_model=EstimateOut)
def update(eid: int, body: EstimateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    est = _get(db, eid)
    return _guard(svc.save, db, body, user.id, est)


@router.delete("/{eid}", status_code=204)
def delete(eid: int, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    _get(db, eid).deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/{eid}/calculate", response_model=EstimateOut)
def recalc(eid: int, db: Session = Depends(get_db)):
    return _guard(svc.recalculate, db, _get(db, eid))


@router.post("/{eid}/duplicate", response_model=EstimateOut, status_code=201)
def dup(eid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _guard(svc.duplicate, db, _get(db, eid), user.id)
