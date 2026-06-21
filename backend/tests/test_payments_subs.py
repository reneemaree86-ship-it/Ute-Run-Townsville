"""Stripe payments, subscriptions, plans, OTP signup, legal screens — backend tests."""
import os
import uuid
import pytest
import requests

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"

DEMO_CUST = {"email": "demo@uterun.com", "password": "Password123!"}
DEMO_DRV = {"email": "demodriver@uterun.com", "password": "Password123!"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


@pytest.fixture(scope="session")
def cust_token():
    r = _login(DEMO_CUST["email"], DEMO_CUST["password"])
    if r.status_code != 200:
        pytest.skip(f"Demo customer not seeded ({r.status_code}: {r.text[:160]})")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def drv_token():
    r = _login(DEMO_DRV["email"], DEMO_DRV["password"])
    if r.status_code != 200:
        pytest.skip(f"Demo driver not seeded ({r.status_code}: {r.text[:160]})")
    return r.json()["access_token"]


# --------------- Payments config / plans ---------------
class TestPaymentsConfig:
    def test_payments_config_enabled(self):
        r = requests.get(f"{API}/payments/config")
        assert r.status_code == 200
        body = r.json()
        assert body["enabled"] is True
        assert body["publishable_key"].startswith("pk_test_"), body

    def test_plans_customer(self):
        r = requests.get(f"{API}/plans", params={"role": "customer"})
        assert r.status_code == 200
        plans = r.json()
        ids = {p["id"] for p in plans}
        assert {"starter", "pro", "enterprise"} <= ids
        pro = next(p for p in plans if p["id"] == "pro")
        assert pro["price_monthly"] == 99
        assert pro["discount_pct"] == 0.20

    def test_plans_driver(self):
        r = requests.get(f"{API}/plans", params={"role": "driver"})
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert {"basic_premium", "pro_driver", "fleet"} <= ids


# --------------- Subscription Stripe checkout ---------------
class TestSubscriptionCheckout:
    def test_create_sub_checkout_pro_monthly(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}"}
        r = requests.post(f"{API}/payments/create-subscription-checkout",
                          headers=h, json={"plan_id": "pro", "billing": "monthly"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["url"].startswith("https://checkout.stripe.com/")
        assert body["session_id"].startswith("cs_test_")

    def test_create_sub_checkout_annual(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}"}
        r = requests.post(f"{API}/payments/create-subscription-checkout",
                          headers=h, json={"plan_id": "enterprise", "billing": "annual"})
        assert r.status_code == 200
        assert r.json()["url"].startswith("https://checkout.stripe.com/")

    def test_create_sub_checkout_driver(self, drv_token):
        h = {"Authorization": f"Bearer {drv_token}"}
        r = requests.post(f"{API}/payments/create-subscription-checkout",
                          headers=h, json={"plan_id": "pro_driver", "billing": "monthly"})
        assert r.status_code == 200
        assert r.json()["url"].startswith("https://checkout.stripe.com/")

    def test_create_sub_checkout_invalid_plan(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}"}
        r = requests.post(f"{API}/payments/create-subscription-checkout",
                          headers=h, json={"plan_id": "nope_xx", "billing": "monthly"})
        assert r.status_code == 404

    def test_create_sub_checkout_unauthorized(self):
        r = requests.post(f"{API}/payments/create-subscription-checkout",
                          json={"plan_id": "pro", "billing": "monthly"})
        assert r.status_code == 401

    def test_verify_unknown_session_returns_pending_or_404(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}"}
        # Stripe rejects a malformed id with 4xx upstream; the endpoint should not
        # silently mark anything paid. Either 4xx or status!=paid is acceptable.
        r = requests.get(f"{API}/payments/verify/cs_test_invalid_xxxxx", headers=h)
        assert r.status_code in (200, 400, 404, 500)
        if r.status_code == 200:
            assert r.json().get("status") != "paid"


# --------------- Verify Stripe success_url is reachable ---------------
class TestStripeCheckoutSession:
    def test_checkout_url_is_live_and_aud(self, cust_token):
        """Pull the Checkout session URL, fetch it, and confirm it loads."""
        h = {"Authorization": f"Bearer {cust_token}"}
        r = requests.post(f"{API}/payments/create-subscription-checkout",
                          headers=h, json={"plan_id": "starter", "billing": "monthly"})
        assert r.status_code == 200
        url = r.json()["url"]
        page = requests.get(url, timeout=20, allow_redirects=True)
        # Stripe Checkout returns HTML 200; on test mode it's accessible without auth.
        assert page.status_code == 200, page.status_code
        # Should be served by Stripe.
        assert "stripe" in page.url.lower()


# --------------- Job checkout ---------------
class TestJobCheckout:
    def test_create_job_checkout_full_flow(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}"}
        # Create a job (instant -> accepted) so it has a fare
        r = requests.post(f"{API}/jobs", headers=h, json={
            "job_type": "pickup", "description": "TEST job-checkout",
            "pickup_address": "Townsville", "dropoff_address": "Aitkenvale",
            "load_size": "small", "preferred_time": "ASAP", "dispatch_mode": "instant",
        })
        assert r.status_code == 200, r.text
        jid = r.json()["id"]

        r2 = requests.post(f"{API}/payments/create-job-checkout",
                           headers=h, json={"job_id": jid})
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["url"].startswith("https://checkout.stripe.com/")
        assert body["session_id"].startswith("cs_test_")

    def test_job_checkout_unknown_job(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}"}
        r = requests.post(f"{API}/payments/create-job-checkout",
                          headers=h, json={"job_id": "does-not-exist"})
        assert r.status_code == 404


# --------------- Subscription discount logic ---------------
class TestSubscriptionDiscount:
    def test_pro_subscription_applies_20pct_discount(self):
        """Use a brand-new customer (OTP gated -> needs SMS) is not feasible,
        so we mock-subscribe an existing demo and verify the discount kicks in.
        """
        # login as the demo customer
        tok = _login(DEMO_CUST["email"], DEMO_CUST["password"])
        if tok.status_code != 200:
            pytest.skip("demo customer not available")
        token = tok.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        # Set MOCK subscription = pro/monthly
        s = requests.post(f"{API}/subscription/subscribe", headers=h,
                          json={"plan_id": "pro", "billing": "monthly"})
        assert s.status_code == 200
        # Confirm via /me + /subscription
        sub = requests.get(f"{API}/subscription", headers=h).json()
        assert sub["subscription"]["status"] == "active"
        assert sub["subscription"]["discount_pct"] == 0.20

        # Create a job and ensure fare carries subscription_discount fields
        j = requests.post(f"{API}/jobs", headers=h, json={
            "job_type": "delivery", "description": "TEST sub discount",
            "pickup_address": "Townsville", "dropoff_address": "Aitkenvale",
            "load_size": "medium", "preferred_time": "ASAP", "dispatch_mode": "offers",
        })
        assert j.status_code == 200, j.text
        fare = j.json()["fare"]
        assert "original_total" in fare, fare
        assert fare["subscription_discount_pct"] == 20
        assert round(fare["original_total"] - fare["total"], 2) == fare["subscription_discount"]
        # cleanup: cancel the sub so other tests aren't affected
        requests.post(f"{API}/subscription/cancel", headers=h)


# --------------- OTP signup ---------------
class TestOtpSignup:
    def test_signup_without_otp_when_twilio_enabled_fails(self):
        email = f"test_{uuid.uuid4().hex[:8]}@uterun.com"
        r = requests.post(f"{API}/auth/signup", json={
            "email": email, "password": "Password123!",
            "full_name": "TEST no-otp", "phone": "+61400111222",
            "role": "customer",
        })
        # Twilio is configured -> backend MUST require otp_code
        assert r.status_code == 400, r.text
        assert "verification" in r.text.lower() or "otp" in r.text.lower()

    def test_signup_with_bad_otp_fails(self):
        email = f"test_{uuid.uuid4().hex[:8]}@uterun.com"
        r = requests.post(f"{API}/auth/signup", json={
            "email": email, "password": "Password123!",
            "full_name": "TEST bad-otp", "phone": "+61400111333",
            "role": "customer", "otp_code": "000000",
        })
        assert r.status_code == 400


# --------------- Regression smoke ---------------
class TestRegression:
    def test_login_demo_customer(self):
        r = _login(DEMO_CUST["email"], DEMO_CUST["password"])
        assert r.status_code == 200
        assert r.json()["user"]["email"] == DEMO_CUST["email"]

    def test_login_demo_driver(self):
        r = _login(DEMO_DRV["email"], DEMO_DRV["password"])
        assert r.status_code == 200
        u = r.json()["user"]
        assert u.get("driver_profile"), "demo driver must have a driver_profile"
        assert u["driver_profile"]["verification_status"] == "approved"

    def test_role_toggle_demo(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}"}
        r = requests.patch(f"{API}/auth/role", headers=h, json={"role": "driver"})
        assert r.status_code == 200
        r2 = requests.patch(f"{API}/auth/role", headers=h, json={"role": "customer"})
        assert r2.json()["active_role"] == "customer"

    def test_verified_drivers_and_feed(self, drv_token):
        r = requests.get(f"{API}/drivers/verified")
        assert r.status_code == 200 and len(r.json()) >= 1
        h = {"Authorization": f"Bearer {drv_token}"}
        f = requests.get(f"{API}/jobs/feed", headers=h)
        assert f.status_code == 200
