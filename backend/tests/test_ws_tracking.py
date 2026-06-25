"""Hardening tests for the real-time driver tracking WebSocket.

Endpoint under test: /api/ws/track/{job_id}?token=<JWT>

Scenarios (per review request):
1. Customer + assigned driver of an ACCEPTED job both connect and each receives
   {"type": "ready", "role": "<customer|driver>"}.
2. Driver sends {"type":"location",lat,lng,heading} over WS -> customer connection
   receives {"type":"location",...}; GET /api/jobs/{id} then shows persisted
   `driver_location` field.
3. WS connect without a token OR with an invalid token is rejected with close code 4401.
4. WS connect by a user who is neither the job's customer nor the assigned driver
   is rejected with close code 4403.
5. A NON-driver participant (customer) sending a location message is IGNORED
   (no broadcast back to the room) and not persisted.

Notes:
- ALL HTTP + WS requests carry a Mozilla User-Agent to avoid the WAF 403 that
  the python default UA triggers in the preview env.
- Login response field is `access_token` (not `token`).
"""

import asyncio
import json
import os
import uuid
from urllib.parse import urlparse

import pytest
import requests
import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatus

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE = BASE.rstrip("/")
API = f"{BASE}/api"

# WSS host
_p = urlparse(BASE)
WS_SCHEME = "wss" if _p.scheme == "https" else "ws"
WS_BASE = f"{WS_SCHEME}://{_p.netloc}/api/ws/track"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "\
     "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
COMMON_HEADERS = {"User-Agent": UA, "Content-Type": "application/json"}

CUSTOMER_EMAIL = "demo@uterun.com"
DRIVER_EMAIL = "demodriver@uterun.com"
PASSWORD = "Password123!"


# ---------- HTTP helpers ----------
def _session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    return s


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body, f"missing access_token in login: {body}"
    return body


def _bearer(token):
    return {"Authorization": f"Bearer {token}", "User-Agent": UA}


# ---------- WS helpers ----------
async def _ws_connect(token, job_id, *, open_timeout=10):
    """Connect to /api/ws/track/{job_id} with the WAF-safe User-Agent.

    Returns an open websockets.ClientConnection. Caller MUST close it.
    """
    qs = f"?token={token}" if token is not None else ""
    uri = f"{WS_BASE}/{job_id}{qs}"
    return await websockets.connect(
        uri,
        additional_headers={"User-Agent": UA},
        user_agent_header=UA,
        open_timeout=open_timeout,
        ping_interval=None,
    )


async def _recv_json(ws, timeout=5.0):
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def http():
    return _session()


@pytest.fixture(scope="session")
def customer(http):
    return _login(http, CUSTOMER_EMAIL, PASSWORD)


@pytest.fixture(scope="session")
def driver(http):
    d = _login(http, DRIVER_EMAIL, PASSWORD)
    h = _bearer(d["access_token"])
    # ensure available + active_role=driver
    http.patch(f"{API}/driver/availability", headers=h, json={"available": True}, timeout=15)
    http.patch(f"{API}/auth/role", headers=h, json={"role": "driver"}, timeout=15)
    return d


def _create_job(http, customer_tok, *, dispatch_mode="offers", desc_tag="ws"):
    payload = {
        "job_type": "delivery",
        "description": f"TEST_ws_{desc_tag}_{uuid.uuid4().hex[:6]}",
        "pickup_address": "Garbutt, Townsville",
        "dropoff_address": "Aitkenvale, Townsville",
        "load_size": "medium",
        "preferred_time": "ASAP",
        "dispatch_mode": dispatch_mode,
    }
    r = http.post(f"{API}/jobs", headers=_bearer(customer_tok), json=payload, timeout=20)
    assert r.status_code == 200, f"create job failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def accepted_job(http, customer, driver):
    """Create a job and ensure it ends in `accepted` with demo driver assigned."""
    job = _create_job(http, customer["access_token"], dispatch_mode="offers", desc_tag="accepted")
    jid = job["id"]
    # Driver accepts
    a = http.post(f"{API}/jobs/{jid}/accept", headers=_bearer(driver["access_token"]), timeout=20)
    assert a.status_code == 200, f"accept failed: {a.status_code} {a.text}"
    body = a.json()
    assert body["status"] == "accepted"
    assert body.get("driver_id"), "driver_id should be set after accept"
    return body


