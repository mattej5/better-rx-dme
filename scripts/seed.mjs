import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';

const RESET_SQL = `TRUNCATE TABLE order_events, messages, magic_links,
resupply_schedules, orders, vendor_prices, patients, vendors,
equipment_catalog, settings, demo_state RESTART IDENTITY CASCADE;`;

try { loadEnvFile('.env.local'); } catch (e) {
  console.error(`Could not load .env.local: ${e.message}`); process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.'); process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const resetRequested = process.argv.includes('--reset') || process.argv.includes('--force');
const now = new Date();
const iso = (d) => d.toISOString();
const plus = (base = now, { d = 0, h = 0, m = 0 } = {}) =>
  new Date(base.getTime() + (((d * 24 + h) * 60 + m) * 60_000));
const localHour = (daysAhead, hour) => {
  const d = new Date(now); d.setDate(d.getDate() + daysAhead); d.setHours(hour, 0, 0, 0); return d;
};
const die = (label, error) => { throw new Error(`${label}: ${error.message}${error.details ? ` (${error.details})` : ''}`); };
async function insert(table, rows) {
  if (!rows.length) return;
  const { error } = await db.from(table).insert(rows);
  if (error) die(`insert ${table}`, error);
}
async function batches(table, rows, size = 250) {
  for (let i = 0; i < rows.length; i += size) await insert(table, rows.slice(i, i + size));
}

// [hcpcs, name, category, serialized, hazmat, timeCritical, resupplyDays, twoPerson]
const catalog = [
  ['E0260', 'Hospital bed (semi-electric)', 'bed', 1, 0, 0, null, 0],
  ['E0250', 'Hospital bed (fixed height)', 'bed', 1, 0, 0, null, 0],
  ['E0184', 'Pressure-relief mattress (foam overlay)', 'bed', 1, 0, 0, null, 0],
  ['E0277', 'Alternating-pressure / low-air-loss mattress', 'bed', 1, 0, 0, null, 0],
  ['E0310', 'Bed rails', 'bed', 1, 0, 0, null, 0],
  ['E0910', 'Trapeze bar', 'bed', 1, 0, 0, null, 0],
  ['E0274', 'Overbed table', 'bed', 1, 0, 0, null, 0],
  ['E1390', 'Oxygen concentrator', 'respiratory', 1, 0, 1, null, 0],
  ['E0431', 'Portable oxygen (gas cylinder)', 'respiratory', 1, 1, 1, 14, 0],
  ['E0601', 'CPAP', 'respiratory', 1, 0, 1, null, 0],
  ['E0470', 'BiPAP / RAD', 'respiratory', 1, 0, 1, null, 0],
  ['E0570', 'Nebulizer', 'respiratory', 1, 0, 0, null, 0],
  ['E0600', 'Suction machine', 'respiratory', 1, 0, 1, null, 0],
  ['E1130', 'Standard wheelchair', 'mobility', 1, 0, 0, null, 0],
  ['E1038', 'Transport chair', 'mobility', 1, 0, 0, null, 0],
  ['E2601', 'Wheelchair cushion', 'mobility', 1, 0, 0, null, 0],
  ['E0143', 'Folding wheeled walker', 'mobility', 1, 0, 0, null, 0],
  ['E0100', 'Cane', 'mobility', 1, 0, 0, null, 0],
  ['E0630', 'Patient lift (Hoyer) + sling', 'transfer', 1, 0, 0, null, 1],
  ['E0163', 'Bedside commode', 'transfer', 1, 0, 0, null, 0],
  ['E0240', 'Shower / bath chair', 'transfer', 1, 0, 0, null, 0],
  ['A4615', 'Oxygen tubing and cannula kit', 'consumable', 0, 0, 0, 30, 0],
  ['A6216', 'Wound dressing supplies', 'consumable', 0, 0, 0, 7, 0],
  ['T4527', 'Incontinence briefs and underpads', 'consumable', 0, 0, 0, 14, 0],
  ['A4353', 'Foley catheter kit and drainage bag', 'consumable', 0, 0, 0, 30, 0],
  ['A4406', 'Ostomy supplies', 'consumable', 0, 0, 0, 30, 0],
].map(([hcpcs, plain_name, category, serialized, hazmat, time_critical, resupply_interval_days, two_person]) => ({
  hcpcs, plain_name, category, serialized: !!serialized, hazmat: !!hazmat,
  time_critical: !!time_critical, resupply_interval_days, two_person: !!two_person, image_url: null,
}));
const catalogByCode = new Map(catalog.map((x) => [x.hcpcs, x]));
const item = (hcpcs, qty = 1) => ({ hcpcs, plain_name: catalogByCode.get(hcpcs).plain_name, qty });

const weekdays = { mon: ['08:00', '17:00'], tue: ['08:00', '17:00'], wed: ['08:00', '17:00'], thu: ['08:00', '17:00'], fri: ['08:00', '17:00'], sat: null, sun: null };
const always = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((x) => [x, ['00:00', '23:59']]));
const all = ['bed', 'respiratory', 'mobility', 'transfer', 'consumable'];
const vendorDefinitions = [
  ['V1', 'Ridgeline Medical Supply', all, always, true, true, 'active', 1, 0, '80014', 55, 'Synthetic dependable default vendor.'],
  ['V2', 'Gulf Coast Home Medical', ['bed', 'respiratory', 'mobility', 'transfer'], always, true, true, 'active', 1.20, -4, '80111', 50, 'Synthetic fast STAT/oxygen vendor with optimistic ETAs.'],
  ['V3', 'ValueCare DME', all, weekdays, false, false, 'active', .76, 14, '80012', 25, 'Synthetic cheapest, deliberately poor-performing vendor.'],
  ['V4', 'Beacon Respiratory', ['respiratory', 'consumable'], always, true, true, 'active', 1.08, -6, '80015', 35, 'Synthetic oxygen and resupply specialist.'],
  ['V5', 'Cross County Mobility', ['mobility', 'transfer'], { ...weekdays, sat: ['09:00', '15:00'] }, true, false, 'active', .90, 4, '80123', 40, 'Synthetic mobility specialist.'],
  ['V6', 'NorthStar Home Equipment', all, always, true, true, 'invited', 1.03, 2, '80230', 60, 'Brand-new synthetic vendor with no history; Unrated by design.'],
];
const coverage = ['80012', '80013', '80014', '80015', '80016', '80017', '80111', '80112', '80122', '80123', '80220', '80230'];
const vendors = vendorDefinitions.map(([key, name, categories, hours, open_weekends, hazmat_certified, status, factor, leadOffset, service_center_zip, service_radius_miles, notes], i) => {
  const offered = catalog.filter((x) => categories.includes(x.category));
  return { id: randomUUID(), key, factor, leadOffset, name, categories, hours, open_weekends,
    dispatch_phone: `+1303555010${i + 1}`, dispatch_email: `${key.toLowerCase()}-dispatch@example.com`,
    coverage_zips: key === 'V3' ? coverage.slice(0, 4) : coverage, inventory: Object.fromEntries(offered.map((x, n) => [x.hcpcs, 2 + n % 8])),
    pricing_model: 'per_item_day', service_center_zip, service_radius_miles, hazmat_certified, status, notes,
    created_at: iso(plus(now, { d: -120 })) };
});
const basePrice = { E0260:25000,E0250:20500,E0184:7000,E0277:39000,E0310:3500,E0910:5200,E0274:2800,E1390:16500,E0431:14500,E0601:8900,E0470:24000,E0570:4800,E0600:11500,E1130:7200,E1038:6500,E2601:2600,E0143:3200,E0100:1500,E0630:20500,E0163:2900,E0240:2400,A4615:1800,A6216:7600,T4527:6800,A4353:4200,A4406:5900 };
const categoryLead = { bed:24, respiratory:12, mobility:24, transfer:30, consumable:18 };
const prices = vendors.flatMap((v) => catalog.filter((x) => v.categories.includes(x.category)).map((x, i) => ({
  vendor_id: v.id, hcpcs: x.hcpcs, price_cents: Math.round(basePrice[x.hcpcs] * v.factor / 50) * 50,
  in_stock: !(v.key === 'V3' && i % 11 === 0), lead_time_hours: Math.max(2, categoryLead[x.category] + v.leadOffset + i % 3 * 2),
})));
const priceMap = new Map(prices.map((x) => [`${x.vendor_id}:${x.hcpcs}`, x.price_cents]));

