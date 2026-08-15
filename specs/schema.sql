-- CANONICAL SCHEMA — Supabase is made to match THIS file (ADR 0005).
-- Source: specs/data.md §1, patched 2026-08-14 late-night (orchestrator-ratified, contracts amendment 11):
--   + order_events.external_id (T10 idempotency)
--   + orders.hospice_account (T10 tenancy)
--   + equipment_catalog.time_critical (T4 high-risk rule)
--   + patients.admitted_at (V8 census-days)
--   + vendors.inventory / pricing_model / service_center_zip / service_radius_miles (N12 onboarding v2)
--   + settings, demo_state tables (V14, V9) — pinned table count now 11

create type order_status  as enum ('ordered','dispatched','in_transit','delivered','pickup_triggered','picked_up');
create type order_urgency as enum ('admission','routine','stat');
create type event_type    as enum (
  'order_placed','approval_requested','approved','denied','vendor_notified','vendor_confirmed',
  'vendor_declined','dispatched','gps_opted_in','eta_updated','at_risk_flagged','at_risk_cleared',
  'escalated','reordered','delivered','condition_reported','patient_status_changed',
  'pickup_requested','pickup_scheduled','picked_up','message_sent','message_received','resupply_due');
-- AT_RISK / PICKUP_DELAYED are derived badges. Never stored.

create table patients (
  id             uuid primary key default gen_random_uuid(),
  external_id    text not null unique,          -- eRx patient identifier, e.g. 'PT-88421'
  med_rec_no     text,
  first_name     text not null,
  last_name      text not null,
  dob            date,
  gender         text,
  phone          text,
  address        jsonb not null default '{}',
  primary_dx     text,
  hospice_name   text not null,
  emr_source     text not null default 'HCHB',
  care_status    text not null default 'active',-- 'active'|'discharge_scheduled'|'deceased'|'discharged'
  admitted_at    timestamptz,                   -- census-days start (V8 DME PPD); seed 20-180d before NOW
  discharge_at   timestamptz,
  status_changed_at timestamptz,                -- death/discharge moment: starts the billing clock
  created_at     timestamptz not null default now()
);

create table vendors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  dispatch_phone text,
  dispatch_email text,
  hours          jsonb not null default '{}',
  open_weekends  boolean not null default false,
  coverage_zips  text[] not null default '{}',
  categories     text[] not null default '{}',
  inventory      jsonb not null default '{}',   -- {hcpcs: qty} from onboarding v2
  pricing_model  text not null default 'per_item_day', -- 'per_item_day'|'per_patient_day'
  service_center_zip text,
  service_radius_miles integer,
  hazmat_certified boolean not null default false,
  status         text not null default 'active',-- 'active'|'invited'|'paused'
  notes          text,
  created_at     timestamptz not null default now()
);

create table equipment_catalog (
  hcpcs          text primary key,
  plain_name     text not null,
  category       text not null,
  serialized     boolean not null default true,
  hazmat         boolean not null default false,
  time_critical  boolean not null default false, -- true for E1390,E0431,E0601,E0470,E0600 (engine §2.1)
  resupply_interval_days int,
  two_person     boolean not null default false,
  image_url      text
);

create table vendor_prices (
  vendor_id      uuid not null references vendors(id) on delete cascade,
  hcpcs          text not null references equipment_catalog(hcpcs),
  price_cents    integer not null,              -- MONTHLY rental price; daily rate = price_cents/30 [assumed]
  in_stock       boolean not null default true,
  lead_time_hours integer not null default 24,
  primary key (vendor_id, hcpcs)
);

create table orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text not null unique,
  patient_id     uuid not null references patients(id),
  vendor_id      uuid references vendors(id),
  hospice_account text not null default 'ACCT-001', -- from eRx account.identifiers (single-tenant demo)
  status         order_status not null default 'ordered',
  urgency        order_urgency not null,
  items          jsonb not null,
  price_cents    integer,
  ordered_at     timestamptz not null default now(),
  target_at      timestamptz,
  promised_eta   timestamptz,
  current_eta    timestamptz,
  delivered_at   timestamptz,
  pickup_requested_at timestamptz,
  pickup_scheduled_at timestamptz,
  picked_up_at   timestamptz,
  ordered_by     text,
  ordered_by_role text,
  created_at     timestamptz not null default now()
);

create table order_events (                     -- APPEND ONLY. The heart.
  id             bigint generated always as identity primary key,
  order_id       uuid not null references orders(id) on delete cascade,
  type           event_type not null,
  payload        jsonb not null default '{}',
  external_id    text unique,                   -- source event id for ingested events; replay = no-op
  actor          text,
  actor_role     text,
  created_at     timestamptz not null default now()
);

create or replace function order_events_append_only() returns trigger as $$
begin raise exception 'order_events is append-only'; end $$ language plpgsql;
create trigger order_events_no_mutate before update or delete on order_events
  for each row execute function order_events_append_only();

create table messages (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  vendor_id      uuid references vendors(id),
  direction      text not null,
  channel        text not null default 'sms',   -- 'sms' (Twilio) | 'email' (Resend fallback)
  to_addr        text,
  body           text not null,
  parsed         jsonb,
  created_at     timestamptz not null default now()
);

create table resupply_schedules (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references patients(id) on delete cascade,
  hcpcs          text not null references equipment_catalog(hcpcs),
  interval_days  integer not null,
  last_delivered_at timestamptz,
  next_due_at    timestamptz not null,
  is_swap        boolean not null default false,
  active         boolean not null default true
);

create table magic_links (
  token          text primary key,
  vendor_id      uuid not null references vendors(id) on delete cascade,
  scope          text not null,                 -- 'run_list'|'onboarding'|'report_card'|'stop' (canonical set)
  order_id       uuid references orders(id),
  expires_at     timestamptz,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table settings (                          -- V14 guardrails; T4/T5/N9 READ these, never hardcode
  key            text primary key,               -- don_threshold_cents, lead_time_hours, silence_minutes,
  value          jsonb not null                  -- pickup_amber_h, pickup_red_h, baseline_notify_lag_h
);

create table demo_state (                        -- V9 virtual clock
  id             int primary key default 1,
  clock_offset_seconds int not null default 0,
  seeded_at      timestamptz
);

create index on orders (status); create index on orders (patient_id);
create index on orders (vendor_id); create index on orders (target_at);
create index on order_events (order_id, created_at); create index on order_events (type);
create index on messages (order_id, created_at); create index on magic_links (vendor_id);
create index on resupply_schedules (next_due_at) where active;
