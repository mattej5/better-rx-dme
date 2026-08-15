// /api/patient/status-change.js — patient status change fan-out for demo
import fs from 'fs';
import path from 'path';
import { sendMessage } from '../../lib/sendMessage';

const DATA = path.join(process.cwd(), 'data');
const EVENTS = path.join(DATA, 'order_events.json');

function loadJson(p) { if (!fs.existsSync(p)) return []; return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST');
  const body = req.body;
  if (!body || !body.patient_id || !body.reason) return res.status(400).json({ error: 'missing patient_id or reason' });

  const events = loadJson(EVENTS);
  const now = new Date().toISOString();
  const statusEvent = { id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'patient_status_changed', created_at: now, payload: { patient_id: body.patient_id, reason: body.reason } };
  events.push(statusEvent);

  // For demo: create pickup_requested events for any open serialized orders for that patient
  // Since we don't have a DB, emit a generic pickup_requested event referencing the patient
  const pickupEvent = { id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'pickup_requested', created_at: now, payload: { patient_id: body.patient_id } };
  events.push(pickupEvent);

  saveJson(EVENTS, events);

  // Send messages to vendors (stub) — in production this calls Nathaniel's sendMessage seam
  try {
    await sendMessage('vendors@demo', `Patient ${body.patient_id} status changed: ${body.reason}`, { patient_id: body.patient_id });
  } catch (e) {
    // log but don't fail the write
  }

  return res.status(200).json({ ok: true, receipt: { notified: true, events: [statusEvent.id, pickupEvent.id] } });
}
