import pytest

INTERNAL_ONLY = ["SECRET-TOOL", "Estimated profit", "Total internal cost", "Contingency", "Hourly rate", "INTERNAL ONLY"]


def _create(api, auth, payload):
    return api.post("/api/estimates", json=payload, headers=auth).json()["id"]


def test_client_document_never_contains_internal_data(api, auth, payload):
    payload["pricing"]["contingency_in_client_price"] = True
    eid = _create(api, auth, payload)
    html = api.get(f"/api/estimates/{eid}/pdf/client?format=html", headers=auth).text
    for text in INTERNAL_ONLY + ["14,000.00", "15,950.00", "17,850", "500.00", "400.00"]:
        assert text not in html, text
    assert "Acme Traders" in html and "QT-" in html and "Domain" in html
    assert "\u20b9" in html and "GST (18" in html
    assert "Dev One" not in html and "Dev Two" not in html


def test_internal_document_contains_cost_and_profit(api, auth, payload):
    eid = _create(api, auth, payload)
    html = api.get(f"/api/estimates/{eid}/pdf/internal?format=html", headers=auth).text
    assert "SECRET-TOOL" in html and "Estimated profit" in html and "Dev One" in html and "\u20b914,000.00" in html


def test_pdf_documents_download(api, auth, payload):
    pytest.importorskip("weasyprint")
    eid = _create(api, auth, payload)
    for kind in ("internal", "client"):
        r = api.get(f"/api/estimates/{eid}/pdf/{kind}", headers=auth)
        assert r.status_code == 200 and r.content.startswith(b"%PDF")
        assert r.headers["content-type"] == "application/pdf"


def test_pdf_for_missing_estimate_is_404(api, auth):
    assert api.get("/api/estimates/999/pdf/client", headers=auth).status_code == 404
