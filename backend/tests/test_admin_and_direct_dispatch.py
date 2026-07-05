"""
Backend tests for UteRun iteration 5:
  - Admin endpoints (stats, pending list, verify approve/reject) + RBAC
  - Driver verification gating on /jobs/{id}/accept
  - Request-this-driver direct dispatch (POST /api/jobs dispatch_mode='direct')
  - Feed targeting for directed jobs (is_direct_request, isolation)
  - Decline by targeted driver + 403 for non-targeted
  - Regression: Stripe Connect status, ratings GET /users/{id}/reviews,
    normal instant-dispatch auto-match

WAF: send `User-Agent: Mozilla/5.0` on every request (default python-requests UA
gets a 403 from the preview ingress).

Pending driver seeding: signup is gated by Twilio OTP, so the pending driver is
inserted directly into Mongo (per main-agent guidance) via motor using
MONGO_URL/DB_NAME from /app/backend/.env.
"""
import os
import sys
import uuid
import asyncio
import pytest
import requests
from pathlib import Path

# Load /app/backend/.env so MONGO_URL, DB_NAME, JWT_SECRET are available
from dotenv import load_dotenv
load_dotenv(Path("/app/backend/.env"))

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL or EXPO_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Test"}

CUSTOMER = ("demo@uterun.com", "Password123!")
DRIVER = ("demodriver@uterun.com", "Password123!")   # approved
ADMIN = ("admin@uterun.com", "Admin123!")

