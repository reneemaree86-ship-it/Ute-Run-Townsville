from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os, logging, uuid, math, jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24 * 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uterun")

# Townsville geo center
TSV = {"lat": -19.2590, "lng": 146.8169}

# ---------- Pricing config ----------
JOB_TYPES = ["pickup", "delivery", "move", "tip_run"]
BASE_FARE = {"pickup": 15.0, "delivery": 18.0, "move": 35.0, "tip_run": 25.0}
LOAD_MULT = {"small": 1.0, "medium": 1.3, "large": 1.7, "xl": 2.2}
PER_KM = 2.5
PLATFORM_FEE_PCT = 0.12

# ---------- Twilio SMS OTP ----------
from twilio.rest import Client as TwilioClient

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
OTP_TTL_MINUTES = 10

twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER:
    try:
        logging.getLogger("twilio.http_client").setLevel(logging.WARNING)
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio SMS configured")
    except Exception as e:
        logger.warning(f"Twilio init failed: {e}")

def normalize_phone(phone: str) -> str:
    """Best-effort E.164 for Australian numbers."""
    p = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if p.startswith("+"):
        return p
    if p.startswith("0"):
        return "+61" + p[1:]
    if p.startswith("61"):
        return "+" + p
    return "+" + p

def send_otp_sms(to_phone: str, code: str):
    """Send the OTP via Twilio. Raises on failure."""
    if not twilio_client:
        raise RuntimeError("SMS service not configured")
    twilio_client.messages.create(
        body=f"Your UteRun verification code is {code}. It expires in {OTP_TTL_MINUTES} minutes.",
        from_=TWILIO_FROM_NUMBER,
        to=to_phone,
    )

# ---------- Subscription plans ----------
# Customer "Business" plans give a % discount on every job.
# Driver "Premium" memberships reduce the platform commission (driver keeps more).
PLANS = {
    "customer": [
        {"id": "starter", "name": "Starter", "price_monthly": 49, "price_annual": 499,
         "discount_pct": 0.10, "job_limit": 5,
         "tagline": "For small businesses getting started",
         "features": ["10% off all jobs", "Priority quoting", "Dedicated dashboard", "Up to 5 jobs / month"]},
        {"id": "pro", "name": "Pro", "price_monthly": 99, "price_annual": 999,
         "discount_pct": 0.20, "job_limit": None,
         "tagline": "For growing operations", "popular": True,
         "features": ["20% off all jobs", "Unlimited jobs", "Instant booking", "Monthly reports"]},
        {"id": "enterprise", "name": "Enterprise", "price_monthly": 199, "price_annual": 1999,
         "discount_pct": 0.25, "job_limit": None,
         "tagline": "For high-volume businesses",
         "features": ["25% off all jobs", "All Pro features", "API access", "Custom rules"]},
    ],
    "driver": [
        {"id": "basic_premium", "name": "Basic Premium", "price_monthly": 19, "price_annual": 199,
         "commission_reduction_pct": 0.05,
         "tagline": "Keep more of every run",
         "features": ["Priority job notifications", "5% commission reduction"]},
        {"id": "pro_driver", "name": "Pro Driver", "price_monthly": 39, "price_annual": 399,
         "commission_reduction_pct": 0.08, "popular": True,
         "tagline": "Maximise your earnings",
         "features": ["8% commission reduction", "Top placement in feed", "Instant accept"]},
        {"id": "fleet", "name": "Fleet", "price_monthly": 79, "price_annual": 799,
         "commission_reduction_pct": 0.08, "per_vehicle": True,
         "tagline": "For multi-ute operators",
         "features": ["Everything in Pro Driver", "Multi-vehicle dashboard", "Team accounts"]},
    ],
}
PLAN_BY_ID = {p["id"]: {**p, "role": role} for role, plans in PLANS.items() for p in plans}

def active_subscription(user):
    sub = user.get("subscription")
    if sub and sub.get("status") == "active":
        return sub
    return None

# ---------- Stripe ----------
import stripe as stripe_sdk

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
stripe_enabled = bool(STRIPE_SECRET_KEY)
if stripe_enabled:
    stripe_sdk.api_key = STRIPE_SECRET_KEY
    logger.info("Stripe configured")

# ---------- Transactional email (Resend) ----------
import emailer

JOB_LABELS = {"pickup": "Pickup", "delivery": "Delivery", "move": "Move", "tip_run": "Tip Run"}

# ---------------- Models ----------------
class SignupIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: Literal["customer", "driver"] = "customer"
    otp_code: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class OTPIn(BaseModel):
    phone: str

class OTPVerifyIn(BaseModel):
    phone: str
    code: str

class RoleIn(BaseModel):
    role: Literal["customer", "driver"]

class DriverProfileIn(BaseModel):
    license_no: str
    rego: str
    insurance: str
    ute_type: str
    abn: Optional[str] = None
    ute_photos: List[str] = []
    license_photo: Optional[str] = None
    rego_photo: Optional[str] = None

class AvailabilityIn(BaseModel):
    available: bool

