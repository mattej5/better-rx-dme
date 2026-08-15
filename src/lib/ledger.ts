// src/lib/ledger.ts — simple asset ledger aggregation for a vendor
import fs from 'fs';
import path from 'path';

const DATA = path.join(process.cwd(), 'data');
const EVENTS = path.join(DATA, 'order_events.json');

function load(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; }

export function vendorLedger(vendorId: string) {
  const events = load(EVENTS);
  const outFor = events.filter(e => e.type === 'dispatched' && e.payload && e.payload.vendor_id === vendorId).length;
  const delivered = events.filter(e => e.type === 'delivered' && e.payload && e.payload.vendor_id === vendorId).length;
  const pickedUp = events.filter(e => e.type === 'picked_up' && e.payload && e.payload.vendor_id === vendorId).length;
  const dueBack = Math.max(0, outFor - pickedUp);
  // Overdue: delivered but not picked up and created_at > pickup_red_h? (simplified)
  const overdue = events.filter(e => e.type === 'pickup_requested' && e.payload && e.payload.vendor_id === vendorId && e.payload.elapsed_hours && e.payload.elapsed_hours > 48).length;

  return { vendor_id: vendorId, out_for_delivery: outFor, delivered, picked_up: pickedUp, due_back: dueBack, overdue };
}
