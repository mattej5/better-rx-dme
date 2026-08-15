// src/lib/sendMessage.js — sendMessage seam stub
const fs = require('fs');
const path = require('path');

const MESSAGES = path.join(__dirname, '..', '..', 'data', 'messages.json');
function ensure() {
  if (!fs.existsSync(MESSAGES)) fs.writeFileSync(MESSAGES, '[]');
}

exports.sendMessage = async function(to, body, meta) {
  ensure();
  const all = JSON.parse(fs.readFileSync(MESSAGES, 'utf8')) || [];
  const msg = { id: 'm-'+Math.random().toString(36).slice(2,9), to, body, meta, created_at: new Date().toISOString() };
  all.push(msg);
  fs.writeFileSync(MESSAGES, JSON.stringify(all, null, 2));
  // Return a simulated send result
  return { success: true, id: msg.id };
}
