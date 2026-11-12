from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.connection import get_db
from app.models import Feature, ServiceCategory
from app.schemas.feature import FeatureIn, FeatureOut, ReorderIn

router = APIRouter(prefix="/api/features", tags=["features"])


def _get(db: Session, fid: int) -> Feature:
    f = db.get(Feature, fid)
    if f is None or f.deleted_at:
        raise HTTPException(404, "Feature not found")
    return f


def _check_category(db: Session, cid: int) -> None:
    c = db.get(ServiceCategory, cid)
    if c is None or c.deleted_at:
        raise HTTPException(422, "Category does not exist")


@router.get("", response_model=list[FeatureOut], dependencies=[Depends(get_current_user)])
def list_features(category_id: int | None = None, include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(Feature).filter(Feature.deleted_at.is_(None))
    if category_id is not None:
        q = q.filter(Feature.category_id == category_id)
    if not include_inactive:
        q = q.filter(Feature.active.is_(True))
    return q.order_by(Feature.sort_order, Feature.id).all()


@router.post("", response_model=FeatureOut, status_code=201, dependencies=[Depends(require_admin)])
def create_feature(body: FeatureIn, db: Session = Depends(get_db)):
    _check_category(db, body.category_id)
    f = Feature(**body.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.post("/reorder", status_code=204, dependencies=[Depends(require_admin)])
def reorder(body: ReorderIn, db: Session = Depends(get_db)):
    for pos, fid in enumerate(body.ids):
        f = db.get(Feature, fid)
        if f and not f.deleted_at:
            f.sort_order = pos
    db.commit()


@router.get("/{fid}", response_model=FeatureOut, dependencies=[Depends(get_current_user)])
def get_feature(fid: int, db: Session = Depends(get_db)):
    return _get(db, fid)


@router.put("/{fid}", response_model=FeatureOut, dependencies=[Depends(require_admin)])
def update_feature(fid: int, body: FeatureIn, db: Session = Depends(get_db)):
    f = _get(db, fid)
    _check_category(db, body.category_id)
    for k, v in body.model_dump().items():
        setattr(f, k, v)
    db.commit()
    db.refresh(f)
    return f


@router.delete("/{fid}", status_code=204, dependencies=[Depends(require_admin)])
def delete_feature(fid: int, db: Session = Depends(get_db)):
    f = _get(db, fid)
    f.deleted_at = datetime.now(timezone.utc)  # soft delete: old estimates keep their snapshots
    f.active = False
    db.commit()
