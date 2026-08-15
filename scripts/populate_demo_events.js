// scripts/populate_demo_events.js — write demo order_events to data/order_events.json
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'seed.json');
const eventsPath = path.join(__dirname, '..', 'data', 'order_events.json');

function load(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function save(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

const seed = load(dataPath);
const now = new Date().toISOString();
const evs = [];

seed.orders.forEach(o => {
  // order_placed
  evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'order_placed', created_at: now, payload: { order_id: o.order_id, patient_id: o.patient_id, vendor_id: o.vendor_id, hcpcs: o.hcpcs } });
  // vendor_notified
  evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'vendor_notified', created_at: now, payload: { order_id: o.order_id, vendor_id: o.vendor_id } });
  // Vendor confirmed for order-1001, vendor-2 slow for others
  if (o.order_id === 'order-1001') {
    evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'vendor_confirmed', created_at: now, payload: { order_id: o.order_id, vendor_id: o.vendor_id } });
    evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'dispatched', created_at: now, payload: { order_id: o.order_id } });
    evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'in_transit', created_at: now, payload: { order_id: o.order_id } });
  } else if (o.order_id === 'order-1002') {
    // simulate an ETA that misses the target (at-risk)
    const eta = new Date(new Date(o.target_at).getTime() + 6*3600*1000).toISOString();
    evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'eta_updated', created_at: now, payload: { order_id: o.order_id, eta } });
    evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'at_risk_flagged', created_at: now, payload: { order_id: o.order_id, reason: 'ETA misses needed-by by 6h' } });
  } else {
    // no confirmation yet
  }
});

// Add a delivered + condition_reported example
evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'delivered', created_at: now, payload: { order_id: 'order-1001', vendor_id: 'vendor-1' } });
evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'condition_reported', created_at: now, payload: { order_id: 'order-1001', condition: 'dirty' } });

// Add a pickup_requested event to exercise pickup tracker
evs.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'pickup_requested', created_at: now, payload: { order_id: 'order-1003', patient_id: 'patient-1002' } });

save(eventsPath, evs);
console.log('Populated', eventsPath, 'with', evs.length, 'events');
