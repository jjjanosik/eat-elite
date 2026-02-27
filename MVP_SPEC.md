# Food Quality & Risk App — MVP Technical Implementation Plan
Owner: JJ  
Stack: Expo React Native + Supabase (Auth + Postgres + Edge Functions)  
Phase 2: RevenueCat + Apple/Google IAP

---

# High-Level Architecture

Client (Expo RN)
- Supabase Auth (email/password or magic link — no email verification required)
- Barcode scanning (Expo Camera)
- Calls backend (Supabase Edge Functions)
- No secrets stored on client

Backend (Supabase)
- Postgres DB
- Supabase Auth (users required in Phase 1)
- Edge Functions:
  - `/scan`
  - `/profile`
  - `/weights`
  - `/history`
  - `/entitlement-check` (Phase 2)
- Stores:
  - Cached Open Food Facts product data
  - User goals + weights
  - Scan history
  - AI explanations

External APIs
- Open Food Facts (product data)
- Grok (AI explanation)
- Phase 2: RevenueCat (entitlements only, not payments)

---

# Phase 1 — Full App Without Real Subscriptions

## Phase 1 Goals

- Complete onboarding flow before account creation
- Require account creation (Supabase Auth) before paywall access
- Fake paywall (click to continue)
- Scan → OFF → score → AI → save history
- Goals editing
- Settings page
- Rate limiting
- Observability basics

No RevenueCat yet.

---

# Authentication Model (Phase 1)

- Use Supabase Auth.
- Users complete onboarding questions first, then create account before paywall.
- No email verification required.
- After login, user has:
  - `auth.users.id` (UUID)
  - This UUID is your canonical `user_id`.

All app data references `user_id`.

---

# Navigation Structure

## Onboarding Flow (Stack)

1. Intro
2. Sex selection
3. Birthdate
4. Diet type
5. Diet goals (checkboxes)
6. Outcomes (checkboxes)
7. Scoring explanation screen
8. Notification permission
9. Account Creation / Login (required)
10. Fake Paywall
   - Monthly / Annual cards
   - Clicking either sets `is_unlocked=true` in local state and continues

Then → Main App Tabs

## Bottom Tabs

- Scan
- History
- Goals

Settings accessed via gear icon in History header.

---

# Database Schema (Phase 1)

All tables use `auth.users.id` as `user_id`.

---

## Table: user_profiles

- user_id uuid PK references auth.users(id) on delete cascade
- sex text check ('male','female','other')
- birthdate date
- diet_type text check ('classic','vegetarian','vegan','pescetarian')
- diet_goals jsonb default '[]'
- outcomes jsonb default '[]'
- notifications_enabled boolean default false
- created_at timestamptz default now()
- updated_at timestamptz default now()

---

## Table: user_score_weights

- id uuid PK default gen_random_uuid()
- user_id uuid references auth.users(id) on delete cascade
- score_version int not null default 1
- weights_version int not null default 1
- nutrition_weight int not null
- additives_weight int not null
- nutrition_subweights jsonb default '{}'
- additives_subweights jsonb default '{}'
- created_at timestamptz default now()

Constraint:
nutrition_weight + additives_weight = 100

---

## Table: products

- barcode text primary key
- name text
- brands text
- image_url text
- ingredients_text text
- additives_tags jsonb default '[]'
- nutriments jsonb default '{}'
- off_payload jsonb default '{}'
- source text default 'OFF'
- source_last_fetched_at timestamptz
- created_at timestamptz default now()
- updated_at timestamptz default now()

---

## Table: scan_history

- id uuid PK default gen_random_uuid()
- user_id uuid references auth.users(id) on delete cascade
- barcode text references products(barcode)
- score int not null
- score_version int not null
- weights_version int not null
- inputs_snapshot jsonb not null
- ai_model text default 'grok'
- ai_response text
- ai_cached boolean default false
- created_at timestamptz default now()

---

# Backend Endpoints (Phase 1)

All endpoints require Supabase JWT.

---

## POST /api/profile

Save onboarding profile data.

---

## POST /api/weights

Update scoring weights.

---

## POST /api/scan

Body:
{
  "barcode": "0123456789012"
}

Server Flow:

1. Authenticate user via JWT.
2. Check products table:
   - If cached and fresh (<30 days) → use cached.
   - Else → fetch from Open Food Facts and upsert.
3. Fetch user's weights.
4. Compute score (version 1).
5. Build AI prompt:
   - User goals
   - Diet type
   - Key nutriments
   - Additive count