const patientDefinitions = [
  ['PT-88421','Evelyn','Brooks','1938-03-12','female','C90.00','80014','active',124],
  ['PT-88190','Walter','Kim','1941-11-04','male','J44.9','80015','active',67],
  ['PT-88502','Maria','Santos','1947-07-19','female','I50.9','80111','active',42],
  ['PT-87950','Robert','Miller','1935-01-27','male','G30.9','80013','active',176],
  ['PT-87602','Dorothy','Nguyen','1940-09-08','female','G30.9','80122','deceased',91],
  ['PT-87411','James','Wilson','1933-05-16','male','C90.00','80012','deceased',153],
  ['PT-88633','Helen','Price','1944-02-23','female','I50.9','80123','active',35],
  ['PT-88710','Frank','Davis','1939-12-01','male','J44.9','80220','discharge_scheduled',28],
  ['PT-88044','Lucille','Garcia','1936-06-30','female','J44.9','80016','active',83],
  ['PT-87889','Henry','Jackson','1942-10-14','male','I50.9','80230','active',58],
];
// Henry Jackson is admitted this morning so the nurse "New admissions" section is
// never empty after a reseed. He carries no demo order, so nothing else shifts.
const FRESH_ADMISSION = 'PT-87889';
const patients = patientDefinitions.map(([external_id, first_name, last_name, dob, gender, primary_dx, zip, care_status, admitted], i) => {
  const admittedAt = external_id === FRESH_ADMISSION ? plus(now, { h: -6 }) : plus(now, { d: -admitted });
  return {
  id: randomUUID(), external_id, med_rec_no: `MRN-${61000 + i}`, first_name, last_name, dob, gender,
  phone: `+13035552${String(i).padStart(3, '0')}`, address: { street1: `${120 + i * 17} Juniper Way`, city: 'Aurora', state: 'CO', zip, country: 'US' },
  primary_dx, hospice_name: 'Desert Valley Hospice', emr_source: 'HCHB', care_status,
  admitted_at: iso(admittedAt), discharge_at: care_status === 'discharge_scheduled' ? iso(plus(now, { d: 2, h: 3 })) : null,
  status_changed_at: external_id === 'PT-87602' ? iso(plus(now, { h: -7, m: -5 })) : external_id === 'PT-87411' ? iso(plus(now, { d: -4 })) : null,
  created_at: iso(admittedAt),
  };
});
// Months of history under a patient admitted this morning would read as a bug.
const historyPatients = patients.filter((p) => p.external_id !== FRESH_ADMISSION);
const V = Object.fromEntries(vendors.map((x) => [x.key, x]));
const P = Object.fromEntries(patients.map((x) => [x.external_id, x]));
const ev = (order_id, type, when, payload = {}, actor = 'system', actor_role = 'system') => ({ order_id, type, payload, external_id: null, actor, actor_role, created_at: iso(when) });
const cost = (v, codes) => codes.reduce((sum, code) => sum + priceMap.get(`${v.id}:${code}`), 0);