@pytest.fixture(scope="session")
def open_job_no_driver(http, customer):
    """A job that has NO assigned driver — used to test 4403 from the demo driver
    (the driver is neither customer nor assigned driver of THIS job)."""
    job = _create_job(http, customer["access_token"], dispatch_mode="offers", desc_tag="unrelated")
    assert job.get("driver_id") in (None, ""), f"expected no driver, got {job.get('driver_id')}"
    return job


# ---------- Tests ----------
class TestWSAuth:
    """The server's close-code contract (4401/4403) is delivered as a WS close
    frame ONLY IF `ws.accept()` is called before `ws.close(code=...)`.
    If the route closes before accepting, Starlette sends an HTTP 403 during the
    upgrade instead — the connection is still rejected, but the spec'd close
    code never reaches the client. Both outcomes reject the WS, so we assert on
    either; we ALSO record which path was taken to inform the test report.
    """

    @staticmethod
    async def _expect_rejection(token, job_id):
        """Return ('close', code) or ('http', status) describing how the server
        rejected the upgrade."""
        try:
            ws = await _ws_connect(token, job_id)
        except InvalidStatus as e:
            return ("http", e.response.status_code)
        try:
            await _recv_json(ws, timeout=5)
        except ConnectionClosed as e:
            return ("close", e.code)
        finally:
            try:
                await ws.close()
            except Exception:
                pass
        raise AssertionError("server did NOT reject the WS connection")

    @pytest.mark.asyncio
    async def test_no_token_is_rejected(self, accepted_job):
        kind, code = await self._expect_rejection(None, accepted_job["id"])
        # Spec wants close-code 4401; current server returns HTTP 403 (see report).
        assert (kind, code) in (("close", 4401), ("http", 403)), (kind, code)

    @pytest.mark.asyncio
    async def test_no_token_close_code_is_4401(self, accepted_job):
        """Strict version of the spec — currently expected to fail until the
        server calls ws.accept() before ws.close(code=4401)."""
        kind, code = await self._expect_rejection(None, accepted_job["id"])
        assert kind == "close" and code == 4401, (
            f"spec requires WS close 4401; got {kind}={code}. Server must call "
            f"await ws.accept() before ws.close(code=4401) so the close code is "
            f"actually delivered to the client."
        )

    @pytest.mark.asyncio
    async def test_invalid_token_is_rejected(self, accepted_job):
        kind, code = await self._expect_rejection("not.a.valid.jwt", accepted_job["id"])
        assert (kind, code) in (("close", 4401), ("http", 403)), (kind, code)

    @pytest.mark.asyncio
    async def test_unrelated_user_is_rejected(self, driver, open_job_no_driver):
        """demodriver is neither the customer nor the assigned driver of
        `open_job_no_driver` (driver_id is None) -> rejected."""
        kind, code = await self._expect_rejection(
            driver["access_token"], open_job_no_driver["id"]
        )
        # Spec wants 4403 close code; server returns HTTP 403 today.
        assert (kind, code) in (("close", 4403), ("http", 403)), (kind, code)

    @pytest.mark.asyncio
    async def test_unrelated_user_close_code_is_4403(self, driver, open_job_no_driver):
        """Strict version — fails until server accepts before closing."""
        kind, code = await self._expect_rejection(
            driver["access_token"], open_job_no_driver["id"]
        )
        assert kind == "close" and code == 4403, (
            f"spec requires WS close 4403; got {kind}={code}. Server must call "
            f"await ws.accept() before ws.close(code=4403)."
        )


class TestWSReadyHandshake:
    @pytest.mark.asyncio
    async def test_customer_receives_ready_role_customer(self, customer, accepted_job):
        ws = await _ws_connect(customer["access_token"], accepted_job["id"])
        try:
            # Server sends last_location (optional) and then `ready`. Drain until ready.
            msg = None
            for _ in range(3):
                m = await _recv_json(ws, timeout=5)
                if m.get("type") == "ready":
                    msg = m
                    break
            assert msg is not None, "no ready frame received"
            assert msg["role"] == "customer", f"bad role: {msg}"
        finally:
            await ws.close()

    @pytest.mark.asyncio
    async def test_driver_receives_ready_role_driver(self, driver, accepted_job):
        ws = await _ws_connect(driver["access_token"], accepted_job["id"])
        try:
            msg = None
            for _ in range(3):
                m = await _recv_json(ws, timeout=5)
                if m.get("type") == "ready":
                    msg = m
                    break
            assert msg is not None, "no ready frame received"
            assert msg["role"] == "driver", f"bad role: {msg}"
        finally:
            await ws.close()


