// Patch: the base seed only gives ValueCare (V3) condition issues, so the four other
// scored vendors sit at condition:100 — unrealistic and off the data.md §4 targets
// (Ridgeline ~88, Gulf Coast ~84, Beacon ~94, Cross County ~90). This inserts a
// calibrated number of extra bad condition_reported(phase:'delivery') events onto
// existing historical delivered orders, one order at a time, oldest HIST orders first.
//
// Idempotent: skips entirely if any condition_reported with payload.patch_marker
// already exists. order_events is append-only — safe to insert, never updates/deletes.
//
// Arithmetic (see report / conversation): conditionScore weights functional .30,
// clean .25, repair .20, defect_swap .15, post_delivery_issues .10. Every scored
// vendor here currently has g=11 dispute-clean "good" condition_reported(delivery)
// reports (12 raw minus 1 dispute_upheld event that scored() drops). Adding k more
// reports with no functional/clean/repair fields (counted as functional:false,
// clean:false, repair fallback 60) moves functional/clean to 100*g/(g+k) and repair
// to (100g+60k)/(g+k), while defect_swap/post_delivery_issues stay 100 (untouched).
// Walking k = 0..10 against that formula gives this closest-to-target table:
//   k=1 -> 95   k=2 -> 91   k=3 -> 87   k=4 -> 83   k=5 -> 81
// So: Ridgeline k=3 (-> 87, target 88), Gulf Coast k=4 (-> 83, target 84),
//     Beacon k=1 (-> 95, target 94), Cross County k=2 (-> 91, target 90).

import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';

try {
  loadEnvFile('.env.local');
} catch (e) {
  console.error(`Could not load .env.local: ${e.message}`);
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PATCH_PLAN = {
  'Ridgeline Medical Supply': 3,
  'Gulf Coast Home Medical': 4,
  'Beacon Respiratory': 1,
  'Cross County Mobility': 2,
};

async function main() {
  const marker = await db
    .from('order_events')
    .select('id')
    .eq('type', 'condition_reported')
    .contains('payload', { patch_marker: true })
    .limit(1)
    .maybeSingle();
  if (marker.error) throw marker.error;
  if (marker.data) {
    console.log('seed-patch-conditions: patch already applied, skipping.');
    return;
  }

  const vendorsRes = await db.from('vendors').select('id,name');
  if (vendorsRes.error) throw vendorsRes.error;

  const rows = [];
  for (const vendor of vendorsRes.data ?? []) {
    const k = PATCH_PLAN[vendor.name];
    if (!k) continue;

    const ordersRes = await db
      .from('orders')
      .select('id,order_no,delivered_at')
      .eq('vendor_id', vendor.id)
      .in('status', ['delivered', 'pickup_triggered', 'picked_up'])
      .like('order_no', 'HIST-%')
      .order('order_no', { ascending: true })
      .limit(k);
    if (ordersRes.error) throw ordersRes.error;
    const orders = ordersRes.data ?? [];
    if (orders.length < k) {
      console.warn(`seed-patch-conditions: ${vendor.name} has only ${orders.length} eligible orders, wanted ${k}.`);
    }

    orders.forEach((order, i) => {
      const rating = i % 2 === 0 ? 'dirty' : 'damaged';
      const basis = order.delivered_at ? new Date(order.delivered_at) : new Date();
      const createdAt = new Date(basis.getTime() + 45 * 60_000).toISOString();
      rows.push({
        order_id: order.id,
        type: 'condition_reported',
        payload: { phase: 'delivery', rating, patch_marker: true },
        actor: 'Synthetic condition patch',
        actor_role: 'system',
        created_at: createdAt,
      });
    });
    console.log(`seed-patch-conditions: queued ${orders.length} patch event(s) for ${vendor.name} (target k=${k}).`);
  }

  if (rows.length === 0) {
    console.log('seed-patch-conditions: nothing to insert.');
    return;
  }
  const inserted = await db.from('order_events').insert(rows);
  if (inserted.error) throw inserted.error;
  console.log(`seed-patch-conditions: inserted ${rows.length} condition_reported patch event(s).`);
}

main().catch((err) => {
  console.error('seed-patch-conditions failed:', err.message ?? err);
  process.exit(1);
});