class LocationIn(BaseModel):
    lat: float
    lng: float

class FareIn(BaseModel):
    job_type: Literal["pickup", "delivery", "move", "tip_run"]
    load_size: Literal["small", "medium", "large", "xl"]
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None

class JobIn(BaseModel):
    job_type: Literal["pickup", "delivery", "move", "tip_run"]
    description: str
    photos: List[str] = []
    pickup_address: str
    dropoff_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    load_size: Literal["small", "medium", "large", "xl"]
    preferred_time: str = "ASAP"
    dispatch_mode: Literal["instant", "offers", "direct"] = "instant"
    preferred_driver_id: Optional[str] = None

class AdminVerifyIn(BaseModel):
    action: Literal["approve", "reject"]
    note: Optional[str] = ""

class StatusIn(BaseModel):
    status: Literal["picked_up", "delivered", "completed", "cancelled"]

class MessageIn(BaseModel):
    text: str

class RateIn(BaseModel):
    stars: int
    review: Optional[str] = ""

class SubscribeIn(BaseModel):
    plan_id: str
    billing: Literal["monthly", "annual"] = "monthly"
    return_base: Optional[str] = None

class JobCheckoutIn(BaseModel):
    job_id: str
    return_base: Optional[str] = None

class ConnectLinkIn(BaseModel):
    return_base: Optional[str] = None

# ---------------- Helpers ----------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def compute_fare(job_type, load_size, distance_km):
    base = BASE_FARE[job_type]
    mult = LOAD_MULT[load_size]
    subtotal = (base + PER_KM * distance_km) * mult
    platform_fee = subtotal * PLATFORM_FEE_PCT
    total = subtotal + platform_fee
    driver_earnings = subtotal
    return {
        "distance_km": round(distance_km, 1),
        "base_fare": round(base, 2),
        "load_multiplier": mult,
        "subtotal": round(subtotal, 2),
        "platform_fee": round(platform_fee, 2),
        "total": round(total, 2),
        "driver_earnings": round(driver_earnings, 2),
        "currency": "AUD",
    }

def estimate_distance(b: FareIn):
    if None not in (b.pickup_lat, b.pickup_lng, b.dropoff_lat, b.dropoff_lng):
        d = haversine(b.pickup_lat, b.pickup_lng, b.dropoff_lat, b.dropoff_lng)
        return max(d, 1.0)
    return 8.0

def make_token(uid):
    exp = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": uid, "exp": exp}, JWT_SECRET, algorithm=ALGORITHM)

def public_user(u):
    return {
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "phone": u.get("phone"),
        "phone_verified": u.get("phone_verified", False),
        "role": u.get("role", "customer"),
        "active_role": u.get("active_role", u.get("role", "customer")),
        "needs_role_selection": u.get("needs_role_selection", False),
        "avatar": u.get("avatar"),
        "rating": u.get("rating", 0),
        "num_ratings": u.get("num_ratings", 0),
        "driver_profile": u.get("driver_profile"),
        "subscription": u.get("subscription"),
        "is_admin": u.get("is_admin", False),
        "created_at": u.get("created_at"),
    }

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        uid = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=401, detail="User not found")
    return u

