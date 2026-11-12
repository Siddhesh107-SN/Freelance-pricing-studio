from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.connection import get_db
from app.models import ServiceCategory
from app.schemas.feature import CategoryIn, CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut], dependencies=[Depends(get_current_user)])
def list_categories(include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(ServiceCategory).filter(ServiceCategory.deleted_at.is_(None))
    if not include_inactive:
        q = q.filter(ServiceCategory.active.is_(True))
    return q.order_by(ServiceCategory.sort_order, ServiceCategory.id).all()


@router.post("", response_model=CategoryOut, status_code=201, dependencies=[Depends(require_admin)])
def create_category(body: CategoryIn, db: Session = Depends(get_db)):
    c = ServiceCategory(**body.model_dump())
    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A category with this name already exists")
    db.refresh(c)
    return c


@router.put("/{cid}", response_model=CategoryOut, dependencies=[Depends(require_admin)])
def update_category(cid: int, body: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(ServiceCategory, cid)
    if c is None or c.deleted_at:
        raise HTTPException(404, "Category not found")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A category with this name already exists")
    db.refresh(c)
    return c


@router.delete("/{cid}", status_code=204, dependencies=[Depends(require_admin)])
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.get(ServiceCategory, cid)
    if c is None or c.deleted_at:
        raise HTTPException(404, "Category not found")
    c.deleted_at = datetime.now(timezone.utc)
    c.active = False
    db.commit()