6. Call Grok.
7. Insert scan_history row.
8. Return:
   - product
   - score
   - ai_response
   - history_id

---

## GET /api/history

Return recent scan_history rows ordered by created_at desc.

---

## POST /api/history/regenerate

Regenerate AI explanation (rate limited).

---

# Scoring System (Version 1)

Total Score = weighted average of:

Nutrition Score (0–100)
Additives Score (0–100)

Stored with:
- score_version = 1
- weights_version (user-specific)

History always stores:
- inputs_snapshot (so score never changes retroactively)

---

# Rate Limiting (Phase 1)

Server-side enforcement:

- Max 50 AI regenerations per hour per user
- Max 1000 scans per month per user

Implementation:
- usage_counters table keyed by user_id + time bucket
OR
- lightweight in-memory limiter if using separate server

---

# Settings Page (Phase 1)

Sections:

1. Account
   - Show email
2. Subscription
   - “Testing Mode — Not Active”
3. Disclaimers
   - Informational only, not medical advice
4. Licenses & References
   - Open Food Facts attribution
5. Data Controls
   - Delete account (real DB deletion)
   - Clear local cache

---

# Phase 2 — Add Real Subscriptions

Now we integrate:

- RevenueCat
- Apple IAP
- Google Play Billing

---

# Phase 2 Architecture

Supabase Auth user_id remains primary identity.

RevenueCat `app_user_id` = Supabase `user_id`.

This keeps entitlements tied directly to account.

---

# New Tables (Phase 2)

## entitlements

- id uuid PK
- user_id uuid references auth.users(id)
- provider text default 'revenuecat'
- entitlement_id text
- status text (active, expired, grace, revoked)
- expires_at timestamptz
- last_event_at timestamptz
- raw_event jsonb
- created_at timestamptz default now()

Unique(user_id, provider, entitlement_id)

---

## subscription_events (optional but recommended)

- id uuid PK
- user_id uuid
- event_type text
- event_time timestamptz
- payload jsonb
- created_at timestamptz

---

# RevenueCat Integration Plan

## Client

1. User logs in (required).
2. On app start:
   - Set RevenueCat app_user_id = Supabase user_id.
3. Replace fake paywall with:
   - Fetch offerings
   - Purchase package
   - Restore purchases button

---

## Restore Flow

User must be logged in (since accounts are required).

Restore steps:
1. Tap Restore
2. RevenueCat restore
3. App confirms entitlement active
4. Backend webhook updates entitlements table

Unlock features.

---

# Backend Entitlement Enforcement (Phase 2)

Protected endpoints:
- /api/scan
- /api/history/regenerate

Before processing:
- Query entitlements table
- Require status = active or grace
- Require expires_at > now()

If not active:
- Return 402 / subscription_required error

---

# Phase 2 Gating Model

If no active entitlement:
- Show paywall
- Block scanning
- Allow viewing previous history (optional decision)

---

# Observability

Log per scan:
- OFF hit/miss
- OFF latency
- AI latency
- Total processing time
- Errors

Add basic error reporting (Sentry or similar).

---

# Build Order

## Phase 1

1. Supabase project + Auth
2. DB schema
3. Onboarding + Auth UI
4. Fake paywall
5. Barcode scanner
6. /api/scan pipeline
7. History UI
8. Goals UI
9. Settings page
10. Rate limiting
11. Logging

## Phase 2

1. Configure App Store Connect + Play Console
2. Create IAP products
3. Setup RevenueCat
4. Add paywall integration
5. Add webhook endpoint
6. Implement entitlements table
7. Gate protected endpoints
8. Restore purchase testing (delete/reinstall test)

---

# Acceptance Criteria

## Phase 1

- User can complete onboarding questions before account creation.
- User must create account before seeing paywall options.
- User can continue via fake paywall after account creation.
- Scanning stores score + AI explanation.
- History persists per account.
- Goals editable and affect score.

## Phase 2

- Purchase unlocks features.
- Restore works after reinstall.
- Backend rejects scan without active entitlement.
- Subscription status visible in settings.

---

# Final Architecture Summary

Identity:
Supabase Auth user_id

Payments:
Phase 1 → none  
Phase 2 → Apple/Google via RevenueCat

Product data:
Open Food Facts cached in Postgres

AI:
Grok called server-side only

Security:
Backend enforces entitlements
No trust in client flags

Scoring:
Versioned and stored per history item
