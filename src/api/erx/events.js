// /api/erx/events.js — minimal Next.js-style API handler for demo
import fs from 'fs';
import path from 'path';

const DATA = path.join(process.cwd(), 'data');
const EXTERNAL = path.join(DATA, 'seen_external_ids.json');
const EVENTS = path.join(DATA, 'order_events.json');

function loadJson(p) {
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, v) {
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST');
  const envelope = req.body;
  if (!envelope || !envelope.meta || !envelope.meta.eventType) return res.status(400).json({ error: 'missing envelope' });

  const external = loadJson(EXTERNAL);
  if (envelope.meta.externalId && external.includes(envelope.meta.externalId)) {
    return res.status(200).json({ ok: true, deduped: true });
  }

  // Map envelope types to order_events
  const events = loadJson(EVENTS);
  const now = new Date().toISOString();
  const mapped = [];
  switch (envelope.meta.eventType) {
    case 'patientStatusChanged':
      mapped.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'patient_status_changed', created_at: now, payload: envelope.data });
      // Fan out pickup_requested for serialized rentals is handled by T7 endpoint in production; here we add a marker
      break;
    case 'newDmeOrder':
      mapped.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'order_placed', created_at: now, payload: envelope.data });
      break;
    case 'dmeStatusUpdate':
      mapped.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: envelope.data.status || 'unknown_status', created_at: now, payload: envelope.data });
      break;
    default:
      mapped.push({ id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'vendor_message', created_at: now, payload: envelope });
  }

  mapped.forEach(m => events.push(m));
  saveJson(EVENTS, events);
  if (envelope.meta.externalId) {
    external.push(envelope.meta.externalId);
    saveJson(EXTERNAL, external);
  }

  return res.status(200).json({ ok: true, created: mapped.length });
}
