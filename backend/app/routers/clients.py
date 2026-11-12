from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import Client, Estimate
from app.schemas.client import ClientIn, ClientOut

router = APIRouter(prefix="/api/clients", tags=["clients"], dependencies=[Depends(get_current_user)])


def _get(db: Session, cid: int) -> Client:
    c = db.get(Client, cid)
    if c is None or c.deleted_at is not None:
        raise HTTPException(404, "Client not found")
    return c


@router.get("", response_model=list[ClientOut])
def list_clients(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Client).filter(Client.deleted_at.is_(None))
    if q:
        query = query.filter(Client.name.ilike(f"%{q}%") | Client.company.ilike(f"%{q}%"))
    return query.order_by(Client.name).all()


@router.post("", response_model=ClientOut, status_code=201)
def create_client(body: ClientIn, db: Session = Depends(get_db)):
    c = Client(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{cid}", response_model=ClientOut)
def get_client(cid: int, db: Session = Depends(get_db)):
    return _get(db, cid)


@router.put("/{cid}", response_model=ClientOut)
def update_client(cid: int, body: ClientIn, db: Session = Depends(get_db)):
    c = _get(db, cid)
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{cid}", status_code=204)
def delete_client(cid: int, db: Session = Depends(get_db)):
    c = _get(db, cid)
    if db.query(Estimate).filter(Estimate.client_id == cid, Estimate.deleted_at.is_(None)).count():
        raise HTTPException(409, "Client has estimates. Delete or reassign them first.")
    c.deleted_at = datetime.now(timezone.utc)
    db.commit()
