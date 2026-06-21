# UteRun Townsville — PRD & Build Log

## Original Problem Statement
A single mobile app (React Native + Expo, FastAPI, MongoDB) connecting people needing same-day
pickups/deliveries/moves/tip-runs with trusted local ute owners in Townsville, AU. One account,
toggle between Customer and Driver modes. Full feature set spans auth/OTP, job posting + fare
estimate + matching, live tracking + chat, Stripe payments + Connect payouts, ratings, push
notifications, admin web dashboard, object storage. Warm orange/charcoal "Aussie-local" design.

## v1 Scope (user chose option "A")
Customer flow end-to-end + basic Driver mode. JWT email/password auth (OTP MOCKED, code 123456).
Mock fare/payments + styled mock map. Platform-fixed AUD pricing. Stated design direction approved.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), all routes under `/api`, MongoDB via motor,
  uuid string ids (no raw ObjectId returned), JWT (HS256) auth, bcrypt password hashing.
- Frontend: Expo Router file-based routing. AuthContext + secure token storage. Fredoka/Nunito
  fonts via expo-font. Design tokens in `src/theme`. Styled MockMap component (no native maps).
- Role-aware bottom tabs (Home/Jobs/Chat/Earnings|Payments/Profile) switch by `active_role`.

## User Personas
- Customer: locals needing items moved/delivered/junk removed.
- Driver: Townsville ute owners earning flexible income.
- Admin (future): verify drivers, monitor jobs, disputes.

## Implemented (2026-06-20)
- Auth: signup (role select), login, /me, JWT persistence, mock OTP (123456), role toggle.
- Customer: photo-first multi-step Post-a-Job (type, desc, photos, suburb chips, load size, time,
  dispatch mode), live AUD fare estimate (base + per-km + load multiplier + 12% fee), instant
  dispatch auto-matches nearest seed driver, Home with job tiles + verified-drivers carousel +
  active job card.
- Driver: map-centric job feed with availability toggle, accept job, advance status
  (picked_up→delivered→completed), auto-approved onboarding (license/rego/insurance/ute/ABN/photos),
  earnings dashboard (today/week/month + weekly chart).
- Shared: job detail/tracking (status tracker, route, driver card, rating modal), in-app chat
  (polling) + conversations list, jobs list with filter chips, payments view, profile + logout.
- 4 seeded verified demo drivers. expo-image-picker with full permission handling.

## Implemented — Update (2026-06-21)
- **Removed all seed/test drivers** and wiped the database for a clean slate (no fake data on startup).
- **Twilio SMS OTP (real)**: signup now sends a real 6-digit code via Twilio Messages API (from
  +61481611929) and requires verification before account creation; 2-step OTP UI on the auth screen.
  Backend: `request-otp` (generate+send, 10-min expiry), `verify-otp`, OTP enforced in `signup`.
  Env: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER.
- **Subscription services** (from updated blueprint):
  - Customer "Business" plans: Starter $49/$499 (10% off, 5 jobs/mo), Pro $99/$999 (20% off,
    unlimited), Enterprise $199/$1999 (25% off, API). Discount auto-applied to new job fares.
  - Driver "Premium" memberships: Basic $19/$199 (5% commission cut), Pro $39/$399 (8% cut, top
    placement), Fleet $79/$799 per ute. Commission reduction boosts driver_earnings on accept.
  - New screen `app/subscription.tsx` (monthly/annual toggle, plan cards, subscribe/cancel),
    Profile upsell card. Endpoints: `/plans`, `/subscription`, `/subscription/subscribe`, `/cancel`.
  - Billing is MOCK (activates plan immediately) until Stripe keys are connected.
- Demo accounts (since OTP gates signup): demo@uterun.com (customer), demodriver@uterun.com (driver).

## Implemented — Stripe Payments (2026-06-21)
- **Stripe Checkout** connected (test mode) for BOTH: customer subscriptions and job-fare payments.
  Works on web (full-page redirect) and native/Expo Go (in-app browser + session verify) — no native build needed.
- Endpoints: `/payments/create-subscription-checkout`, `/payments/create-job-checkout`,
  `/payments/verify/{session_id}`, `/payments/config`. Subscriptions/job payments activate on verify.
- Subscription screen now routes through real Stripe; job detail shows a "Pay $X" button for the
  customer on delivered/completed unpaid jobs. Verified end-to-end with test card 4242.
- IMPORTANT FIX: checkout return URL is taken from the client's `window.location.origin`
  (`return_base`) so the post-payment redirect lands on the same public origin holding the JWT.
- Stripe Connect driver payouts and native PaymentSheet are future enhancements.

## Testing
- Backend: 17/17 pytest passing (`/app/backend/tests/test_uterun_backend.py`).
- Frontend: testing agent verified auth, home, role toggle, driver map, earnings, jobs, post-job.
- All E2E curl flows pass (instant match, accept, status, earnings, messages).

## Backlog (prioritized)
- P0: none blocking.
- P1: Real Stripe + Stripe Connect payouts; real Google/Mapbox maps + live GPS tracking;
  WebSocket realtime tracking; Twilio SMS OTP; Expo push notifications.
- P2: Admin web dashboard (approve drivers, disputes, refunds, pricing rules); surge pricing;
  driver-set rates; offers/bidding UI; object storage for ID docs; scheduled jobs.

## Next Tasks
1. Wire real Stripe payments + Connect (needs user keys).
2. Replace MockMap with react-native-maps + live driver location over WebSocket.
3. Build admin dashboard + real driver verification workflow.
