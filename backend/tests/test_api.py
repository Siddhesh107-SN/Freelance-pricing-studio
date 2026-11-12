from decimal import Decimal as D

import pytest


def test_login_success_and_failure(api, seeded):
    assert api.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrong"}).status_code == 401
    ok = api.post("/api/auth/login", json={"email": "admin@example.com", "password": "correct-horse-1"})
    assert ok.status_code == 200 and ok.json()["user"]["email"] == "admin@example.com"
    assert "password" not in ok.text


def test_me_and_logout(api, auth):
    assert api.get("/api/auth/me", headers=auth).json()["name"] == "Admin"
    assert api.post("/api/auth/logout", headers=auth).status_code == 204


@pytest.mark.parametrize("method,path", [
    ("get", "/api/clients"), ("get", "/api/categories"), ("get", "/api/features"), ("get", "/api/estimates"),
    ("get", "/api/quotations"), ("get", "/api/settings"), ("get", "/api/team-members"), ("get", "/api/auth/me"),
    ("get", "/api/estimates/1/pdf/internal"), ("get", "/api/estimates/1/pdf/client"), ("post", "/api/estimates/preview"),
])
def test_endpoints_require_authentication(api, method, path):
    assert getattr(api, method)(path).status_code == 401


def test_bad_token_rejected(api):
    assert api.get("/api/clients", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_client_crud(api, auth):
    r = api.post("/api/clients", json={"name": "Ravi", "email": "ravi@x.test"}, headers=auth)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert api.put(f"/api/clients/{cid}", json={"name": "Ravi K"}, headers=auth).json()["name"] == "Ravi K"
    assert api.post("/api/clients", json={"name": "Bad", "email": "not-an-email"}, headers=auth).status_code == 422
    assert api.delete(f"/api/clients/{cid}", headers=auth).status_code == 204
    assert api.get(f"/api/clients/{cid}", headers=auth).status_code == 404


def test_feature_create_validates_and_requires_admin(api, auth, member_auth, seeded):
    body = {"category_id": seeded["cat"], "name": "Search", "basic_price": "3000", "intermediate_price": "4000", "advanced_price": "6000"}
    assert api.post("/api/features", json=body, headers=member_auth).status_code == 403
    assert api.post("/api/features", json=body, headers=auth).status_code == 201
    assert api.post("/api/features", json={**body, "basic_price": "-1"}, headers=auth).status_code == 422
    assert api.post("/api/features", json={**body, "category_id": 999}, headers=auth).status_code == 422


def test_estimate_create_uses_configured_prices_not_client_values(api, auth, payload):
    r = api.post("/api/estimates", json=payload, headers=auth)
    assert r.status_code == 201, r.text
    e = r.json()
    prices = {i["feature_name_snapshot"]: D(i["unit_price"]) for i in e["items"]}
    assert prices == {"Frontend": D("25000.00"), "Auth": D("8000.00")}  # unit_price "1" from the client was ignored
    assert D(e["subtotal"]) == D("33800.00")  # 33,000 features + 800 client-billed domain
    assert D(e["gst_amount"]) == D("6084.00") and D(e["final_client_price"]) == D("39884.00")
    assert D(e["internal_development_cost"]) == D("14000.00")  # 20h x 500 + 10h x 400
    assert D(e["internal_expenses"]) == D("500.00")
    assert D(e["contingency_amount"]) == D("1450.00")
    assert D(e["total_internal_cost"]) == D("15950.00")
    assert D(e["estimated_profit"]) == D("17850.00")
    assert e["estimate_number"].startswith("EST-") and e["status"] == "Draft"
    assert sum(D(m["percentage"]) for m in e["milestones"]) == 100
    assert sum(D(m["amount"]) for m in e["milestones"]) == D(e["final_client_price"])


def test_frontend_totals_are_ignored(api, auth, payload):
    payload["final_client_price"] = "1"  # not part of the schema, must have no effect
    e = api.post("/api/estimates", json=payload, headers=auth).json()
    assert D(e["final_client_price"]) == D("39884.00")


def test_preview_matches_saved_calculation(api, auth, payload):
    prev = api.post("/api/estimates/preview", json=payload, headers=auth).json()
    saved = api.post("/api/estimates", json=payload, headers=auth).json()
    assert D(prev["final_client_price"]) == D(saved["final_client_price"])


def test_estimate_update_and_recalculate(api, auth, payload):
    eid = api.post("/api/estimates", json=payload, headers=auth).json()["id"]
    payload["pricing"]["discount_pct"] = "10"
    upd = api.put(f"/api/estimates/{eid}", json=payload, headers=auth).json()
    assert D(upd["discount_amount"]) == D("3380.00")
    again = api.post(f"/api/estimates/{eid}/calculate", headers=auth).json()
    assert D(again["final_client_price"]) == D(upd["final_client_price"])


def test_validation_errors(api, auth, payload):
    bad = {**payload, "pricing": {**payload["pricing"], "discount_pct": "150"}}
    assert api.post("/api/estimates", json=bad, headers=auth).status_code == 422
    bad = {**payload, "items": [{"feature_id": 99999}]}
    assert api.post("/api/estimates", json=bad, headers=auth).status_code == 422  # missing feature
    bad = {**payload, "items": [{"name": "Custom", "unit_price": "-5"}]}
    assert api.post("/api/estimates", json=bad, headers=auth).status_code == 422
    bad = {**payload, "milestones": [{"milestone_name": "A", "percentage": "50"}, {"milestone_name": "B", "percentage": "40"}]}
    assert api.post("/api/estimates", json=bad, headers=auth).status_code == 422
    bad = {**payload, "items": [{"name": "X", "quantity": 0}]}
    assert api.post("/api/estimates", json=bad, headers=auth).status_code == 422


def test_custom_milestones_and_custom_feature(api, auth, payload):
    payload["milestones"] = [{"milestone_name": "Half", "percentage": "50"}, {"milestone_name": "Rest", "percentage": "50"}]
    payload["items"].append({"name": "Custom report", "unit_price": "2000", "estimated_hours": "4", "internal_cost": "700"})
    e = api.post("/api/estimates", json=payload, headers=auth).json()
    assert [m["milestone_name"] for m in e["milestones"]] == ["Half", "Rest"]
    assert any(i["feature_id"] is None and D(i["total_price"]) == D("2000.00") for i in e["items"])


def test_old_estimate_keeps_snapshot_when_feature_changes(api, auth, payload, seeded):
    eid = api.post("/api/estimates", json=payload, headers=auth).json()["id"]
    f = api.get(f"/api/features/{seeded['f1']}", headers=auth).json()
    api.put(f"/api/features/{seeded['f1']}", json={**f, "intermediate_price": "99999", "name": "Renamed"}, headers=auth)
    api.delete(f"/api/features/{seeded['f2']}", headers=auth)
    recalculated = api.post(f"/api/estimates/{eid}/calculate", headers=auth).json()
    assert D(recalculated["final_client_price"]) == D("39884.00")
    assert {i["feature_name_snapshot"] for i in recalculated["items"]} == {"Frontend", "Auth"}


def test_recurring_expense_is_separate(api, auth, payload):
    payload["expenses"].append({"name": "Hosting", "category": "Hosting", "amount": "1000", "expense_type": "recurring", "billing_type": "client_billed"})
    e = api.post("/api/estimates", json=payload, headers=auth).json()
    assert D(e["subtotal"]) == D("33800.00")  # unchanged by the recurring item
    assert D(e["calc_details"]["recurring_client_monthly"]) == D("1000.00")


def test_duplicate_list_search_and_delete(api, auth, payload):
    eid = api.post("/api/estimates", json=payload, headers=auth).json()["id"]
    dup = api.post(f"/api/estimates/{eid}/duplicate", headers=auth).json()
    assert dup["project_name"].endswith("(copy)") and dup["status"] == "Draft" and dup["id"] != eid
    assert dup["estimate_number"] != api.get(f"/api/estimates/{eid}", headers=auth).json()["estimate_number"]
    assert D(dup["final_client_price"]) == D("39884.00")
    assert len(api.get("/api/estimates", headers=auth).json()) == 2
    assert len(api.get("/api/estimates?q=copy", headers=auth).json()) == 1
    assert api.delete(f"/api/estimates/{eid}", headers=auth).status_code == 204
    assert api.get(f"/api/estimates/{eid}", headers=auth).status_code == 404


def test_quotation_flow_and_status_sync(api, auth, payload):
    eid = api.post("/api/estimates", json=payload, headers=auth).json()["id"]
    q = api.post("/api/quotations", json={"estimate_id": eid, "validity_days": 10}, headers=auth)
    assert q.status_code == 201 and q.json()["quotation_number"].startswith("QT-")
    qid = q.json()["id"]
    assert api.put(f"/api/quotations/{qid}/status", json={"status": "Accepted"}, headers=auth).json()["status"] == "Accepted"
    assert api.get(f"/api/estimates/{eid}", headers=auth).json()["status"] == "Accepted"
    assert api.put(f"/api/quotations/{qid}/status", json={"status": "Bogus"}, headers=auth).status_code == 422
    assert api.put(f"/api/quotations/{qid}", json={"issue_date": "2026-05-10", "expiry_date": "2026-05-01"}, headers=auth).status_code == 422


def test_settings_roundtrip_and_permissions(api, auth, member_auth):
    cur = api.get("/api/settings", headers=auth).json()
    body = {**cur, "business_name": "New Name", "default_gst_rate": "12"}
    assert api.put("/api/settings", json=body, headers=member_auth).status_code == 403
    assert api.put("/api/settings", json=body, headers=auth).json()["business_name"] == "New Name"
    assert api.put("/api/settings", json={**body, "default_gst_rate": "500"}, headers=auth).status_code == 422
