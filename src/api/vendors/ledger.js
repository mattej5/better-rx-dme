// /api/vendors/ledger.js — returns ledger for a vendor by query param ?vendor_id=vendor-1
import fs from 'fs';
import path from 'path';
import { vendorLedger } from '../../lib/ledger';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Only GET');
  const vendorId = req.query?.vendor_id || req.headers['x-vendor-id'];
  if (!vendorId) return res.status(400).json({ error: 'vendor_id required' });
  const ledger = vendorLedger(vendorId);
  return res.status(200).json({ ok: true, ledger });
}
