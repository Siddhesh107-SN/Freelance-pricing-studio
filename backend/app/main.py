from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_app_settings
from app.routers import auth, categories, clients, estimates, features, pdf, quotations, settings
from app.services.estimate_service import EstimateError

app = FastAPI(title="Freelance Pricing Studio API")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in get_app_settings().cors_origins.split(",")],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

upload_path = Path(get_app_settings().upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

for r in (auth, clients, categories, features, estimates, quotations, pdf, settings):
    app.include_router(r.router)


@app.exception_handler(EstimateError)
async def estimate_error(_: Request, exc: EstimateError):
    return JSONResponse({"detail": str(exc)}, status_code=422)


@app.get("/api/health")
def health():
    return {"status": "ok"}