async def get_admin_user(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ---------------- Auth ----------------
@api.post("/auth/signup")
async def signup(body: SignupIn, background_tasks: BackgroundTasks):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    phone = normalize_phone(body.phone)
    phone_verified = False
    # When SMS is configured, signup requires a valid OTP code for the phone.
    if twilio_client:
        if not body.otp_code:
            raise HTTPException(status_code=400, detail="Phone verification code required")
        rec = await db.otps.find_one({"phone": phone})
        if not rec or rec.get("code") != body.otp_code:
            raise HTTPException(status_code=400, detail="Invalid verification code")
        try:
            exp = datetime.fromisoformat(rec["expires_at"])
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(status_code=400, detail="Verification code expired")
        except (KeyError, ValueError):
            pass
        phone_verified = True
        await db.otps.delete_one({"phone": phone})

    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "full_name": body.full_name,
        "phone": phone,
        "phone_verified": phone_verified,
        "password_hash": pwd_context.hash(body.password),
        "role": body.role,
        "active_role": body.role,
        "avatar": None,
        "rating": 0,
        "num_ratings": 0,
        "driver_profile": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    background_tasks.add_task(emailer.send_welcome, email, body.full_name, body.role)
    return {"access_token": make_token(uid), "user": public_user(doc)}

@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not pwd_context.verify(body.password, u["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    return {"access_token": make_token(u["id"]), "user": public_user(u)}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)

class GoogleAuthIn(BaseModel):
    session_id: str

class InitialRoleIn(BaseModel):
    role: Literal["customer", "driver"]

@api.post("/auth/google")
async def google_auth(body: GoogleAuthIn):
    import httpx
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Could not read your Google account")
    existing = await db.users.find_one({"email": email})
    if existing:
        # keep existing account; refresh avatar/name if missing
        upd = {}
        if not existing.get("avatar") and data.get("picture"):
            upd["avatar"] = data["picture"]
        if upd:
            await db.users.update_one({"id": existing["id"]}, {"$set": upd})
            existing.update(upd)
        return {"access_token": make_token(existing["id"]), "user": public_user(existing), "is_new_user": False}
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": None,
        "full_name": data.get("name") or email.split("@")[0],
        "phone": None,
        "phone_verified": True,  # Google email is verified
        "auth_provider": "google",
        "role": "customer",
        "active_role": "customer",
        "needs_role_selection": True,
        "avatar": data.get("picture"),
        "rating": 0,
        "num_ratings": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {"access_token": make_token(uid), "user": public_user(doc), "is_new_user": True}

@api.post("/auth/select-role")
async def select_initial_role(body: InitialRoleIn, user=Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": body.role, "active_role": body.role, "needs_role_selection": False}},
    )
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(u)

@api.patch("/auth/role")
async def switch_role(body: RoleIn, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_role": body.role}})
    user["active_role"] = body.role
    return public_user(user)

@api.post("/auth/request-otp")
async def request_otp(body: OTPIn):
    import random
    phone = normalize_phone(body.phone)
    code = f"{random.randint(0, 999999):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {"code": code, "expires_at": expires, "created_at": now_iso()}},
        upsert=True,
    )
    if not twilio_client:
        # SMS not configured -> dev fallback so the flow remains testable
        logger.info(f"[DEV OTP] {phone} -> {code}")
        return {"status": "sent", "dev_hint": code}
    try:
        send_otp_sms(phone, code)
    except Exception as e:
        logger.warning(f"Twilio send failed for {phone}: {e}")
        raise HTTPException(status_code=502, detail="Could not send SMS. Check the number and try again.")
    return {"status": "sent", "phone": phone}

@api.post("/auth/verify-otp")
async def verify_otp(body: OTPVerifyIn):
    phone = normalize_phone(body.phone)
    rec = await db.otps.find_one({"phone": phone})
    if not rec or rec.get("code") != body.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    try:
        if datetime.now(timezone.utc) > datetime.fromisoformat(rec["expires_at"]):
            raise HTTPException(status_code=400, detail="Verification code expired")
    except (KeyError, ValueError):
        pass
    await db.users.update_one({"phone": phone}, {"$set": {"phone_verified": True}})
    await db.otps.delete_one({"phone": phone})
    return {"message": "Phone verified"}

# ---------------- Driver ----------------
@api.post("/driver/profile")
async def submit_driver_profile(body: DriverProfileIn, user=Depends(get_current_user)):
    profile = {
        **body.dict(),
        "verification_status": "pending",
        "available": False,
        "current_lat": TSV["lat"],
        "current_lng": TSV["lng"],
        "submitted_at": now_iso(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"driver_profile": profile}})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(u)

@api.patch("/driver/availability")
async def set_availability(body: AvailabilityIn, user=Depends(get_current_user)):
    if not user.get("driver_profile"):
        raise HTTPException(status_code=400, detail="Complete driver verification first")
    await db.users.update_one({"id": user["id"]}, {"$set": {"driver_profile.available": body.available}})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(u)

@api.patch("/driver/location")
async def set_location(body: LocationIn, user=Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"driver_profile.current_lat": body.lat, "driver_profile.current_lng": body.lng}},
    )
    return {"ok": True}

@api.get("/drivers/verified")
async def verified_drivers():
    cur = db.users.find(
        {"driver_profile.verification_status": "approved"},
        {"_id": 0, "password_hash": 0},
    ).limit(20)
    out = []
    async for u in cur:
        dp = u.get("driver_profile") or {}
        out.append({
            "id": u["id"],
            "full_name": u["full_name"],
            "avatar": u.get("avatar"),
            "rating": u.get("rating", 5),
            "num_ratings": u.get("num_ratings", 0),
            "ute_type": dp.get("ute_type"),
            "ute_photos": dp.get("ute_photos", []),
            "available": dp.get("available", False),
            "verification_status": dp.get("verification_status"),
        })
    return out

@api.get("/driver/earnings")
async def driver_earnings(user=Depends(get_current_user)):
    cur = db.jobs.find({"driver_id": user["id"], "status": "completed"}, {"_id": 0})
    jobs = [j async for j in cur]
    now = datetime.now(timezone.utc)
    today = now.date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    today_total = week_total = month_total = 0.0
    chart = {i: 0.0 for i in range(7)}
    for j in jobs:
        amt = (j.get("fare") or {}).get("driver_earnings", 0)
        comp = j.get("completed_at") or j.get("created_at")
        try:
            d = datetime.fromisoformat(comp).date()
        except Exception:
            d = today
        if d == today:
            today_total += amt
        if d >= week_start:
            week_total += amt
            chart[d.weekday()] = chart.get(d.weekday(), 0) + amt
        if d >= month_start:
            month_total += amt
    return {
        "today": round(today_total, 2),
        "week": round(week_total, 2),
        "month": round(month_total, 2),
        "trips": len(jobs),
        "week_chart": [round(chart[i], 2) for i in range(7)],
        "currency": "AUD",
    }

