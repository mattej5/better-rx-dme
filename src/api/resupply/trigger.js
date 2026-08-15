// /api/resupply/trigger.js — trigger resupply checks (POST) and emit resupply_due events
import fs from 'fs';
import path from 'path';

const DATA = path.join(process.cwd(), 'data');
const EVENTS = path.join(DATA, 'order_events.json');
const SEED = path.join(DATA, 'seed.json');

function load(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; }
function save(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST');
  const seed = load(SEED);
  const events = load(EVENTS);
  const now = new Date().toISOString();
  const generated = [];

  const schedules = seed.resupply_schedules || [];
  schedules.forEach(s => {
    if (new Date(s.next_due_at) <= new Date()) {
      const ev = { id: 'ev-'+Math.random().toString(36).slice(2,9), type: 'resupply_due', created_at: now, payload: { resupply_id: s.id, patient_id: s.patient_id, hcpcs: s.hcpcs } };
      events.push(ev);
      generated.push(ev);
    }
  });

  save(EVENTS, events);
  return res.status(200).json({ ok: true, generated: generated.length, events: generated });
}