function historyOrder(v, vendorIndex, index) {
  const id = randomUUID();
  const placed = plus(now, { d: -(58 - ((index * 4 + vendorIndex * 7) % 52)), h: -(8 + index % 6) });
  const notified = plus(placed, { m: 5 });
  const bad = v.key === 'V3', optimistic = v.key === 'V2';
  const decline = (bad && [2, 9].includes(index)) || (optimistic && index === 11);
  const confirmMins = bad ? 70 + index * 12 : optimistic ? 35 + index % 4 * 15 : 8 + index % 5 * 4;
  const confirmed = plus(notified, { m: confirmMins + (decline ? 190 : 0) });
  const promised = plus(confirmed, { h: v.key === 'V4' ? 7 : optimistic ? 10 : 18 });
  const lateH = bad ? ([1,3,6,8,10,12].includes(index) ? 4 + index % 3 : -.5) : optimistic ? (index % 3 === 0 ? 1.75 : 1.1) : (index === 9 ? 1.25 : -.25 - index % 3 * .25);
  const delivered = plus(promised, { m: Math.round(lateH * 60) });
  const dispatched = plus(delivered, { h: -3 }), etaAt = plus(dispatched, { m: 35 });
  const pickup = index % 4 === 0, pickupRequested = plus(delivered, { d: 4, h: 2 });
  const pickupH = bad ? ([0,4,8,12].includes(index) ? 82 + index : 42) : 12 + index % 3 * 6;
  const pickedUp = plus(pickupRequested, { h: pickupH });
  const pool = catalog.filter((x) => v.categories.includes(x.category));
  const code = pool[(index + vendorIndex * 3) % pool.length].hcpcs;
  const issue = bad && [1,4,6,9,12].includes(index) ? (index % 2 ? 'dirty' : 'damaged') : 'none';
  const events = [ev(id,'order_placed',placed,{items:[item(code)],urgency:'routine',target_at:iso(promised)},'Synthetic history','system'), ev(id,'vendor_notified',notified,{vendor_id:v.id,channel:'sms',nudge:false})];
  if (decline) {
    const mins = bad ? 150 + index * 8 : 40, declined = plus(notified, { m: mins });
    events.push(ev(id,'vendor_declined',declined,{vendor_id:v.id,reason:'Temporary route capacity',minutes_since_notified:mins},`${v.name} dispatch`,'vendor'), ev(id,'reordered',plus(declined,{m:3}),{from_vendor_id:v.id,to_vendor_id:v.id,reason:'declined'}), ev(id,'vendor_notified',plus(declined,{m:5}),{vendor_id:v.id,channel:'sms',nudge:true}));
  }
  events.push(ev(id,'vendor_confirmed',confirmed,{vendor_id:v.id,promised_eta:iso(promised)},`${v.name} dispatch`,'vendor'), ev(id,'dispatched',dispatched,{route:`History route ${1+index%6}`},`${v.name} dispatch`,'vendor'), ev(id,'eta_updated',etaAt,{eta:iso(promised),source:'vendor'},`${v.name} dispatch`,'vendor'));
  if ((bad && [3,6,8,10,12].includes(index)) || (optimistic && [5,10].includes(index))) events.push(ev(id,'at_risk_flagged',plus(delivered,{h:-1}),{reason:'Synthetic history: projected ETA beyond promised window',rule:'eta_after_target',minutes_late:Math.max(30,Math.round(lateH*60))}));
  events.push(ev(id,'delivered',delivered,{pod_photo_url:`https://placehold.co/800x600?text=POD+${v.key}-${index+1}`,signature:'Synthetic recipient'},`${v.name} driver`,'vendor'));
  if (index % 5 !== 3 || bad) {
    const payload = { phase:'delivery', functional:issue!=='damaged', clean:issue!=='dirty', repair:issue==='damaged'?'poor':bad&&index%3===0?'worn':'good', issue };
    if (v.key === 'V1' && index === 7) Object.assign(payload,{issue:'dirty',clean:false,vendor_note:'Sealed cover; review upheld.',dispute_upheld:true});
    events.push(ev(id,'condition_reported',plus(delivered,{m:12}),payload,'Synthetic nurse','nurse'));
  }
  if (bad && index === 6) events.push(ev(id,'condition_reported',plus(delivered,{d:1}),{phase:'post_delivery',functional:false,clean:true,repair:'poor',issue:'not_working'},'Synthetic nurse','nurse'), ev(id,'reordered',plus(delivered,{d:1,m:10}),{from_vendor_id:v.id,to_vendor_id:v.id,reason:'defect'}));
  if (pickup) events.push(ev(id,'pickup_requested',pickupRequested,{notified_vendor_ids:[v.id]},'Synthetic case manager','case_manager'), ev(id,'pickup_scheduled',plus(pickupRequested,{m:45}),{window_start:iso(plus(pickupRequested,{h:Math.max(2,pickupH-2)})),window_end:iso(pickedUp),batched:pickupH<=24},`${v.name} dispatch`,'vendor'), ev(id,'picked_up',pickedUp,{condition_photo_url:`https://placehold.co/800x600?text=Pickup+${v.key}-${index+1}`},`${v.name} driver`,'vendor'));
  events.sort((a,b) => Date.parse(a.created_at)-Date.parse(b.created_at));
  return { order:{ id,order_no:`HIST-${vendorIndex+1}-${String(index+1).padStart(3,'0')}`,patient_id:historyPatients[(index+vendorIndex)%historyPatients.length].id,vendor_id:v.id,hospice_account:'ACCT-001',status:pickup?'picked_up':'delivered',urgency:'routine',items:[item(code)],price_cents:cost(v,[code]),ordered_at:iso(placed),target_at:iso(promised),promised_eta:iso(promised),current_eta:iso(promised),delivered_at:iso(delivered),pickup_requested_at:pickup?iso(pickupRequested):null,pickup_scheduled_at:pickup?iso(plus(pickupRequested,{m:45})):null,picked_up_at:pickup?iso(pickedUp):null,ordered_by:'Synthetic history',ordered_by_role:'case_manager',created_at:iso(placed)}, events };
}