# Pending-driver email is uniquified per run so reruns are idempotent.
# NOTE: server lowercases on /auth/login -> store email lowercase so login works.
PENDING_EMAIL = f"test_pending_{uuid.uuid4().hex[:8]}@uterun.com"
PENDING_PWD = "PendingPass123!"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------- helpers ----------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, headers=UA, timeout=20)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    j = r.json()
    return j["access_token"], j["user"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", **UA}


# ---------------- session-wide fixtures ----------------
@pytest.fixture(scope="session")
def customer_auth():
    return _login(*CUSTOMER)


@pytest.fixture(scope="session")
def driver_auth():
    return _login(*DRIVER)


@pytest.fixture(scope="session")
def admin_auth():
    return _login(*ADMIN)


@pytest.fixture(scope="session")
def pending_driver():
    """Seed a fresh pending driver directly into Mongo and return (id, email, password)."""
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    async def _seed():
        cli = AsyncIOMotorClient(mongo_url)
        db = cli[db_name]
        uid = str(uuid.uuid4())
        doc = {
            "id": uid,
            "email": PENDING_EMAIL,
            "password_hash": pwd_context.hash(PENDING_PWD),
            "full_name": "TEST Pending Driver",
            "phone": "+61400000111",
            "phone_verified": True,
            "role": "driver",
            "active_role": "driver",
            "is_admin": False,
            "rating": 0,
            "num_ratings": 0,
            "driver_profile": {
                "ute_type": "Single cab",
                "ute_photos": [],
                "license_doc": "",
                "rego_doc": "",
                "insurance_doc": "",
                "verification_status": "pending",
                "available": False,
                "submitted_at": "2026-01-01T00:00:00+00:00",
                "current_lat": -19.2590,
                "current_lng": 146.8169,
            },
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        await db.users.insert_one(doc)
        cli.close()
        return uid

    uid = asyncio.get_event_loop().run_until_complete(_seed()) if sys.version_info < (3, 10) else asyncio.run(_seed())
    yield uid, PENDING_EMAIL, PENDING_PWD

    # teardown — best-effort delete
    async def _cleanup():
        cli = AsyncIOMotorClient(mongo_url)
        db = cli[db_name]
        await db.users.delete_one({"id": uid})
        await db.jobs.delete_many({"$or": [{"customer_id": uid}, {"driver_id": uid}, {"directed_to": uid}]})
        cli.close()

    try:
        asyncio.run(_cleanup())
    except Exception:
        pass


# ============================================================
# 1. Admin RBAC + stats + pending list
# ============================================================
class TestAdminRBAC:
    def test_admin_stats_ok(self, admin_auth):
        tok, _ = admin_auth
        r = requests.get(f"{API}/admin/stats", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("pending", "approved", "rejected", "total_jobs"):
            assert k in body, f"missing {k} in {body}"
            assert isinstance(body[k], int) and body[k] >= 0

    def test_admin_pending_list_ok(self, admin_auth, pending_driver):
        tok, _ = admin_auth
        uid, email, _ = pending_driver
        r = requests.get(f"{API}/admin/drivers/pending", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        ids = [u["id"] for u in items]
        assert uid in ids, f"seeded pending driver {uid} not found in {ids}"
        me = next(u for u in items if u["id"] == uid)
        assert me["email"] == email
        assert me["driver_profile"]["verification_status"] == "pending"

    def test_non_admin_stats_403(self, customer_auth):
        tok, _ = customer_auth
        r = requests.get(f"{API}/admin/stats", headers=_hdr(tok), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_non_admin_pending_403(self, customer_auth):
        tok, _ = customer_auth
        r = requests.get(f"{API}/admin/drivers/pending", headers=_hdr(tok), timeout=15)
        assert r.status_code == 403


# ============================================================
# 2. Admin verify (approve / reject) + gating on /accept
# ============================================================
class TestAdminVerifyAndGating:
    def test_pending_driver_cannot_accept(self, pending_driver, customer_auth):
        """Pending (un-approved) driver gets 403 'not approved' when accepting any open job."""
        uid, email, pwd = pending_driver
        pdrv_tok, _ = _login(email, pwd)

        # customer creates an open offers job (instant would auto-assign demodriver)
        ctok, _ = customer_auth
        job_body = {
            "job_type": "pickup", "description": "TEST gating",
            "photos": [], "pickup_address": "A", "dropoff_address": "B",
            "pickup_lat": -19.26, "pickup_lng": 146.81,
            "dropoff_lat": -19.30, "dropoff_lng": 146.85,
            "load_size": "small", "preferred_time": "ASAP",
            "dispatch_mode": "offers",
        }
        cj = requests.post(f"{API}/jobs", json=job_body, headers=_hdr(ctok), timeout=15)
        assert cj.status_code == 200, cj.text
        jid = cj.json()["id"]
        assert cj.json()["status"] == "open"

        # pending driver tries to accept -> 403 "not approved"
        a = requests.post(f"{API}/jobs/{jid}/accept", headers=_hdr(pdrv_tok), timeout=15)
        assert a.status_code == 403, f"expected 403, got {a.status_code}: {a.text}"
        assert "approved" in a.text.lower()

    def test_admin_reject_then_approve_flow(self, admin_auth, pending_driver):
        tok, _ = admin_auth
        uid, email, pwd = pending_driver

        # reject
        r = requests.post(f"{API}/admin/drivers/{uid}/verify",
                          json={"action": "reject", "note": "TEST reject"},
                          headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        pu = r.json()
        assert pu["driver_profile"]["verification_status"] == "rejected"
        assert pu["driver_profile"]["available"] is False

        # rejected driver still can't accept
        ptok, _ = _login(email, pwd)
        ctok, _ = _login(*CUSTOMER)
        cj = requests.post(f"{API}/jobs", json={
            "job_type": "pickup", "description": "TEST rejected-gate",
            "photos": [], "pickup_address": "A", "dropoff_address": "B",
            "pickup_lat": -19.26, "pickup_lng": 146.81,
            "dropoff_lat": -19.30, "dropoff_lng": 146.85,
            "load_size": "small", "preferred_time": "ASAP", "dispatch_mode": "offers",
        }, headers=_hdr(ctok), timeout=15)
        assert cj.status_code == 200
        jid = cj.json()["id"]
        a = requests.post(f"{API}/jobs/{jid}/accept", headers=_hdr(ptok), timeout=15)
        assert a.status_code == 403

        # approve
        r = requests.post(f"{API}/admin/drivers/{uid}/verify",
                          json={"action": "approve", "note": "TEST approve"},
                          headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        pu = r.json()
        assert pu["driver_profile"]["verification_status"] == "approved"
        assert pu["driver_profile"]["available"] is True

        # approved driver CAN now accept the same open job
        a2 = requests.post(f"{API}/jobs/{jid}/accept", headers=_hdr(ptok), timeout=15)
        assert a2.status_code == 200, a2.text
        assert a2.json()["status"] == "accepted"
        assert a2.json()["driver_id"] == uid

    def test_verify_unknown_driver_404(self, admin_auth):
        tok, _ = admin_auth
        r = requests.post(f"{API}/admin/drivers/{uuid.uuid4()}/verify",
                          json={"action": "approve"}, headers=_hdr(tok), timeout=15)
        assert r.status_code == 404


# ============================================================
# 3. Request-this-driver: direct dispatch + feed targeting + decline + accept guard
# ============================================================
class TestDirectDispatch:
    def _create_direct(self, ctok, target_id, desc):
        r = requests.post(f"{API}/jobs", json={
            "job_type": "delivery", "description": desc,
            "photos": [], "pickup_address": "Home", "dropoff_address": "Tip",
            "pickup_lat": -19.26, "pickup_lng": 146.81,
            "dropoff_lat": -19.30, "dropoff_lng": 146.85,
            "load_size": "medium", "preferred_time": "ASAP",
            "dispatch_mode": "direct", "preferred_driver_id": target_id,
        }, headers=_hdr(ctok), timeout=15)
        return r

    def test_direct_create_sets_directed_to_and_open(self, customer_auth, driver_auth):
        ctok, _ = customer_auth
        _, drv = driver_auth
        r = self._create_direct(ctok, drv["id"], "TEST direct-create")
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["status"] == "open", f"direct job must stay open, got {job['status']}"
        assert job["dispatch_mode"] == "direct"
        assert job["directed_to"] == drv["id"]
        assert job.get("driver_id") in (None, "")
        assert job.get("requested_driver_name") == drv["full_name"]

    def test_direct_to_unapproved_driver_400(self, customer_auth, pending_driver):
        """First reset pending driver to pending (in case approve test ran)."""
        uid, _, _ = pending_driver
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]

        async def _reset():
            cli = AsyncIOMotorClient(mongo_url)
            await cli[db_name].users.update_one(
                {"id": uid},
                {"$set": {"driver_profile.verification_status": "pending",
                          "driver_profile.available": False}},
            )
            cli.close()
        asyncio.run(_reset())

        ctok, _ = customer_auth
        r = self._create_direct(ctok, uid, "TEST direct-pending")
        assert r.status_code == 400, f"expected 400 for unapproved target, got {r.status_code}: {r.text}"

    def test_feed_targeting_isolation(self, customer_auth, driver_auth, pending_driver, admin_auth):
        """The directed job appears (is_direct_request=true) in target driver's feed
        and does NOT appear in another approved driver's feed."""
        # Re-approve pending driver so they are a valid second approved driver
        uid, email, pwd = pending_driver
        atok, _ = admin_auth
        ap = requests.post(f"{API}/admin/drivers/{uid}/verify",
                           json={"action": "approve"}, headers=_hdr(atok), timeout=15)
        assert ap.status_code == 200

        ctok, _ = customer_auth
        dtok, drv = driver_auth
        ptok, _ = _login(email, pwd)

        r = self._create_direct(ctok, drv["id"], "TEST feed-isolation")
        assert r.status_code == 200
        jid = r.json()["id"]

        # target driver feed -> contains job with is_direct_request=true
        f1 = requests.get(f"{API}/jobs/feed", headers=_hdr(dtok), timeout=15)
        assert f1.status_code == 200
        match = [j for j in f1.json() if j["id"] == jid]
        assert len(match) == 1, f"target's feed must include directed job {jid}"
        assert match[0]["is_direct_request"] is True

        # non-target approved driver feed -> must NOT include this directed job
        f2 = requests.get(f"{API}/jobs/feed", headers=_hdr(ptok), timeout=15)
        assert f2.status_code == 200
        ids2 = [j["id"] for j in f2.json()]
        assert jid not in ids2, f"directed job {jid} leaked into non-target feed {ids2}"

    def test_non_target_cannot_accept_directed_job(self, customer_auth, driver_auth, pending_driver):
        """An approved driver who is NOT directed_to gets 403 on accept."""
        ctok, _ = customer_auth
        _, drv = driver_auth
        uid, email, pwd = pending_driver
        ptok, _ = _login(email, pwd)

        r = self._create_direct(ctok, drv["id"], "TEST accept-guard")
        assert r.status_code == 200
        jid = r.json()["id"]

        a = requests.post(f"{API}/jobs/{jid}/accept", headers=_hdr(ptok), timeout=15)
        assert a.status_code == 403, f"expected 403 for non-targeted accept, got {a.status_code}: {a.text}"
        assert "another" in a.text.lower() or "request" in a.text.lower()

    def test_decline_non_target_403(self, customer_auth, driver_auth, pending_driver):
        ctok, _ = customer_auth
        _, drv = driver_auth
        _, email, pwd = pending_driver
        ptok, _ = _login(email, pwd)

        r = self._create_direct(ctok, drv["id"], "TEST decline-403")
        assert r.status_code == 200
        jid = r.json()["id"]

        d = requests.post(f"{API}/jobs/{jid}/decline", headers=_hdr(ptok), timeout=15)
        assert d.status_code == 403

    def test_decline_by_target_opens_to_all(self, customer_auth, driver_auth, pending_driver):
        ctok, _ = customer_auth
        dtok, drv = driver_auth
        _, email, pwd = pending_driver
        ptok, _ = _login(email, pwd)

        r = self._create_direct(ctok, drv["id"], "TEST decline-target")
        assert r.status_code == 200
        jid = r.json()["id"]

        d = requests.post(f"{API}/jobs/{jid}/decline", headers=_hdr(dtok), timeout=15)
        assert d.status_code == 200, d.text
        assert d.json().get("ok") is True

        # verify directed_to cleared + dispatch_mode flipped, still open
        g = requests.get(f"{API}/jobs/{jid}", headers=_hdr(ctok), timeout=15)
        assert g.status_code == 200
        job = g.json()
        assert job["directed_to"] in (None, ""), f"directed_to should be None after decline, got {job['directed_to']}"
        assert job["status"] == "open"
        assert job["dispatch_mode"] == "offers"

        # the now-undirected job should appear in the OTHER approved driver's feed
        f2 = requests.get(f"{API}/jobs/feed", headers=_hdr(ptok), timeout=15)
        assert f2.status_code == 200
        ids2 = [j["id"] for j in f2.json()]
        assert jid in ids2, f"after target decline, job {jid} should be in non-target feed"


# ============================================================
# 4. Regression
# ============================================================
class TestRegression:
    def test_instant_dispatch_auto_matches(self, customer_auth):
        ctok, _ = customer_auth
        r = requests.post(f"{API}/jobs", json={
            "job_type": "pickup", "description": "TEST instant auto-match",
            "photos": [], "pickup_address": "A", "dropoff_address": "B",
            "pickup_lat": -19.26, "pickup_lng": 146.81,
            "dropoff_lat": -19.30, "dropoff_lng": 146.85,
            "load_size": "small", "preferred_time": "ASAP",
            "dispatch_mode": "instant",
        }, headers=_hdr(ctok), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        # demodriver is approved+available, so we expect auto-assignment
        assert j["status"] == "accepted", f"instant should auto-assign, got status={j['status']}"
        assert j["driver_id"], "driver_id must be set on auto-match"

    def test_connect_status_returns_shape(self, driver_auth):
        tok, _ = driver_auth
        r = requests.get(f"{API}/driver/connect/status", headers=_hdr(tok), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("connected", "details_submitted", "charges_enabled", "payouts_enabled"):
            assert k in body, f"connect/status missing {k}"
            assert isinstance(body[k], bool)

    def test_connect_onboarding_link(self, driver_auth):
        tok, _ = driver_auth
        r = requests.post(f"{API}/driver/connect/onboarding-link",
                          json={"return_base": BASE_URL},
                          headers=_hdr(tok), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body
        assert body["url"].startswith("https://"), f"bad onboarding url: {body['url']}"

    def test_user_reviews(self, driver_auth, customer_auth):
        ctok, _ = customer_auth
        _, drv = driver_auth
        r = requests.get(f"{API}/users/{drv['id']}/reviews", headers=_hdr(ctok), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("rating", "num_ratings", "name", "breakdown", "reviews"):
            assert k in body, f"reviews payload missing {k}"
        assert isinstance(body["reviews"], list)
        assert isinstance(body["breakdown"], dict)
