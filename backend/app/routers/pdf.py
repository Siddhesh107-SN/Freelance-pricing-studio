from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.config import get_app_settings
from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import Estimate, TeamMember
from app.services import pdf_service as pdf
from app.services.estimate_service import get_settings_row
from app.services.quotation_service import ensure_quotation

router = APIRouter(prefix="/api/estimates", tags=["pdf"], dependencies=[Depends(get_current_user)])


def _estimate(db: Session, eid: int) -> Estimate:
    e = db.get(Estimate, eid)
    if e is None or e.deleted_at:
        raise HTTPException(404, "Estimate not found")
    return e


def _respond(html: str, fmt: str, filename: str) -> Response:
    if fmt == "html":
        return Response(html, media_type="text/html")
    try:
        data = pdf.html_to_pdf(html)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{eid}/pdf/internal")
def internal_pdf(eid: int, format: str = "pdf", db: Session = Depends(get_db)):
    est, settings = _estimate(db, eid), get_settings_row(db)
    members = {m.id: {"name": m.name, "rate": Decimal(m.internal_hourly_rate)} for m in db.query(TeamMember)}
    ctx = pdf.serialize_internal(est, settings, members, get_app_settings().upload_dir)
    return _respond(pdf.render_html("internal", ctx), format, f"{est.estimate_number}-internal.pdf")


@router.get("/{eid}/pdf/client")
def client_pdf(eid: int, format: str = "pdf", db: Session = Depends(get_db)):
    est, settings = _estimate(db, eid), get_settings_row(db)
    quotation = ensure_quotation(db, est)
    ctx = pdf.serialize_client(est, settings, quotation, get_app_settings().upload_dir)
    return _respond(pdf.render_html("client", ctx), format, f"{quotation.quotation_number}.pdf")
