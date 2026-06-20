"""UteRun Townsville backend smoke + integration tests."""
import os
import uuid
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE = BASE.rstrip("/")
API = f"{BASE}/api"

CUST = {"email": "cust@test.com", "password": "Password123!"}
DRV = {"email": "drv@test.com", "password": "Password123!"}


def _login_or_signup(email, password, full_name, role):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code == 200:
        return r.json()
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": password,
        "full_name": full_name, "phone": "+61400000000", "role": role,
    }, timeout=15)
    assert r.status_code == 200, f"signup failed: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def customer():
    return _login_or_signup(CUST["email"], CUST["password"], "Test Customer", "customer")


@pytest.fixture(scope="session")
def driver():
    d = _login_or_signup(DRV["email"], DRV["password"], "Test Driver", "driver")
    # ensure approved driver profile
    h = {"Authorization": f"Bearer {d['access_token']}"}
    me = requests.get(f"{API}/auth/me", headers=h).json()
    if not me.get("driver_profile"):
        r = requests.post(f"{API}/driver/profile", headers=h, json={
            "license_no": "QLD9999", "rego": "TST999", "insurance": "Allianz",
            "ute_type": "Toyota HiLux", "abn": None, "ute_photos": [],
        })
        assert r.status_code == 200
    # Make sure available
    requests.patch(f"{API}/driver/availability", headers=h, json={"available": True})
    # Switch active role to driver
    requests.patch(f"{API}/auth/role", headers=h, json={"role": "driver"})
    return d


# ---------------- Auth ----------------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert "UteRun" in r.json().get("message", "")

    def test_signup_new(self):
        email = f"test_{uuid.uuid4().hex[:8]}@uterun.com"
        r = requests.post(f"{API}/auth/signup", json={
            "email": email, "password": "Password123!",
            "full_name": "TEST New", "phone": "+61411111111", "role": "customer",
        })
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["user"]["email"] == email
        assert body["user"]["role"] == "customer"
        assert body["user"]["active_role"] == "customer"

    def test_signup_duplicate(self, customer):
        r = requests.post(f"{API}/auth/signup", json={
            "email": CUST["email"], "password": "x", "full_name": "x",
            "phone": "+61400000000", "role": "customer",
        })
        assert r.status_code == 400

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": CUST["email"], "password": "wrong"})
        assert r.status_code == 400

    def test_me(self, customer):
        h = {"Authorization": f"Bearer {customer['access_token']}"}
        r = requests.get(f"{API}/auth/me", headers=h)
        assert r.status_code == 200
        assert r.json()["email"] == CUST["email"]

    def test_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_role_toggle(self, customer):
        h = {"Authorization": f"Bearer {customer['access_token']}"}
        r = requests.patch(f"{API}/auth/role", headers=h, json={"role": "driver"})
        assert r.status_code == 200
        assert r.json()["active_role"] == "driver"
        r2 = requests.patch(f"{API}/auth/role", headers=h, json={"role": "customer"})
        assert r2.json()["active_role"] == "customer"

    def test_otp_mock(self):
        phone = "+61400123456"
        r = requests.post(f"{API}/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200
        r2 = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "123456"})
        assert r2.status_code == 200
        r3 = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "000000"})
        assert r3.status_code == 400


# ---------------- Fare ----------------
class TestFare:
    def test_estimate_default(self):
        r = requests.post(f"{API}/fare/estimate", json={
            "job_type": "pickup", "load_size": "small",
        })
        assert r.status_code == 200
        body = r.json()
        for k in ("total", "driver_earnings", "distance_km", "platform_fee", "currency"):
            assert k in body
        assert body["currency"] == "AUD"
        assert body["total"] > 0

    def test_estimate_with_coords(self):
        r = requests.post(f"{API}/fare/estimate", json={
            "job_type": "move", "load_size": "large",
            "pickup_lat": -19.259, "pickup_lng": 146.8169,
            "dropoff_lat": -19.30, "dropoff_lng": 146.85,
        })
        assert r.status_code == 200
        assert r.json()["distance_km"] >= 1.0


# ---------------- Drivers ----------------
class TestDrivers:
    def test_verified_drivers_list(self):
        r = requests.get(f"{API}/drivers/verified")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 4
        for d in arr:
            assert d.get("verification_status") == "approved"
            assert "ute_type" in d

    def test_driver_onboarding_and_earnings(self, driver):
        h = {"Authorization": f"Bearer {driver['access_token']}"}
        me = requests.get(f"{API}/auth/me", headers=h).json()
        assert me["driver_profile"]["verification_status"] == "approved"
        r = requests.get(f"{API}/driver/earnings", headers=h)
        assert r.status_code == 200
        for k in ("today", "week", "month", "trips", "week_chart"):
            assert k in r.json()


