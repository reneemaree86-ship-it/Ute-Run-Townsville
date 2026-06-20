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
