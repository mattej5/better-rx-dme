// /api/pickups.js — returns pickup queue derived from order_events
import fs from 'fs';
import path from 'path';

const DATA = path.join(process.cwd(), 'data');
const EVENTS = path.join(DATA, 'order_events.json');
const SEED = path.join(DATA, 'seed.json');

function load(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; }

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Only GET');
  const events = load(EVENTS);
  const seed = load(SEED);
  const patients = seed.patients || [];

  const pickups = events.filter(e => e.type === 'pickup_requested').map(e => {
    const patient = patients.find(p => p.id === e.payload?.patient_id) || { id: e.payload?.patient_id, name: 'Unknown' };
    const elapsedHours = Math.round((Date.now() - new Date(e.created_at).getTime()) / (1000*60*60));
    return { event_id: e.id, patient_id: patient.id, patient_name: patient.name, created_at: e.created_at, elapsed_hours: elapsedHours, payload: e.payload };
  });

  // Sort worst-first by elapsed_hours desc
  pickups.sort((a,b) => (b.elapsed_hours||0) - (a.elapsed_hours||0));
  return res.status(200).json({ count: pickups.length, pickups });
}
