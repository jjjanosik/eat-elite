# Eat Elite - Phase 1 MVP

Expo React Native + Supabase implementation for Phase 1 of the food scan app in `MVP_SPEC.md`.

## What is implemented

- Onboarding flow before account creation (sex, birthdate, diet type, goals, outcomes, scoring explanation, notification permission)
- Fake paywall unlock stored in local state/cache per app install
- Account creation/login (Supabase Auth) after onboarding and before paywall
- Main tabs: Scan, History, Goals
- Settings page with account info, disclaimer, OFF attribution, clear local cache, and delete account
- Barcode scan pipeline:
  - Pull product from `products` cache if fresh (<30 days)
  - Otherwise fetch from Open Food Facts and upsert cache
  - Compute score (v1): nutrition + additives weighted average
  - Generate AI explanation via Grok (or fallback if no API key)
  - Persist history with `inputs_snapshot`
- Rate limiting:
  - 1000 scans/month/user
  - 50 regenerations/hour/user
- Basic backend observability logs for OFF/AI/total latency

## Project structure

- `app/` Expo Router screens
- `src/` shared client code (Supabase client, app state, API wrappers)
- `supabase/migrations/` Postgres schema + RLS + limiter function
- `supabase/functions/` Edge functions

## Environment

Create `.env` from `.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Set Edge Function secrets in Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for delete-account)
- `XAI_API_KEY` (optional but recommended)
- `XAI_MODEL` (optional, defaults to `grok-2-latest`)

## Local run

1. Install dependencies:

```bash
npm install
```

2. Start Expo app:

```bash
npm run start
```

3. Start Supabase locally (optional):

```bash
supabase start
supabase db reset
supabase functions serve
```

## Deploy database and functions

```bash
supabase db push
supabase functions deploy profile
supabase functions deploy weights
supabase functions deploy scan
supabase functions deploy history
supabase functions deploy history-item
supabase functions deploy history-delete
supabase functions deploy history-regenerate
supabase functions deploy bootstrap-user
supabase functions deploy delete-account
```

## API function mapping

Supabase function name -> Spec endpoint

- `profile` -> `POST /api/profile`
- `weights` -> `POST /api/weights`
- `scan` -> `POST /api/scan`
- `history` -> `POST /api/history`
- `history-item` -> `POST /api/history/item`
- `history-delete` -> `POST /api/history/delete`
- `history-regenerate` -> `POST /api/history/regenerate`
- `bootstrap-user` -> post-auth profile/weights bootstrap + onboarding sync
- `delete-account` -> settings data control action

## Notes

- Phase 1 intentionally uses a fake paywall and does not include RevenueCat.
- Entitlement enforcement for paid access is deferred to Phase 2.
# eat-elite
