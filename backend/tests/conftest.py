import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret")
os.environ.setdefault("UPLOAD_DIR", "test_uploads")

from decimal import Decimal as D  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.security import hash_password  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.connection import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import BusinessSettings, Feature, ServiceCategory, TeamMember, User  # noqa: E402


@pytest.fixture(autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    s = SessionLocal()
    yield s
    s.close()


@pytest.fixture
def seeded(db):
    db.add_all([User(name="Admin", email="admin@example.com", password_hash=hash_password("correct-horse-1"), role="admin"),
                User(name="Member", email="member@example.com", password_hash=hash_password("correct-horse-2"), role="member")])
    cat = ServiceCategory(name="Websites")
    db.add(cat)
    db.flush()
    f1 = Feature(category_id=cat.id, name="Frontend", description="UI", basic_price=D(15000), intermediate_price=D(25000),
                 advanced_price=D(35000), estimated_hours=D(20))
    f2 = Feature(category_id=cat.id, name="Auth", basic_price=D(5000), intermediate_price=D(8000), advanced_price=D(15000),
                 estimated_hours=D(10))
    m1, m2 = TeamMember(name="Dev One", internal_hourly_rate=D(500)), TeamMember(name="Dev Two", internal_hourly_rate=D(400))
    db.add_all([f1, f2, m1, m2, BusinessSettings(business_name="Studio", terms_and_conditions="Term one.")])
    db.commit()
    return {"cat": cat.id, "f1": f1.id, "f2": f2.id, "m1": m1.id, "m2": m2.id}


@pytest.fixture
def api():
    return TestClient(app)


def _login(api, email, password):
    r = api.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(api, seeded):
    return _login(api, "admin@example.com", "correct-horse-1")


@pytest.fixture
def member_auth(api, seeded):
    return _login(api, "member@example.com", "correct-horse-2")


@pytest.fixture
def payload(seeded):
    return {
        "client": {"name": "Acme Traders", "company": "Acme", "email": "buyer@acme.test", "phone": "9999999999"},
        "project_name": "Acme website", "project_description": "Five page site", "complexity": "intermediate",
        "category_id": seeded["cat"], "pricing_method": "feature",
        "pricing": {"contingency_pct": "10", "discount_pct": "0", "gst_enabled": True, "gst_rate": "18"},
        "items": [{"feature_id": seeded["f1"], "unit_price": "1", "estimated_hours": "20", "assigned_team_member_id": seeded["m1"]},
                  {"feature_id": seeded["f2"], "estimated_hours": "10", "assigned_team_member_id": seeded["m2"]}],
        "dev_allocation": [{"category": "Frontend development", "estimated_hours": "20", "team_member_id": seeded["m1"]},
                           {"category": "Backend development", "estimated_hours": "10", "team_member_id": seeded["m2"]}],
        "expenses": [{"name": "Domain", "category": "Domain registration", "amount": "800", "billing_type": "client_billed"},
                     {"name": "SECRET-TOOL", "category": "Other expenses", "amount": "500", "billing_type": "absorbed"}],
    }
