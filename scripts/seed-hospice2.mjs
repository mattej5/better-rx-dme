// Additive seed: a second hospice (Mesa Grande Hospice, ACCT-002) so vendor run
// lists visibly serve multiple hospice groups. Idempotent; never deletes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1);
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const HOSPICE = "Mesa Grande Hospice";
const ACCT = "ACCT-002";
const now = Date.now();
const iso = (offsetH) => new Date(now + offsetH * 3600_000).toISOString();

const existing = await db.from("patients").select("id", { count: "exact" }).eq("hospice_name", HOSPICE);
if ((existing.count ?? 0) > 0) {
  console.log("Mesa Grande already seeded; nothing inserted.");
  process.exit(0);
}

const vendors = await db.from("vendors").select("id, name").in("name", [
  "Ridgeline Medical Supply",
  "Gulf Coast Home Medical",
  "Cross County Mobility",
]);
const vid = (name) => vendors.data.find((v) => v.name === name)?.id;

// Mesa Grande runs Axxess: the roster shows a second EMR source, and the
// partner-connection pattern (not an assumed open API) is the integration story.
const patients = [
  { external_id: "PT-MG-70001", first_name: "Rosa", last_name: "Delgado", hospice_name: HOSPICE, emr_source: "Axxess", care_status: "active", admitted_at: iso(-30 * 24), address: { street1: "12 Cholla Ct", city: "Mesa", state: "AZ", zip: "85201" }, med_rec_no: "MRN-72001" },
  { external_id: "PT-MG-70002", first_name: "Earl", last_name: "Hutchins", hospice_name: HOSPICE, emr_source: "Axxess", care_status: "active", admitted_at: iso(-70 * 24), address: { street1: "88 Saguaro Ln", city: "Mesa", state: "AZ", zip: "85203" }, med_rec_no: "MRN-72002" },
  { external_id: "PT-MG-70003", first_name: "Gloria", last_name: "Sandoval", hospice_name: HOSPICE, emr_source: "Axxess", care_status: "deceased", admitted_at: iso(-90 * 24), status_changed_at: iso(-20), address: { street1: "301 Ocotillo Dr", city: "Mesa", state: "AZ", zip: "85210" }, med_rec_no: "MRN-72003" },
];
const pIns = await db.from("patients").insert(patients).select("id, external_id");
if (pIns.error) throw pIns.error;
const pid = (ext) => pIns.data.find((p) => p.external_id === ext).id;

const orders = [
  { order_no: "MG-20101", patient: "PT-MG-70001", vendor: "Ridgeline Medical Supply", status: "dispatched", urgency: "routine", items: [{ hcpcs: "E0260", plain_name: "Hospital bed (semi-electric)", qty: 1 }], price_cents: 25000, ordered_at: iso(-20), target_at: iso(6), current_eta: iso(4) },
  { order_no: "MG-20102", patient: "PT-MG-70002", vendor: "Gulf Coast Home Medical", status: "dispatched", urgency: "routine", items: [{ hcpcs: "E1390", plain_name: "Oxygen concentrator", qty: 1 }], price_cents: 28000, ordered_at: iso(-16), target_at: iso(8), current_eta: iso(5) },
  { order_no: "MG-20103", patient: "PT-MG-70003", vendor: "Cross County Mobility", status: "pickup_triggered", urgency: "routine", items: [{ hcpcs: "E0143", plain_name: "Folding wheeled walker", qty: 1 }], price_cents: 2900, ordered_at: iso(-40 * 24), delivered_at: iso(-38 * 24), pickup_requested_at: iso(-20) },
  { order_no: "MG-20104", patient: "PT-MG-70003", vendor: "Ridgeline Medical Supply", status: "pickup_triggered", urgency: "routine", items: [{ hcpcs: "E0260", plain_name: "Hospital bed (semi-electric)", qty: 1 }], price_cents: 25000, ordered_at: iso(-60 * 24), delivered_at: iso(-58 * 24), pickup_requested_at: iso(-20) },
];

for (const o of orders) {
  const ins = await db.from("orders").insert({
    order_no: o.order_no, patient_id: pid(o.patient), vendor_id: vid(o.vendor),
    hospice_account: ACCT, status: o.status, urgency: o.urgency, items: o.items,
    price_cents: o.price_cents, ordered_at: o.ordered_at, target_at: o.target_at ?? null,
    current_eta: o.current_eta ?? null, delivered_at: o.delivered_at ?? null,
    pickup_requested_at: o.pickup_requested_at ?? null,
  }).select("id").single();
  if (ins.error) throw ins.error;

  const ev = [{ order_id: ins.data.id, type: "order_placed", payload: { target_at: o.target_at ?? null }, actor: "Mesa Grande intake", actor_role: "nurse", created_at: o.ordered_at }];
  ev.push({ order_id: ins.data.id, type: "vendor_notified", payload: { vendor_id: vid(o.vendor), channel: "sms", nudge: false }, actor: "system", actor_role: "case_manager", created_at: o.ordered_at });
  ev.push({ order_id: ins.data.id, type: "vendor_confirmed", payload: {}, actor: "vendor", actor_role: "case_manager", created_at: iso(-14) });
  if (o.status === "dispatched") {
    ev.push({ order_id: ins.data.id, type: "dispatched", payload: {}, actor: "vendor", actor_role: "case_manager", created_at: iso(-3) });
  }
  if (o.delivered_at) {
    ev.push({ order_id: ins.data.id, type: "dispatched", payload: {}, actor: "vendor", actor_role: "case_manager", created_at: iso(o === orders[2] ? -39 * 24 : -59 * 24) });
    ev.push({ order_id: ins.data.id, type: "delivered", payload: { signature: "typed" }, actor: "vendor", actor_role: "case_manager", created_at: o.delivered_at });
  }
  if (o.pickup_requested_at) {
    ev.push({ order_id: ins.data.id, type: "patient_status_changed", payload: { to: "deceased", changed_at: o.pickup_requested_at }, actor: "system", actor_role: "case_manager", created_at: o.pickup_requested_at });
    ev.push({ order_id: ins.data.id, type: "pickup_requested", payload: { notified_vendor_ids: [vid(o.vendor)], requested_at: o.pickup_requested_at }, actor: "system", actor_role: "case_manager", created_at: o.pickup_requested_at });
  }
  const evIns = await db.from("order_events").insert(ev);
  if (evIns.error) throw evIns.error;
}

const check = await db.from("orders").select("order_no, status").eq("hospice_account", ACCT);
console.log("Mesa Grande seeded:", check.data);