class TestWSLocationRelay:
    @pytest.mark.asyncio
    async def test_driver_location_broadcasts_to_customer_and_persists(
        self, http, customer, driver, accepted_job
    ):
        jid = accepted_job["id"]
        cust_ws = await _ws_connect(customer["access_token"], jid)
        drv_ws = await _ws_connect(driver["access_token"], jid)
        try:
            # Drain both connections' opening frames until each got `ready`.
            async def drain_until_ready(ws):
                for _ in range(4):
                    m = await _recv_json(ws, timeout=5)
                    if m.get("type") == "ready":
                        return m
                raise AssertionError("no ready")
            await drain_until_ready(cust_ws)
            await drain_until_ready(drv_ws)

            # Driver pushes a location
            lat, lng, heading = -19.2576, 146.8178, 270.5
            await drv_ws.send(json.dumps({
                "type": "location", "lat": lat, "lng": lng, "heading": heading
            }))

            # Customer should receive the broadcast
            loc_msg = None
            for _ in range(4):
                m = await _recv_json(cust_ws, timeout=5)
                if m.get("type") == "location":
                    loc_msg = m
                    break
            assert loc_msg is not None, "customer never received location"
            assert abs(loc_msg["lat"] - lat) < 1e-5
            assert abs(loc_msg["lng"] - lng) < 1e-5
            assert loc_msg.get("heading") == heading
            assert "ts" in loc_msg

            # Persistence: GET /api/jobs/{id} as the customer should show driver_location
            # (allow a brief grace period for the DB write)
            await asyncio.sleep(0.5)
            r = http.get(f"{API}/jobs/{jid}", headers=_bearer(customer["access_token"]), timeout=15)
            assert r.status_code == 200, r.text
            persisted = r.json().get("driver_location")
            assert persisted, f"driver_location not persisted: {r.json()}"
            assert abs(persisted["lat"] - lat) < 1e-5
            assert abs(persisted["lng"] - lng) < 1e-5
        finally:
            await cust_ws.close()
            await drv_ws.close()

    @pytest.mark.asyncio
    async def test_customer_location_message_is_ignored(self, http, customer, driver, accepted_job):
        """A customer (non-driver) sending {type:location} must NOT be broadcast to
        the driver, and must NOT overwrite the persisted driver_location."""
        jid = accepted_job["id"]
        cust_ws = await _ws_connect(customer["access_token"], jid)
        drv_ws = await _ws_connect(driver["access_token"], jid)
        try:
            async def drain_until_ready(ws):
                for _ in range(4):
                    m = await _recv_json(ws, timeout=5)
                    if m.get("type") == "ready":
                        return m
                raise AssertionError("no ready")
            await drain_until_ready(cust_ws)
            await drain_until_ready(drv_ws)

            # Snapshot persisted driver_location before
            before = http.get(
                f"{API}/jobs/{jid}", headers=_bearer(customer["access_token"]), timeout=15
            ).json().get("driver_location")

            # Customer attempts to push a location
            bogus_lat, bogus_lng = 1.111111, 2.222222
            await cust_ws.send(json.dumps({
                "type": "location", "lat": bogus_lat, "lng": bogus_lng, "heading": 0
            }))

            # Driver should NOT receive a broadcast within a short window
            got_bogus = False
            try:
                for _ in range(2):
                    m = await _recv_json(drv_ws, timeout=2.0)
                    if (
                        m.get("type") == "location"
                        and abs(m.get("lat", 0) - bogus_lat) < 1e-5
                        and abs(m.get("lng", 0) - bogus_lng) < 1e-5
                    ):
                        got_bogus = True
                        break
            except asyncio.TimeoutError:
                pass
            assert not got_bogus, "customer location was broadcast — server should ignore it"

            # And persisted driver_location must NOT be the bogus customer one
            after = http.get(
                f"{API}/jobs/{jid}", headers=_bearer(customer["access_token"]), timeout=15
            ).json().get("driver_location")
            if after:
                assert not (
                    abs(after["lat"] - bogus_lat) < 1e-5
                    and abs(after["lng"] - bogus_lng) < 1e-5
                ), f"customer location was persisted: {after}"
            # If `before` existed, it should be unchanged
            if before:
                assert after == before, f"driver_location changed unexpectedly: {before} -> {after}"
        finally:
            await cust_ws.close()
            await drv_ws.close()