const demos = [];
function demo(no, patient, vendor, status, urgency, codes, orderedAt, target, fields, events) {
  const id = randomUUID(), items = codes.map((x) => item(x));
  const order = { id,order_no:no,patient_id:patient.id,vendor_id:vendor?.id??null,hospice_account:'ACCT-001',status,urgency,items,price_cents:vendor?cost(vendor,codes):null,ordered_at:iso(orderedAt),target_at:target?iso(target):null,promised_eta:null,current_eta:null,delivered_at:null,pickup_requested_at:null,pickup_scheduled_at:null,picked_up_at:null,ordered_by:'Maria R.',ordered_by_role:'nurse',created_at:iso(orderedAt),...fields };
  demos.push({ order, events: events(id,items) });
}
demo('DME-10231',P['PT-88421'],null,'ordered','admission',['E0260'],plus(now,{h:-6}),localHour(1,14),{},(id,items)=>[ev(id,'order_placed',plus(now,{h:-6}),{items,urgency:'admission',target_at:iso(localHour(1,14))},'Maria R.','nurse')]);
demo('DME-10198',P['PT-88190'],V.V1,'dispatched','admission',['E1390'],plus(now,{h:-26}),plus(now,{h:8}),{promised_eta:iso(plus(now,{h:4})),current_eta:iso(plus(now,{h:4}))},(id,items)=>{const a=plus(now,{h:-26}),n=plus(a,{m:8}),c=plus(n,{m:11});return[ev(id,'order_placed',a,{items,urgency:'admission',target_at:iso(plus(now,{h:8}))},'Maria R.','nurse'),ev(id,'vendor_notified',n,{vendor_id:V.V1.id,channel:'sms',nudge:false}),ev(id,'vendor_confirmed',c,{vendor_id:V.V1.id,promised_eta:iso(plus(now,{h:4}))},'Ridgeline dispatch','vendor'),ev(id,'dispatched',plus(now,{h:-4}),{route:4},'Ridgeline dispatch','vendor')];});
demo('DME-10305',P['PT-88502'],V.V2,'ordered','stat',['E0600'],plus(now,{m:-10}),plus(now,{h:4}),{},(id,items)=>[ev(id,'order_placed',plus(now,{m:-10}),{items,urgency:'stat',target_at:iso(plus(now,{h:4}))},'David L.','case_manager'),ev(id,'vendor_notified',plus(now,{m:-8}),{vendor_id:V.V2.id,channel:'sms',nudge:false})]);
demo('DME-10087',P['PT-87950'],V.V1,'delivered','routine',['E0277'],plus(now,{h:-52}),plus(now,{h:-28}),{promised_eta:iso(plus(now,{h:-28})),current_eta:iso(plus(now,{h:-28})),delivered_at:iso(plus(now,{h:-27}))},(id,items)=>{const a=plus(now,{h:-52}),n=plus(a,{m:6}),c=plus(n,{m:10}),d=plus(now,{h:-27});return[ev(id,'order_placed',a,{items,urgency:'routine',target_at:iso(plus(now,{h:-28}))},'Maria R.','nurse'),ev(id,'vendor_notified',n,{vendor_id:V.V1.id,channel:'sms',nudge:false}),ev(id,'vendor_confirmed',c,{vendor_id:V.V1.id,promised_eta:iso(plus(now,{h:-28}))},'Ridgeline dispatch','vendor'),ev(id,'dispatched',plus(d,{h:-3}),{route:2},'Ridgeline dispatch','vendor'),ev(id,'eta_updated',plus(d,{h:-2}),{eta:iso(plus(now,{h:-28})),source:'vendor'},'Ridgeline dispatch','vendor'),ev(id,'delivered',d,{signature:'Elena Garcia',signature_name:'Elena Garcia',pod_photo_url:'https://placehold.co/1200x900?text=DME-10087+POD',timestamp:iso(d)},'Ridgeline driver','vendor'),ev(id,'condition_reported',plus(d,{m:8}),{phase:'delivery',functional:true,clean:true,repair:'good',issue:'none'},'Maria R.','nurse')];});
demo('DME-09911',P['PT-87602'],V.V2,'pickup_triggered','routine',['E1130','E0601'],plus(now,{d:-18}),plus(now,{d:-17}),{promised_eta:iso(plus(now,{d:-17})),current_eta:iso(plus(now,{d:-17})),delivered_at:iso(plus(now,{d:-17,h:-1})),pickup_requested_at:iso(plus(now,{h:-7,m:-4}))},(id,items)=>{const a=plus(now,{d:-18}),d=plus(now,{d:-17,h:-1}),death=plus(now,{h:-7,m:-5});return[ev(id,'order_placed',a,{items,urgency:'routine',target_at:iso(plus(now,{d:-17}))},'David L.','case_manager'),ev(id,'vendor_notified',plus(a,{m:8}),{vendor_id:V.V2.id,channel:'sms',nudge:false}),ev(id,'vendor_confirmed',plus(a,{m:46}),{vendor_id:V.V2.id,promised_eta:iso(plus(now,{d:-17}))},'Gulf Coast dispatch','vendor'),ev(id,'dispatched',plus(d,{h:-3}),{route:5},'Gulf Coast dispatch','vendor'),ev(id,'eta_updated',plus(d,{h:-2}),{eta:iso(plus(now,{d:-17})),source:'vendor'},'Gulf Coast dispatch','vendor'),ev(id,'delivered',d,{pod_photo_url:'https://placehold.co/1200x900?text=DME-09911+POD',signature:'Family caregiver'},'Gulf Coast driver','vendor'),ev(id,'patient_status_changed',death,{to:'deceased'},'Maria R.','nurse'),ev(id,'pickup_requested',plus(death,{m:1}),{notified_vendor_ids:[V.V2.id]},'David L.','case_manager')];});
demo('DME-09803',P['PT-87411'],V.V3,'pickup_triggered','routine',['E0260'],plus(now,{d:-28}),plus(now,{d:-27}),{promised_eta:iso(plus(now,{d:-27})),current_eta:iso(plus(now,{d:-27})),delivered_at:iso(plus(now,{d:-26,h:-19})),pickup_requested_at:iso(plus(now,{d:-4,m:2}))},(id,items)=>{const a=plus(now,{d:-28}),d=plus(now,{d:-26,h:-19}),death=plus(now,{d:-4});return[ev(id,'order_placed',a,{items,urgency:'routine',target_at:iso(plus(now,{d:-27}))},'David L.','case_manager'),ev(id,'vendor_notified',plus(a,{m:7}),{vendor_id:V.V3.id,channel:'sms',nudge:false}),ev(id,'vendor_confirmed',plus(a,{h:2}),{vendor_id:V.V3.id,promised_eta:iso(plus(now,{d:-27}))},'ValueCare dispatch','vendor'),ev(id,'dispatched',plus(d,{h:-4}),{route:1},'ValueCare dispatch','vendor'),ev(id,'eta_updated',plus(d,{h:-2}),{eta:iso(plus(now,{d:-27})),source:'vendor'},'ValueCare dispatch','vendor'),ev(id,'delivered',d,{pod_photo_url:'https://placehold.co/1200x900?text=DME-09803+POD',signature:'Family caregiver'},'ValueCare driver','vendor'),ev(id,'condition_reported',plus(d,{m:20}),{phase:'delivery',functional:true,clean:false,repair:'worn',issue:'dirty'},'Synthetic nurse','nurse'),ev(id,'patient_status_changed',death,{to:'deceased'},'Maria R.','nurse'),ev(id,'pickup_requested',plus(death,{m:2}),{notified_vendor_ids:[V.V3.id]},'David L.','case_manager')];});

