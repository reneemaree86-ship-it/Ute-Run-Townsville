"""Regression suite for Stripe Connect (driver payouts) endpoints and the
job lifecycle after introduction of BackgroundTasks email hooks (Resend).

Targets the review request:
- GET /api/driver/connect/status -> connected/details_submitted/charges_enabled/payouts_enabled booleans
- POST /api/driver/connect/onboarding-link -> {url} (real connect.stripe.com URL)
- Both Connect endpoints require auth (401 without token)
- Customer creates a job -> driver accepts -> advances picked_up/delivered/completed
  (each must remain 200 even though emailer.send_payout_note fires in background)
- GET /api/payments/verify/{session_id} with fake id -> 404 (NOT 500)
- GET /api/driver/earnings returns the expected shape
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE = BASE.rstrip("/")
API = f"{BASE}/api"

CUSTOMER_EMAIL = "demo@uterun.com"
DRIVER_EMAIL = "demodriver@uterun.com"
PASSWORD = "Password123!"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body, f"login response missing access_token: {body}"
    return body


@pytest.fixture(scope="session")
def customer():
    return _login(CUSTOMER_EMAIL, PASSWORD)


@pytest.fixture(scope="session")
def driver():
    d = _login(DRIVER_EMAIL, PASSWORD)
    h = {"Authorization": f"Bearer {d['access_token']}"}
    # ensure available + active_role=driver so /jobs/feed and accept work
    requests.patch(f"{API}/driver/availability", headers=h, json={"available": True}, timeout=15)
    requests.patch(f"{API}/auth/role", headers=h, json={"role": "driver"}, timeout=15)
    return d


# ---------------- Stripe Connect (driver payouts) ----------------
class TestDriverConnect:
    def test_connect_status_requires_auth(self):
        r = requests.get(f"{API}/driver/connect/status", timeout=15)
        assert r.status_code == 401, f"expected 401 no-auth, got {r.status_code} {r.text}"

    def test_connect_onboarding_requires_auth(self):
        r = requests.post(f"{API}/driver/connect/onboarding-link", json={}, timeout=15)
        assert r.status_code == 401, f"expected 401 no-auth, got {r.status_code} {r.text}"

    def test_connect_status_shape(self, driver):
        h = {"Authorization": f"Bearer {driver['access_token']}"}
        r = requests.get(f"{API}/driver/connect/status", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("connected", "details_submitted", "charges_enabled", "payouts_enabled"):
            assert k in body, f"missing key {k} in connect status: {body}"
            assert isinstance(body[k], bool), f"{k} not a bool: {type(body[k])}"

    def test_connect_onboarding_link(self, driver):
        h = {"Authorization": f"Bearer {driver['access_token']}"}
        r = requests.post(f"{API}/driver/connect/onboarding-link", headers=h, json={}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body, f"missing url: {body}"
        url = body["url"]
        assert isinstance(url, str) and url.startswith("https://"), f"bad url: {url}"
        # Stripe Connect onboarding URLs are hosted on connect.stripe.com
        assert "stripe.com" in url, f"expected stripe.com host in {url}"

    def test_connect_status_after_account_created_is_connected_true(self, driver):
        # After onboarding-link call, the driver should have a stripe_account_id,
        # so /connect/status should now report connected=True (booleans still well-typed).
        h = {"Authorization": f"Bearer {driver['access_token']}"}
        # Ensure account exists
        requests.post(f"{API}/driver/connect/onboarding-link", headers=h, json={}, timeout=30)
        r = requests.get(f"{API}/driver/connect/status", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["connected"] is True
        # details_submitted/payouts_enabled remain False until driver finishes Stripe form,
        # but they must be present + bool.
        assert isinstance(body["details_submitted"], bool)
        assert isinstance(body["charges_enabled"], bool)
        assert isinstance(body["payouts_enabled"], bool)


# ---------------- Job lifecycle with BackgroundTasks email hooks ----------------
class TestJobLifecycleWithEmailHooks:
    def test_full_lifecycle_offers_mode(self, customer, driver):
        ch = {"Authorization": f"Bearer {customer['access_token']}"}
        dh = {"Authorization": f"Bearer {driver['access_token']}"}

        # 1. Customer creates job (offers mode so demo driver can accept)
        payload = {
            "job_type": "delivery",
            "description": f"TEST_lifecycle_{uuid.uuid4().hex[:6]}",
            "pickup_address": "Garbutt, Townsville",
            "dropoff_address": "Aitkenvale, Townsville",
            "load_size": "medium",
            "preferred_time": "ASAP",
            "dispatch_mode": "offers",
        }
        r = requests.post(f"{API}/jobs", headers=ch, json=payload, timeout=20)
        assert r.status_code == 200, f"create job failed: {r.status_code} {r.text}"
        job = r.json()
        assert job["status"] == "open", f"expected open, got {job.get('status')}"
        jid = job["id"]

        # 2. Driver accepts
        a = requests.post(f"{API}/jobs/{jid}/accept", headers=dh, timeout=20)
        assert a.status_code == 200, f"accept failed: {a.status_code} {a.text}"
        assert a.json()["status"] == "accepted"

        # 3. Advance status picked_up -> delivered -> completed.
        # `completed` triggers emailer.send_payout_note via BackgroundTasks — must NOT break the 200.
        for s in ("picked_up", "delivered", "completed"):
            r2 = requests.post(f"{API}/jobs/{jid}/status", headers=dh, json={"status": s}, timeout=20)
            assert r2.status_code == 200, f"status {s} failed: {r2.status_code} {r2.text}"
            body = r2.json()
            assert body["status"] == s, f"status mismatch: expected {s}, got {body.get('status')}"

        # 4. Verify persistence: GET job should show completed
        g = requests.get(f"{API}/jobs/{jid}", headers=ch, timeout=15)
        assert g.status_code == 200
        assert g.json()["status"] == "completed"
        assert g.json().get("completed_at"), "completed_at should be set"


# ---------------- /payments/verify edge case ----------------
class TestPaymentsVerify:
    def test_verify_unknown_session_returns_404(self, customer):
        h = {"Authorization": f"Bearer {customer['access_token']}"}
        fake = "cs_test_invalid_does_not_exist_xxxxxxxxxxxxxxxxxxxxxxx"
        r = requests.get(f"{API}/payments/verify/{fake}", headers=h, timeout=20)
        # Must NOT be 500. Either 404 (handled) or 503 (payments off) is acceptable, but the
        # review request specifies 404 with detail 'Payment session not found'.
        assert r.status_code != 500, f"verify returned 500 for invalid session id: {r.text}"
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"
        body = r.json()
        assert "Payment session not found" in (body.get("detail") or ""), f"bad detail: {body}"

    def test_verify_requires_auth(self):
        r = requests.get(f"{API}/payments/verify/cs_test_anything", timeout=15)
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"


# ---------------- /driver/earnings shape ----------------
class TestDriverEarnings:
    def test_earnings_shape(self, driver):
        h = {"Authorization": f"Bearer {driver['access_token']}"}
        r = requests.get(f"{API}/driver/earnings", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("today", "week", "month", "trips", "week_chart"):
            assert k in body, f"missing key {k} in earnings: {body}"
        assert isinstance(body["week_chart"], list) and len(body["week_chart"]) == 7
        assert isinstance(body["trips"], int)
        for k in ("today", "week", "month"):
            assert isinstance(body[k], (int, float)), f"{k} not numeric: {body[k]}"

    def test_earnings_requires_auth(self):
        r = requests.get(f"{API}/driver/earnings", timeout=15)
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"
