from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
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

# ---------------- Models ----------------
class SignupIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: Literal["customer", "driver"] = "customer"

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
    dispatch_mode: Literal["instant", "offers"] = "instant"

class StatusIn(BaseModel):
    status: Literal["picked_up", "delivered", "completed", "cancelled"]

class MessageIn(BaseModel):
    text: str

class RateIn(BaseModel):
    stars: int
    review: Optional[str] = ""

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
        "avatar": u.get("avatar"),
        "rating": u.get("rating", 0),
        "num_ratings": u.get("num_ratings", 0),
        "driver_profile": u.get("driver_profile"),
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

# ---------------- Auth ----------------
@api.post("/auth/signup")
async def signup(body: SignupIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "full_name": body.full_name,
        "phone": body.phone,
        "phone_verified": False,
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

@api.patch("/auth/role")
async def switch_role(body: RoleIn, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_role": body.role}})
    user["active_role"] = body.role
    return public_user(user)

@api.post("/auth/request-otp")
async def request_otp(body: OTPIn):
    await db.otps.update_one(
        {"phone": body.phone},
        {"$set": {"code": "123456", "created_at": now_iso()}},
        upsert=True,
    )
    logger.info(f"[MOCK OTP] {body.phone} -> 123456")
    return {"message": "OTP sent", "dev_hint": "123456"}

@api.post("/auth/verify-otp")
async def verify_otp(body: OTPVerifyIn):
    rec = await db.otps.find_one({"phone": body.phone})
    if not rec or rec.get("code") != body.code:
        raise HTTPException(status_code=400, detail="Invalid code")
    await db.users.update_one({"phone": body.phone}, {"$set": {"phone_verified": True}})
    return {"message": "Phone verified"}

# ---------------- Driver ----------------
@api.post("/driver/profile")
async def submit_driver_profile(body: DriverProfileIn, user=Depends(get_current_user)):
    profile = {
        **body.dict(),
        # v1: admin dashboard (Phase 5) not built yet, so auto-approve on submit
        # so drivers can transact end-to-end in the demo.
        "verification_status": "approved",
        "available": True,
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
    cur = db.jobs.find({"status": "open"}, {"_id": 0}).sort("created_at", -1).limit(50)
    jobs = [j async for j in cur]
    dp = user.get("driver_profile") or {}
    dlat = dp.get("current_lat", TSV["lat"])
    dlng = dp.get("current_lng", TSV["lng"])
    for j in jobs:
        j["driver_distance_km"] = round(haversine(dlat, dlng, j["pickup_lat"], j["pickup_lng"]), 1)
    jobs.sort(key=lambda x: x["driver_distance_km"])
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
    await db.jobs.update_one({"id": jid}, {"$set": {
        "status": "accepted",
        "driver_id": user["id"],
        "driver_name": user["full_name"],
        "driver_avatar": user.get("avatar"),
        "driver_profile_snapshot": {
            "ute_type": dp.get("ute_type"),
            "rating": user.get("rating", 5),
            "ute_photos": dp.get("ute_photos", []),
        },
        "accepted_at": now_iso(),
    }})
    return await db.jobs.find_one({"id": jid}, {"_id": 0})

@api.post("/jobs/{jid}/status")
async def update_status(jid: str, body: StatusIn, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    upd = {"status": body.status}
    if body.status == "completed":
        upd["completed_at"] = now_iso()
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

# ---------------- Seed ----------------
SEED_DRIVERS = [
    {"name": "Mick Donovan", "ute": "Toyota HiLux", "rating": 4.9, "n": 132,
     "avatar": "https://images.pexels.com/photos/17377416/pexels-photo-17377416.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=300&w=300",
     "ute_photo": "https://images.unsplash.com/photo-1686507445019-e4939c9de8c4?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"},
    {"name": "Sara Whitlock", "ute": "Ford Ranger", "rating": 4.8, "n": 88,
     "avatar": "https://images.pexels.com/photos/1languages.jpg",
     "ute_photo": "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"},
    {"name": "Jacko Reilly", "ute": "Isuzu D-Max", "rating": 5.0, "n": 54,
     "avatar": "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=300&w=300",
     "ute_photo": "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"},
    {"name": "Tara Nguyen", "ute": "Mazda BT-50", "rating": 4.7, "n": 41,
     "avatar": "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=300&w=300",
     "ute_photo": "https://images.unsplash.com/photo-1612825173281-9a193378527e?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"},
]

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.jobs.create_index("id")
    # seed demo verified drivers
    for i, d in enumerate(SEED_DRIVERS):
        email = f"driver{i+1}@uterun.demo"
        if await db.users.find_one({"email": email}):
            continue
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid, "email": email, "full_name": d["name"],
            "phone": f"+6147000000{i}", "phone_verified": True,
            "password_hash": pwd_context.hash("Password123!"),
            "role": "driver", "active_role": "driver",
            "avatar": d["avatar"], "rating": d["rating"], "num_ratings": d["n"],
            "driver_profile": {
                "license_no": f"QLD{10000+i}", "rego": f"ABC{100+i}", "insurance": "Allianz",
                "ute_type": d["ute"], "abn": None, "ute_photos": [d["ute_photo"]],
                "verification_status": "approved", "available": True,
                "current_lat": TSV["lat"] + (i * 0.012 - 0.02), "current_lng": TSV["lng"] + (i * 0.01 - 0.015),
                "submitted_at": now_iso(),
            },
            "created_at": now_iso(),
        })
    logger.info("Seed complete")

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
