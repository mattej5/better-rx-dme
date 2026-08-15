-- Demo reset. Run in the Supabase SQL editor (TRUNCATE bypasses the row-level
-- append-only trigger on order_events; supabase-js cannot run this).
-- Then locally: npm run seed && node scripts/seed-patch-conditions.mjs
-- Re-seeding re-anchors every timestamp to now, so DME-10305 goes back to
-- "flags a few minutes after a clock advance" for the on-stage moment.
truncate table
  order_events, messages, resupply_schedules, magic_links,
  vendor_prices, orders, patients, vendors, equipment_catalog,
  settings, demo_state
restart identity cascade;