async function verify() {
  console.log('\nVerification counts');
  for (const table of ['equipment_catalog','vendors','vendor_prices','patients','orders','order_events','messages','resupply_schedules','magic_links','settings','demo_state']) {
    const { count, error } = await db.from(table).select('*',{count:'exact',head:true}); if (error) die(`count ${table}`,error);
    console.log(`  ${table.padEnd(22)} ${count}`);
  }
  const nos = ['DME-10231','DME-10198','DME-10305','DME-10087','DME-09911','DME-09803'];
  const { data: orders, error } = await db.from('orders').select('id,order_no,status').in('order_no',nos); if(error)die('read demo orders',error);
  const { data: events, error: ee } = await db.from('order_events').select('order_id').in('order_id',orders.map(x=>x.id)); if(ee)die('read demo events',ee);
  const counts = events.reduce((m,x)=>m.set(x.order_id,(m.get(x.order_id)||0)+1),new Map()), byNo=new Map(orders.map(x=>[x.order_no,x]));
  console.log('\nDemo orders');
  for(const no of nos){const o=byNo.get(no);if(!o)throw new Error(`missing ${no}`);console.log(`  ${no}  status=${o.status.padEnd(16)} events=${counts.get(o.id)||0}`);}
}

async function main() {
  const { count, error } = await db.from('patients').select('*',{count:'exact',head:true}); if(error)die('seed guard',error);
  if(count>0){if(resetRequested){console.error('Cannot reset through Supabase REST: order_events is append-only and no truncate RPC exists.\nRun this in the Supabase SQL editor, then run npm run seed:\n\n'+RESET_SQL);process.exitCode=2;}else console.log(`Already seeded (${count} patients found); no rows inserted.`);return;}
  if(resetRequested) console.log('Database is empty; reset has nothing to remove. Continuing.');
  console.log(`Seeding synthetic BetterRX DME data anchored at ${iso(now)}...`);
  await insert('equipment_catalog',catalog);
  const vendorRows = vendors.map((vendor) => {
    const row = { ...vendor };
    delete row.key; delete row.factor; delete row.leadOffset;
    return row;
  });
  await insert('vendors',vendorRows);
  await batches('vendor_prices',prices);
  await insert('patients',patients);
  const history=vendors.filter(x=>x.key!=='V6').flatMap((v,vi)=>Array.from({length:14},(_,i)=>historyOrder(v,vi,i)));
  await batches('orders',[...history,...demos].map(x=>x.order));
  await batches('order_events',[...history,...demos].flatMap(x=>x.events));
  const delayed=demos.find(x=>x.order.order_no==='DME-09803').order;
  const messages=[
    {id:randomUUID(),order_id:delayed.id,vendor_id:V.V3.id,direction:'inbound',channel:'sms',to_addr:V.V3.dispatch_phone,body:'Family called: equipment is still at the home. When is pickup?',parsed:{intent:'question',confidence:1,parser:'deterministic',from:'family'},created_at:iso(plus(now,{d:-2}))},
    {id:randomUUID(),order_id:delayed.id,vendor_id:V.V3.id,direction:'inbound',channel:'sms',to_addr:V.V3.dispatch_phone,body:'Second family call: bed still has not been collected.',parsed:{intent:'question',confidence:1,parser:'deterministic',from:'family'},created_at:iso(plus(now,{h:-18}))},
  ];
  await insert('messages',messages); await insert('order_events',messages.map(x=>ev(delayed.id,'message_received',new Date(x.created_at),{message_id:x.id},'Family caregiver','system')));
  await insert('resupply_schedules',[
    {id:randomUUID(),patient_id:P['PT-88044'].id,hcpcs:'E0431',interval_days:14,last_delivered_at:iso(plus(now,{d:-12})),next_due_at:iso(plus(now,{d:2})),is_swap:true,active:true},
    {id:randomUUID(),patient_id:P['PT-88190'].id,hcpcs:'A4615',interval_days:30,last_delivered_at:iso(plus(now,{d:-34})),next_due_at:iso(plus(now,{d:-4})),is_swap:false,active:true},
    {id:randomUUID(),patient_id:P['PT-87950'].id,hcpcs:'A6216',interval_days:7,last_delivered_at:iso(plus(now,{d:-6})),next_due_at:iso(plus(now,{d:1})),is_swap:false,active:true},
    {id:randomUUID(),patient_id:P['PT-88633'].id,hcpcs:'T4527',interval_days:14,last_delivered_at:iso(plus(now,{d:-5})),next_due_at:iso(plus(now,{d:9})),is_swap:false,active:true},
  ]);
  await insert('magic_links',[...['V1','V2','V3','V4','V5'].map(k=>({token:`demo-run-list-${k.toLowerCase()}-2026`,vendor_id:V[k].id,scope:'run_list',order_id:null,expires_at:iso(plus(now,{d:30})),last_used_at:null,created_at:iso(now)})),...['V1','V3'].map(k=>({token:`demo-report-card-${k.toLowerCase()}`,vendor_id:V[k].id,scope:'report_card',order_id:null,expires_at:iso(plus(now,{d:30})),last_used_at:null,created_at:iso(now)})),{token:'demo-onboarding-v6-2026',vendor_id:V.V6.id,scope:'onboarding',order_id:null,expires_at:iso(plus(now,{d:30})),last_used_at:null,created_at:iso(now)}]);
  await insert('settings',[
    {key:'don_threshold_cents',value:50000},{key:'lead_time_hours',value:{stat:4,admission:24,routine:48}},{key:'silence_minutes',value:{stat:30,admission:120,routine:480}},{key:'pickup_amber_h',value:24},{key:'pickup_red_h',value:48},{key:'baseline_notify_lag_h',value:26},{key:'high_risk_buffer_h',value:2},{key:'eta_amber_margin_min',value:60},{key:'med_ppd_synthetic',value:1050},{key:'timezone',value:'America/Denver'},
  ]);
  await insert('demo_state',[{id:1,clock_offset_seconds:0,seeded_at:iso(now)}]);
  await verify(); console.log('\nSeed complete. Vendor performance history is synthetic and event-derived.');
}
main().catch((e)=>{console.error(`Seed failed: ${e.message}\nIf partial rows were inserted, run in the Supabase SQL editor:\n\n${RESET_SQL}`);process.exitCode=1;});