# ---------------- Jobs full lifecycle ----------------
class TestJobsLifecycle:
    def test_instant_dispatch_autoassign(self, customer):
        h = {"Authorization": f"Bearer {customer['access_token']}"}
        payload = {
            "job_type": "pickup", "description": "TEST instant",
            "pickup_address": "South Townsville", "dropoff_address": "North Ward",
            "load_size": "small", "preferred_time": "ASAP", "dispatch_mode": "instant",
        }
        r = requests.post(f"{API}/jobs", headers=h, json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "accepted"
        assert j["driver_id"] is not None
        assert j["fare"]["total"] > 0

    def test_offers_mode_stays_open_and_accept_and_advance(self, customer, driver):
        ch = {"Authorization": f"Bearer {customer['access_token']}"}
        dh = {"Authorization": f"Bearer {driver['access_token']}"}
        r = requests.post(f"{API}/jobs", headers=ch, json={
            "job_type": "delivery", "description": "TEST offers",
            "pickup_address": "Garbutt", "dropoff_address": "Aitkenvale",
            "load_size": "medium", "preferred_time": "ASAP", "dispatch_mode": "offers",
        })
        assert r.status_code == 200
        job = r.json()
        assert job["status"] == "open"
        jid = job["id"]

        # driver feed should contain this
        feed = requests.get(f"{API}/jobs/feed", headers=dh)
        assert feed.status_code == 200
        ids = [j["id"] for j in feed.json()]
        assert jid in ids

        # accept
        a = requests.post(f"{API}/jobs/{jid}/accept", headers=dh)
        assert a.status_code == 200, a.text
        assert a.json()["status"] == "accepted"

        # GET verify
        g = requests.get(f"{API}/jobs/{jid}", headers=ch)
        assert g.json()["status"] == "accepted"
        assert g.json()["driver_id"] is not None

        # advance picked_up -> delivered -> completed
        for s in ("picked_up", "delivered", "completed"):
            r2 = requests.post(f"{API}/jobs/{jid}/status", headers=dh, json={"status": s})
            assert r2.status_code == 200
            assert r2.json()["status"] == s

        # rating by customer
        rr = requests.post(f"{API}/jobs/{jid}/rate", headers=ch, json={"stars": 5, "review": "Great"})
        assert rr.status_code == 200

        # customer my jobs contains it
        my = requests.get(f"{API}/jobs/my", headers=ch).json()
        assert any(j["id"] == jid for j in my)

    def test_accept_already_accepted_fails(self, customer, driver):
        ch = {"Authorization": f"Bearer {customer['access_token']}"}
        dh = {"Authorization": f"Bearer {driver['access_token']}"}
        r = requests.post(f"{API}/jobs", headers=ch, json={
            "job_type": "tip_run", "description": "TEST conflict",
            "pickup_address": "A", "dropoff_address": "B",
            "load_size": "small", "preferred_time": "ASAP", "dispatch_mode": "instant",
        })
        jid = r.json()["id"]
        # status is accepted by some seed driver. Try driver to accept again -> should 400
        r2 = requests.post(f"{API}/jobs/{jid}/accept", headers=dh)
        assert r2.status_code == 400

    def test_get_unknown_job(self, customer):
        h = {"Authorization": f"Bearer {customer['access_token']}"}
        r = requests.get(f"{API}/jobs/nope-xxx", headers=h)
        assert r.status_code == 404


# ---------------- Messages / Conversations ----------------
class TestMessaging:
    def test_messages_and_conversations(self, customer, driver):
        ch = {"Authorization": f"Bearer {customer['access_token']}"}
        dh = {"Authorization": f"Bearer {driver['access_token']}"}
        # create offers job & accept with our driver so we can chat
        r = requests.post(f"{API}/jobs", headers=ch, json={
            "job_type": "pickup", "description": "TEST chat",
            "pickup_address": "A", "dropoff_address": "B",
            "load_size": "small", "preferred_time": "ASAP", "dispatch_mode": "offers",
        })
        jid = r.json()["id"]
        requests.post(f"{API}/jobs/{jid}/accept", headers=dh)

        m1 = requests.post(f"{API}/jobs/{jid}/messages", headers=ch, json={"text": "hi driver"})
        assert m1.status_code == 200
        m2 = requests.post(f"{API}/jobs/{jid}/messages", headers=dh, json={"text": "on my way"})
        assert m2.status_code == 200

        msgs = requests.get(f"{API}/jobs/{jid}/messages", headers=ch).json()
        assert len(msgs) >= 2

        # switch driver active role for conversations endpoint
        requests.patch(f"{API}/auth/role", headers=dh, json={"role": "driver"})
        conv = requests.get(f"{API}/conversations", headers=dh)
        assert conv.status_code == 200
        assert any(c["job_id"] == jid for c in conv.json())
