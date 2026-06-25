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

## Implemented — Google Maps + Resend Email (2026-06-21)
- **Google Maps live tracking**: `react-native-maps` (Google provider) replaces MockMap on native.
  New `src/components/LiveMap.native.tsx` (real map, pickup/dropoff/driver/job/me markers, fitToCoordinates)
  and `src/components/LiveMap.web.tsx` (reuses styled MockMap so web preview keeps working). Used in
  `app/(tabs)/index.tsx` (driver feed) and `app/job/[id].tsx`. API key in app.json under
  `android.config.googleMaps.apiKey` + `ios.config.googleMapsApiKey`, bundleIdentifier/package set to
  `com.uterun.townsville`. NOTE: Google Maps only renders in a native build (dev/prod), NOT Expo Go web preview.
- **Resend transactional email** (backend `emailer.py`, gated on RESEND_API_KEY — no-op until set):
  welcome on signup, job receipt to customer on payment verify, earnings/payout note to driver on job
  completion. Sent via FastAPI BackgroundTasks. Env: RESEND_API_KEY, RESEND_FROM in backend/.env.

## Implemented — Real-time Tracking + Play Store prep (2026-06-25)
- **Real-time driver tracking (WebSocket)**: `/api/ws/track/{job_id}?token=JWT` (TrackingManager broadcasts
  per job). Driver streams GPS via `useDriverLocationStream` (expo-location, full permission contract) →
  customer sees the ute move live on the map. `useJobTracking` hook + LIVE badge + "Share your live location"
  driver banner in `app/job/[id].tsx`. Driver location persisted on job doc. Close codes 4401(auth)/4403(forbidden)
  delivered correctly (accept-before-close fix). Backend 38/38 pytest pass.
- **Google Play Store prep**: app name "Quick Ute Run", android versionCode 1 / iOS buildNumber 1,
  package com.uterun.townsville, scheme "uterun". Android perms: READ_MEDIA_IMAGES, ACCESS_FINE/COARSE_LOCATION,
  INTERNET. expo-location plugin + iOS NSLocationWhenInUseUsageDescription + ITSAppUsesNonExemptEncryption=false.
  Build/submit via Emergent Publish button. Still needed by user: hosted privacy policy URL + Play Console Data Safety form.
- Fixed backend FRONTEND_URL to current preview host.

## Implemented — Ratings & Reviews summary (2026-06-25)
- Backend `GET /api/users/{uid}/reviews` → {rating, num_ratings, verified, ute_type, breakdown(1-5), reviews[]}
  (reviews join reviewer names from db.ratings; rating submission already existed via /jobs/{id}/rate).
- Frontend: reusable `ReviewsSection` (big score + 5-star breakdown bars + review cards with reviewer/date),
  shown on Profile tab (own reviews) and a new `app/driver/[id].tsx` driver profile screen. Job detail driver
  card is now tappable ("View reviews") → driver profile. Verified E2E: rate→aggregate→breakdown→review display.

## Implemented — Driver reputation surfacing + sort (2026-06-25)
- Verified-drivers cards (customer home) now show review count next to stars ("New" if none) and are
  tappable → driver review profile. Added "Top rated" / "Most reviews" sort chips (client-side sort by
  rating then num_ratings, or vice-versa). Files: `app/(tabs)/index.tsx`.

## Next Tasks
1. ~~Wire real Stripe payments + Connect (needs user keys).~~ DONE — Connect Express driver payouts live.
2. Replace MockMap with react-native-maps + live driver location over WebSocket (user has Google Maps key).
3. Build admin dashboard + real driver verification workflow.

## Implemented — Stripe Connect Driver Payouts (2026-06-21)
- **Stripe Connect Express** onboarding for drivers (test mode). Backend endpoints
  `/api/driver/connect/onboarding-link` (creates AU Express account + AccountLink) and
  `/api/driver/connect/status` (returns connected/details_submitted/charges_enabled/payouts_enabled).
- Frontend: Earnings tab (driver) shows a Connect-aware payout card — "Set up payouts" → opens
  Stripe onboarding via expo-web-browser (web: full-page redirect), then `connect-return` screen
  refreshes status. States: not connected / pending (finish setup) / payouts enabled.
- Files: `src/utils/connect.ts`, `app/connect-return.tsx`, `app/(tabs)/earnings.tsx`, `src/api/client.ts`.
- Verified: backend onboarding-link returns real connect.stripe.com URL; status transitions
  to connected:true after account creation; frontend card renders correctly.
