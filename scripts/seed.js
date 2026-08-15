// scripts/seed.js — idempotent local seed writer for demo
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'data', 'seed.json');

function load() {
  if (fs.existsSync(out)) return JSON.parse(fs.readFileSync(out, 'utf8'));
  return { patients: [], vendors: [], equipment_catalog: [], vendor_prices: [], orders: [], order_events: [], settings: {}, demo_state: {} };
}

function save(data) {
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
}

function id(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2,9);
}

function seed() {
  const data = load();
  if (data.patients && data.patients.length > 0) {
    console.log('Seed already present, skipping.');
    return;
  }

  // Simple synthetic catalog (5 items for speed)
  const catalog = [
    { id: 'hcpcs-E0431', name: 'Oxygen Cylinder', hcpcs: 'E0431', time_critical: true, hazmat: true, image_url: '' },
    { id: 'hcpcs-E1390', name: 'Hospital Bed', hcpcs: 'E1390', time_critical: true, hazmat: false, image_url: '' },
    { id: 'hcpcs-E0601', name: 'Oxygen Concentrator', hcpcs: 'E0601', time_critical: true, hazmat: false, image_url: '' },
    { id: 'hcpcs-A9270', name: 'Oxygen Supplies', hcpcs: 'A9270', time_critical: false, hazmat: false, image_url: '' },
    { id: 'hcpcs-R0892', name: 'Walker', hcpcs: 'R0892', time_critical: false, hazmat: false, image_url: '' }
  ];

  const vendors = [
    { id: 'vendor-1', name: 'Good DME Co', reliability: 0.9, condition: 0.9 },
    { id: 'vendor-2', name: 'SlowButCheap DME', reliability: 0.6, condition: 0.7 },
    { id: 'vendor-3', name: 'Unrated Vendor', reliability: null, condition: null }
  ];

  const patients = [];
  for (let i=0;i<10;i++) {
    patients.push({ id: 'patient-'+(1000+i), name: 'Patient '+(i+1), mrn: 'MRN'+(2000+i), admitted_at: new Date(Date.now()-((20+i)*24*3600*1000)).toISOString() });
  }

  const settings = {
    don_threshold_cents: 50000,
    baseline_notify_lag_h: 26,
    pickup_amber_h: 24,
    pickup_red_h: 48
  };

  data.patients = patients;
  data.vendors = vendors;
  data.equipment_catalog = catalog;
  data.vendor_prices = catalog.flatMap(item => vendors.map(v => ({ vendor_id: v.id, hcpcs: item.hcpcs, price_cents: 30000 })));
  data.orders = [];
  data.order_events = [];
  data.settings = settings;
  data.demo_state = { now: new Date().toISOString() };

  save(data);
  console.log('Seed written to', out);
}

seed();
