from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_app_settings
from app.core.dependencies import get_current_user, require_admin
from app.database.connection import get_db
from app.models import TeamMember
from app.schemas.settings import SettingsIn, SettingsOut, TeamMemberIn, TeamMemberOut
from app.services.estimate_service import get_settings_row

router = APIRouter(prefix="/api", tags=["settings"])
LOGO_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


@router.get("/settings", response_model=SettingsOut, dependencies=[Depends(get_current_user)])
def read_settings(db: Session = Depends(get_db)):
    row = get_settings_row(db)
    db.commit()
    return row


@router.put("/settings", response_model=SettingsOut, dependencies=[Depends(require_admin)])
def update_settings(body: SettingsIn, db: Session = Depends(get_db)):
    row = get_settings_row(db)
    for k, v in body.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.post("/settings/logo", response_model=SettingsOut, dependencies=[Depends(require_admin)])
async def upload_logo(file: UploadFile, db: Session = Depends(get_db)):
    ext = LOGO_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(415, "Logo must be PNG, JPEG or WebP")
    data = await file.read()
    if len(data) > 1_000_000:
        raise HTTPException(413, "Logo must be under 1 MB")
    folder = Path(get_app_settings().upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"logo{ext}"
    (folder / name).write_bytes(data)
    row = get_settings_row(db)
    row.logo_path = name
    db.commit()
    db.refresh(row)
    return row


@router.get("/team-members", response_model=list[TeamMemberOut], dependencies=[Depends(get_current_user)])
def list_members(db: Session = Depends(get_db)):
    return db.query(TeamMember).order_by(TeamMember.id).all()


@router.post("/team-members", response_model=TeamMemberOut, status_code=201, dependencies=[Depends(require_admin)])
def create_member(body: TeamMemberIn, db: Session = Depends(get_db)):
    m = TeamMember(**body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/team-members/{mid}", response_model=TeamMemberOut, dependencies=[Depends(require_admin)])
def update_member(mid: int, body: TeamMemberIn, db: Session = Depends(get_db)):
    m = db.get(TeamMember, mid)
    if m is None:
        raise HTTPException(404, "Team member not found")
    for k, v in body.model_dump().items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m