# ---------------- Stripe Connect (driver payouts) ----------------
async def _ensure_connect_account(user):
    acct_id = user.get("stripe_account_id")
    if acct_id:
        return acct_id
    account = stripe_sdk.Account.create(
        type="express", country="AU", email=user["email"],
        capabilities={"transfers": {"requested": True}},
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_account_id": account.id}})
    return account.id

@api.post("/driver/connect/onboarding-link")
async def driver_onboarding_link(body: ConnectLinkIn, request: Request, user=Depends(get_current_user)):
    if not stripe_enabled:
        raise HTTPException(status_code=503, detail="Payments not configured")
    acct_id = await _ensure_connect_account(user)
    base = (body.return_base or request.headers.get("origin") or FRONTEND_URL or "").rstrip("/")
    link = stripe_sdk.AccountLink.create(
        account=acct_id,
        refresh_url=f"{base}/connect-return?refresh=1",
        return_url=f"{base}/connect-return",
        type="account_onboarding",
    )
    return {"url": link.url}

@api.get("/driver/connect/status")
async def driver_connect_status(user=Depends(get_current_user)):
    acct_id = user.get("stripe_account_id")
    if not acct_id or not stripe_enabled:
        return {"connected": False, "details_submitted": False, "charges_enabled": False, "payouts_enabled": False}
    acct = stripe_sdk.Account.retrieve(acct_id)
    status = {
        "connected": True,
        "details_submitted": acct.details_submitted,
        "charges_enabled": acct.charges_enabled,
        "payouts_enabled": acct.payouts_enabled,
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_payouts": status}})
    return status

# ---------------- Fare ----------------
@api.post("/fare/estimate")
async def fare_estimate(body: FareIn):
    dist = estimate_distance(body)
    return compute_fare(body.job_type, body.load_size, dist)

# ---------------- Jobs ----------------
def public_job(j):
    j = dict(j)
    j.pop("_id", None)
    return j

@api.post("/jobs")
async def create_job(body: JobIn, user=Depends(get_current_user)):
    fb = FareIn(
        job_type=body.job_type, load_size=body.load_size,
        pickup_lat=body.pickup_lat, pickup_lng=body.pickup_lng,
        dropoff_lat=body.dropoff_lat, dropoff_lng=body.dropoff_lng,
    )
    dist = estimate_distance(fb)
    fare = compute_fare(body.job_type, body.load_size, dist)
    # Apply customer Business-subscription discount
    sub = active_subscription(user)
    if sub and sub.get("role") == "customer" and sub.get("discount_pct"):
        pct = sub["discount_pct"]
        disc = round(fare["total"] * pct, 2)
        fare["original_total"] = fare["total"]
        fare["subscription_discount_pct"] = int(pct * 100)
        fare["subscription_discount"] = disc
        fare["total"] = round(fare["total"] - disc, 2)
    jid = str(uuid.uuid4())
    job = {
        "id": jid,
        "customer_id": user["id"],
        "customer_name": user["full_name"],
        "customer_avatar": user.get("avatar"),
        "job_type": body.job_type,
        "description": body.description,
        "photos": body.photos,
        "pickup_address": body.pickup_address,
        "dropoff_address": body.dropoff_address,
        "pickup_lat": body.pickup_lat or TSV["lat"],
        "pickup_lng": body.pickup_lng or TSV["lng"],
        "dropoff_lat": body.dropoff_lat or (TSV["lat"] + 0.03),
        "dropoff_lng": body.dropoff_lng or (TSV["lng"] + 0.03),
        "load_size": body.load_size,
        "preferred_time": body.preferred_time,
        "dispatch_mode": body.dispatch_mode,
        "directed_to": None,
        "requested_driver_name": None,
        "fare": fare,
        "distance_km": fare["distance_km"],
        "status": "open",
        "driver_id": None,
        "driver_name": None,
        "driver_avatar": None,
        "customer_rated": False,
        "driver_rated": False,
        "created_at": now_iso(),
    }
    # Direct request: route this job only to the chosen driver (they accept/decline)
    if body.dispatch_mode == "direct" and body.preferred_driver_id:
        target = await db.users.find_one({
            "id": body.preferred_driver_id,
            "driver_profile.verification_status": "approved",
        })
        if not target:
            raise HTTPException(status_code=400, detail="That driver isn't available to request")
        job["directed_to"] = target["id"]
        job["requested_driver_name"] = target["full_name"]
    # Instant dispatch: auto-match the nearest available approved driver
    if body.dispatch_mode == "instant":
        best = None
        best_d = 1e9
        async for drv in db.users.find({
            "driver_profile.verification_status": "approved",
            "driver_profile.available": True,
        }):
            dp = drv.get("driver_profile") or {}
            d = haversine(dp.get("current_lat", TSV["lat"]), dp.get("current_lng", TSV["lng"]),
                          job["pickup_lat"], job["pickup_lng"])
            if d < best_d:
                best_d, best = d, drv
        if best:
            bdp = best.get("driver_profile") or {}
            job.update({
                "status": "accepted",
                "driver_id": best["id"],
                "driver_name": best["full_name"],
                "driver_avatar": best.get("avatar"),
                "driver_profile_snapshot": {
                    "ute_type": bdp.get("ute_type"),
                    "rating": best.get("rating", 5),
                    "ute_photos": bdp.get("ute_photos", []),
                },
                "accepted_at": now_iso(),
            })
    await db.jobs.insert_one(job)
    return public_job(job)

@api.get("/jobs/my")
async def my_jobs(user=Depends(get_current_user)):
    cur = db.jobs.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return [j async for j in cur]

@api.get("/jobs/feed")
async def jobs_feed(user=Depends(get_current_user)):
    # open jobs that are either undirected, or a direct request to THIS driver
    cur = db.jobs.find(
        {"status": "open", "$or": [
            {"directed_to": None},
            {"directed_to": {"$exists": False}},
            {"directed_to": user["id"]},
        ]},
        {"_id": 0},
    ).sort("created_at", -1).limit(50)
    jobs = [j async for j in cur]
    dp = user.get("driver_profile") or {}
    dlat = dp.get("current_lat", TSV["lat"])
    dlng = dp.get("current_lng", TSV["lng"])
    for j in jobs:
        j["driver_distance_km"] = round(haversine(dlat, dlng, j["pickup_lat"], j["pickup_lng"]), 1)
        j["is_direct_request"] = j.get("directed_to") == user["id"]
    # direct requests first, then by distance
    jobs.sort(key=lambda x: (not x["is_direct_request"], x["driver_distance_km"]))
    return jobs

@api.get("/jobs/active")
async def active_jobs(user=Depends(get_current_user)):
    cur = db.jobs.find(
        {"driver_id": user["id"], "status": {"$in": ["accepted", "picked_up", "delivered"]}},
        {"_id": 0},
    ).sort("created_at", -1)
    return [j async for j in cur]

@api.get("/jobs/{jid}")
async def get_job(jid: str, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return j

@api.post("/jobs/{jid}/accept")
async def accept_job(jid: str, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if j["status"] != "open":
        raise HTTPException(status_code=400, detail="Job no longer available")
    dp = user.get("driver_profile") or {}
    if dp.get("verification_status") != "approved":
        raise HTTPException(status_code=403, detail="Your driver account is not approved yet")
    if j.get("directed_to") and j["directed_to"] != user["id"]:
        raise HTTPException(status_code=403, detail="This job was requested for another driver")
    # Apply driver Premium-membership commission reduction (driver keeps more)
    new_earnings = j["fare"]["driver_earnings"]
    msub = active_subscription(user)
    if msub and msub.get("role") == "driver" and msub.get("commission_reduction_pct"):
        bonus = round(j["fare"].get("platform_fee", 0) * msub["commission_reduction_pct"], 2)
        new_earnings = round(new_earnings + bonus, 2)
    await db.jobs.update_one({"id": jid}, {"$set": {
        "status": "accepted",
        "driver_id": user["id"],
        "driver_name": user["full_name"],
        "driver_avatar": user.get("avatar"),
        "fare.driver_earnings": new_earnings,
        "driver_profile_snapshot": {
            "ute_type": dp.get("ute_type"),
            "rating": user.get("rating", 5),
            "ute_photos": dp.get("ute_photos", []),
        },
        "accepted_at": now_iso(),
    }})
    return await db.jobs.find_one({"id": jid}, {"_id": 0})

@api.post("/jobs/{jid}/status")
async def update_status(jid: str, body: StatusIn, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    upd = {"status": body.status}
    if body.status == "completed":
        upd["completed_at"] = now_iso()
        driver = await db.users.find_one({"id": j.get("driver_id")})
        if driver and driver.get("email"):
            earned = (j.get("fare") or {}).get("driver_earnings", 0)
            label = JOB_LABELS.get(j.get("job_type"), "run")
            background_tasks.add_task(emailer.send_payout_note, driver["email"], driver.get("full_name"), earned, label)
    if body.status == "cancelled":
        upd["cancelled_at"] = now_iso()
    await db.jobs.update_one({"id": jid}, {"$set": upd})
    return await db.jobs.find_one({"id": jid}, {"_id": 0})

@api.post("/jobs/{jid}/cancel")
async def cancel_job(jid: str, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.jobs.update_one({"id": jid}, {"$set": {"status": "cancelled", "cancelled_at": now_iso()}})
    return await db.jobs.find_one({"id": jid}, {"_id": 0})

# ---------------- Messages ----------------
@api.get("/jobs/{jid}/messages")
async def get_messages(jid: str, user=Depends(get_current_user)):
    cur = db.messages.find({"job_id": jid}, {"_id": 0}).sort("created_at", 1)
    return [m async for m in cur]

@api.post("/jobs/{jid}/messages")
async def post_message(jid: str, body: MessageIn, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    msg = {
        "id": str(uuid.uuid4()),
        "job_id": jid,
        "sender_id": user["id"],
        "sender_name": user["full_name"],
        "sender_role": user.get("active_role"),
        "text": body.text,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return msg

@api.get("/conversations")
async def conversations(user=Depends(get_current_user)):
    role = user.get("active_role")
    q = {"customer_id": user["id"]} if role == "customer" else {"driver_id": user["id"]}
    cur = db.jobs.find({**q, "driver_id": {"$ne": None}}, {"_id": 0}).sort("created_at", -1)
    out = []
    async for j in cur:
        last = await db.messages.find_one({"job_id": j["id"]}, {"_id": 0}, sort=[("created_at", -1)])
        other = j["driver_name"] if role == "customer" else j["customer_name"]
        other_av = j.get("driver_avatar") if role == "customer" else j.get("customer_avatar")
        out.append({
            "job_id": j["id"],
            "job_type": j["job_type"],
            "status": j["status"],
            "other_name": other,
            "other_avatar": other_av,
            "last_message": last["text"] if last else None,
            "last_at": last["created_at"] if last else j.get("accepted_at"),
        })
    return out

# ---------------- Subscriptions ----------------
@api.get("/plans")
async def get_plans(role: str = "customer"):
    return PLANS.get(role, [])

@api.get("/subscription")
async def get_subscription(user=Depends(get_current_user)):
    sub = user.get("subscription")
    plan = PLAN_BY_ID.get(sub["plan_id"]) if sub else None
    return {"subscription": sub, "plan": plan}

@api.post("/subscription/subscribe")
async def subscribe(body: SubscribeIn, user=Depends(get_current_user)):
    plan = PLAN_BY_ID.get(body.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    price = plan["price_annual"] if body.billing == "annual" else plan["price_monthly"]
    sub = {
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "role": plan["role"],
        "billing": body.billing,
        "price": price,
        "discount_pct": plan.get("discount_pct", 0),
        "commission_reduction_pct": plan.get("commission_reduction_pct", 0),
        "status": "active",
        "payment": "mock",  # MOCK billing until Stripe keys are connected
        "started_at": now_iso(),
        "renews_at": (datetime.now(timezone.utc) + timedelta(days=365 if body.billing == "annual" else 30)).isoformat(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription": sub}})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(u)

@api.post("/subscription/cancel")
async def cancel_subscription(user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription.status": "cancelled"}})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(u)

# ---------------- Stripe Checkout ----------------
def _checkout_urls(request: Request, return_base: Optional[str] = None):
    # Prefer the public origin the client sends (window.location.origin on web)
    # so the redirect returns to the exact same origin holding the user's JWT.
    base = return_base or request.headers.get("origin") or FRONTEND_URL or ""
    base = base.rstrip("/")
    return (
        f"{base}/payment-return?session_id={{CHECKOUT_SESSION_ID}}",
        f"{base}/payment-return?canceled=1",
    )

@api.post("/payments/create-subscription-checkout")
async def create_sub_checkout(body: SubscribeIn, request: Request, user=Depends(get_current_user)):
    if not stripe_enabled:
        raise HTTPException(status_code=503, detail="Payments not configured")
    plan = PLAN_BY_ID.get(body.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    price = plan["price_annual"] if body.billing == "annual" else plan["price_monthly"]
    interval = "year" if body.billing == "annual" else "month"
    success_url, cancel_url = _checkout_urls(request, body.return_base)
    session = stripe_sdk.checkout.Session.create(
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "aud",
                "product_data": {"name": f"UteRun {plan['name']} ({plan['role'].title()})"},
                "unit_amount": int(round(price * 100)),
                "recurring": {"interval": interval},
            },
            "quantity": 1,
        }],
        customer_email=user["email"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"kind": "subscription", "user_id": user["id"], "plan_id": plan["id"], "billing": body.billing},
    )
    return {"url": session.url, "session_id": session.id}

@api.post("/payments/create-job-checkout")
async def create_job_checkout(body: JobCheckoutIn, request: Request, user=Depends(get_current_user)):
    if not stripe_enabled:
        raise HTTPException(status_code=503, detail="Payments not configured")
    job = await db.jobs.find_one({"id": body.job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    amount = int(round(job["fare"]["total"] * 100))
    success_url, cancel_url = _checkout_urls(request, body.return_base)
    session = stripe_sdk.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "aud",
                "product_data": {"name": f"UteRun {job['job_type'].replace('_', ' ').title()} job"},
                "unit_amount": amount,
            },
            "quantity": 1,
        }],
        customer_email=user["email"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"kind": "job", "user_id": user["id"], "job_id": job["id"]},
    )
    return {"url": session.url, "session_id": session.id}

@api.get("/payments/verify/{session_id}")
async def verify_payment(session_id: str, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    if not stripe_enabled:
        raise HTTPException(status_code=503, detail="Payments not configured")
    try:
        session = stripe_sdk.checkout.Session.retrieve(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Payment session not found")
    meta = session.get("metadata") or {}
    kind = meta.get("kind")
    paid = session.get("payment_status") in ("paid", "no_payment_required")

    if kind == "subscription" and session.get("status") == "complete" and paid:
        plan = PLAN_BY_ID.get(meta.get("plan_id"))
        billing = meta.get("billing", "monthly")
        price = plan["price_annual"] if billing == "annual" else plan["price_monthly"]
        sub = {
            "plan_id": plan["id"], "plan_name": plan["name"], "role": plan["role"],
            "billing": billing, "price": price,
            "discount_pct": plan.get("discount_pct", 0),
            "commission_reduction_pct": plan.get("commission_reduction_pct", 0),
            "status": "active", "payment": "stripe",
            "stripe_subscription_id": session.get("subscription"),
            "stripe_session_id": session_id,
            "started_at": now_iso(),
            "renews_at": (datetime.now(timezone.utc) + timedelta(days=365 if billing == "annual" else 30)).isoformat(),
        }
        await db.users.update_one({"id": user["id"]}, {"$set": {"subscription": sub}})
        return {"status": "paid", "kind": "subscription"}

    if kind == "job" and paid:
        await db.jobs.update_one({"id": meta["job_id"]}, {"$set": {
            "payment": {"status": "paid", "method": "stripe", "session_id": session_id, "paid_at": now_iso()},
        }})
        job = await db.jobs.find_one({"id": meta["job_id"]})
        if job and not job.get("receipt_sent") and user.get("email"):
            amount = (job.get("fare") or {}).get("total", (session.get("amount_total") or 0) / 100)
            label = JOB_LABELS.get(job.get("job_type"), "Run")
            background_tasks.add_task(emailer.send_job_receipt, user["email"], user.get("full_name"), label, amount, meta["job_id"])
            await db.jobs.update_one({"id": meta["job_id"]}, {"$set": {"receipt_sent": True}})
        return {"status": "paid", "kind": "job"}

    return {"status": "pending", "kind": kind or "unknown"}

@api.get("/payments/config")
async def payments_config():
    return {"enabled": stripe_enabled, "publishable_key": STRIPE_PUBLISHABLE_KEY}

# ---------------- Ratings ----------------
@api.post("/jobs/{jid}/rate")
async def rate_job(jid: str, body: RateIn, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    role = user.get("active_role")
    target_id = j["driver_id"] if role == "customer" else j["customer_id"]
    if not target_id:
        raise HTTPException(status_code=400, detail="No counterpart to rate")
    rating = {
        "id": str(uuid.uuid4()),
        "job_id": jid,
        "from_id": user["id"],
        "to_id": target_id,
        "stars": body.stars,
        "review": body.review,
        "created_at": now_iso(),
    }
    await db.ratings.insert_one(rating)
    tgt = await db.users.find_one({"id": target_id})
    if tgt:
        n = tgt.get("num_ratings", 0)
        cur_avg = tgt.get("rating", 0)
        new_avg = (cur_avg * n + body.stars) / (n + 1)
        await db.users.update_one({"id": target_id}, {"$set": {"rating": round(new_avg, 2), "num_ratings": n + 1}})
    flag = "customer_rated" if role == "customer" else "driver_rated"
    await db.jobs.update_one({"id": jid}, {"$set": {flag: True}})
    return {"ok": True}

@api.get("/users/{uid}/reviews")
async def get_reviews(uid: str, user=Depends(get_current_user)):
    tgt = await db.users.find_one({"id": uid}, {"_id": 0})
    if not tgt:
        raise HTTPException(status_code=404, detail="User not found")
    cursor = db.ratings.find({"to_id": uid}, {"_id": 0}).sort("created_at", -1).limit(50)
    raw = await cursor.to_list(length=50)
    breakdown = {str(s): 0 for s in range(1, 6)}
    reviews = []
    for r in raw:
        s = int(r.get("stars", 0))
        if 1 <= s <= 5:
            breakdown[str(s)] += 1
        reviewer = await db.users.find_one({"id": r.get("from_id")}, {"_id": 0, "full_name": 1, "avatar": 1})
        reviews.append({
            "id": r["id"],
            "stars": s,
            "review": r.get("review") or "",
            "reviewer_name": (reviewer or {}).get("full_name", "UteRun user"),
            "reviewer_avatar": (reviewer or {}).get("avatar"),
            "created_at": r.get("created_at"),
        })
    return {
        "name": tgt.get("full_name"),
        "avatar": tgt.get("avatar"),
        "rating": tgt.get("rating", 0),
        "num_ratings": tgt.get("num_ratings", 0),
        "verified": tgt.get("phone_verified", False),
        "ute_type": (tgt.get("driver_profile") or {}).get("ute_type"),
        "breakdown": breakdown,
        "reviews": reviews,
    }

# ---------------- Direct request decline ----------------
@api.post("/jobs/{jid}/decline")
async def decline_job(jid: str, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if j.get("directed_to") != user["id"]:
        raise HTTPException(status_code=403, detail="This request isn't for you")
    # release the direct request to the open feed for everyone
    await db.jobs.update_one({"id": jid}, {"$set": {
        "directed_to": None, "dispatch_mode": "offers", "declined_at": now_iso(),
    }})
    return {"ok": True}

# ---------------- Admin: driver verification ----------------
@api.get("/admin/drivers/pending")
async def admin_pending_drivers(admin=Depends(get_admin_user)):
    cur = db.users.find(
        {"driver_profile.verification_status": "pending"},
        {"_id": 0, "password_hash": 0},
    ).sort("driver_profile.submitted_at", 1)
    out = []
    async for u in cur:
        dp = u.get("driver_profile") or {}
        out.append({
            "id": u["id"], "full_name": u["full_name"], "email": u.get("email"), "phone": u.get("phone"),
            "rating": u.get("rating", 0), "num_ratings": u.get("num_ratings", 0),
            "driver_profile": dp,
        })
    return out

@api.get("/admin/stats")
async def admin_stats(admin=Depends(get_admin_user)):
    pending = await db.users.count_documents({"driver_profile.verification_status": "pending"})
    approved = await db.users.count_documents({"driver_profile.verification_status": "approved"})
    rejected = await db.users.count_documents({"driver_profile.verification_status": "rejected"})
    jobs = await db.jobs.count_documents({})
    return {"pending": pending, "approved": approved, "rejected": rejected, "total_jobs": jobs}

@api.post("/admin/drivers/{uid}/verify")
async def admin_verify_driver(uid: str, body: AdminVerifyIn, background_tasks: BackgroundTasks, admin=Depends(get_admin_user)):
    target = await db.users.find_one({"id": uid})
    if not target or not target.get("driver_profile"):
        raise HTTPException(status_code=404, detail="Driver not found")
    approved = body.action == "approve"
    new_status = "approved" if approved else "rejected"
    await db.users.update_one({"id": uid}, {"$set": {
        "driver_profile.verification_status": new_status,
        "driver_profile.available": approved,
        "driver_profile.review_note": body.note,
        "driver_profile.reviewed_at": now_iso(),
    }})
    if target.get("email"):
        background_tasks.add_task(emailer.send_driver_status, target["email"], target.get("full_name"), approved, body.note)
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    return public_user(u)

# ---------------- Startup ----------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.jobs.create_index("id")
    # seed an admin account for driver verification review
    admin_email = "admin@uterun.com"
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": pwd_context.hash("Admin123!"),
            "full_name": "UteRun Admin",
            "phone": None,
            "phone_verified": True,
            "role": "customer",
            "active_role": "customer",
            "is_admin": True,
            "rating": 0,
            "num_ratings": 0,
            "created_at": now_iso(),
        })
        logger.info("Seeded admin account")
    else:
        await db.users.update_one({"email": admin_email}, {"$set": {"is_admin": True}})
    logger.info("Startup complete")

from fastapi import WebSocket, WebSocketDisconnect

# ---------------- Real-time job tracking (WebSocket) ----------------
class TrackingManager:
    """Keeps live WS connections grouped by job_id and broadcasts driver
    location updates to everyone watching that job."""
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = {}

    async def join(self, job_id: str, ws: WebSocket):
        self.rooms.setdefault(job_id, set()).add(ws)

    def leave(self, job_id: str, ws: WebSocket):
        room = self.rooms.get(job_id)
        if room:
            room.discard(ws)
            if not room:
                self.rooms.pop(job_id, None)

    async def broadcast(self, job_id: str, message: dict, exclude: WebSocket | None = None):
        for conn in list(self.rooms.get(job_id, set())):
            if conn is exclude:
                continue
            try:
                await conn.send_json(message)
            except Exception:
                self.leave(job_id, conn)

tracker = TrackingManager()

async def _user_from_token(token: Optional[str]):
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    except Exception:
        return None

@api.websocket("/ws/track/{job_id}")
async def ws_track(ws: WebSocket, job_id: str, token: Optional[str] = None):
    await ws.accept()
    user = await _user_from_token(token)
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not user or not job:
        await ws.close(code=4401)
        return
    # only the job's customer or assigned driver may watch
    if user["id"] not in (job.get("customer_id"), job.get("driver_id")):
        await ws.close(code=4403)
        return

    is_driver = user["id"] == job.get("driver_id")
    await tracker.join(job_id, ws)

    # send last known location on connect
    last = job.get("driver_location")
    if last:
        await ws.send_json({"type": "location", **last})
    await ws.send_json({"type": "ready", "role": "driver" if is_driver else "customer"})

    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") == "location" and is_driver:
                lat, lng = data.get("lat"), data.get("lng")
                if lat is None or lng is None:
                    continue
                loc = {
                    "lat": round(float(lat), 6),
                    "lng": round(float(lng), 6),
                    "heading": data.get("heading"),
                    "ts": now_iso(),
                }
                await db.jobs.update_one({"id": job_id}, {"$set": {"driver_location": loc}})
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"driver_profile.current_lat": loc["lat"], "driver_profile.current_lng": loc["lng"]}},
                )
                await tracker.broadcast(job_id, {"type": "location", **loc}, exclude=ws)
    except WebSocketDisconnect:
        tracker.leave(job_id, ws)
    except Exception:
        tracker.leave(job_id, ws)

@api.get("/")
async def root():
    return {"message": "UteRun Townsville API"}

app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
