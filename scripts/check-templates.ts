/**
 * node scripts/check-templates.ts
 *
 * Renders every template with synthetic vars, prints SMS character counts, and
 * runs the nudge ladder against a synthetic event log — including the clock-jump
 * idempotency check the demo panel depends on (specs/engine.md §5.1).
 *
 * No test framework. Plain ASCII output; it gets pasted into a review.
 * All data below is invented. No real hospice, vendor, patient, or address.
 */

import {
  TEMPLATE_IDS,
  allTemplateMeta,
  checkVoice,
  renderTemplate,
  TemplateRenderError,
  type TemplateId,
  type TemplateVars,
} from '../src/lib/message-templates.ts';

import {
  deriveLadderState,
  nudgeTimeVars,
  SILENCE_MINUTES_DEFAULT,
  type LadderEvent,
  type LadderStepPlan,
} from '../src/lib/nudge-ladder.ts';

const line = (c = '-') => console.log(c.repeat(78));
let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

// --- Synthetic vars ----------------------------------------------------------

const ORDER_VARS: TemplateVars = {
  hospice: 'Canyon Rim Hospice',
  item_summary: '1 hospital bed',
  item_short: 'hospital bed',
  area: 'Provo',
  needed_by: 'Friday 2:00 PM',
  link: 'https://dme.demo/v/8Kq2',
};

const SAMPLES: Record<TemplateId, TemplateVars[]> = {
  vendor_notify: [ORDER_VARS],
  vendor_nudge: [
    { ...ORDER_VARS, ladder_step: '1' },
    { ...ORDER_VARS, ladder_step: '2' },
    { ...ORDER_VARS, ladder_step: '3', ...nudgeTimeVars('2026-08-21T20:00:00Z', '2026-08-21T16:30:00Z') },
  ],
  vendor_pickup: [
    {
      address: '412 Oak St, Provo',
      items: 'hospital bed, oxygen concentrator',
      notified_at: 'Sat 9:14 PM',
      family_note: 'after Tuesday',
      oxygen: 'true',
      link: 'https://dme.demo/v/8Kq2',
    },
  ],
  vendor_ack: [
    { outcome: 'applied', detail: 'New ETA 4:30 PM is on the order.' },
    { outcome: 'held' },
    { outcome: 'unreadable' },
  ],
  family_delivery: [{ item: 'hospital bed', window_start: '2:00 PM', window_end: '4:00 PM' }],
  family_pickup: [{ item: 'hospital bed' }],
  family_failure_recovery: [
    {
      relation: 'father',
      item: 'oxygen concentrator',
      status: "the supplier's driver is 40 minutes out",
    },
  ],
};

// --- 1. Render every template ------------------------------------------------

line('=');
console.log('1. TEMPLATE RENDERS  (synthetic data only)');
line('=');

for (const id of TEMPLATE_IDS) {
  const meta = allTemplateMeta().find((m) => m.id === id)!;
  for (const vars of SAMPLES[id]) {
    const r = renderTemplate(id, vars);
    const tag = `${id}${vars.ladder_step ? ` step ${vars.ladder_step}` : ''}`;
    console.log(`\n[${tag}]  audience=${meta.audience} channel=${meta.primaryChannel} wiredInV1=${meta.wiredInV1}`);
    console.log(`  subject : ${r.subject}`);
    console.log(`  body    : ${r.body}`);
    console.log(`  cta     : ${r.cta || '(none)'}`);
    console.log(`  chars   : ${r.chars}   encoding: ${r.encoding}   sms segments: ${r.smsSegments}`);
    const banned = [...checkVoice(r.body), ...checkVoice(r.subject)];
    if (banned.length) {
      failures++;
      console.log(`  VOICE FAIL: banned phrase ${banned.join(', ')}`);
    }
    if (meta.audience === 'vendor' && r.encoding !== 'GSM-7') {
      failures++;
      console.log(`  ENCODING FAIL: vendor SMS must stay GSM-7 (UCS-2 cuts segments to 70 chars)`);
    }
    if (meta.audience === 'vendor' && r.cta.split(/\s+/).length > 3) {
      failures++;
      console.log(`  CTA FAIL: "${r.cta}" is more than 3 words`);
    }
  }
}

// --- 2. Loud failure on missing vars ----------------------------------------

console.log('');
line('=');
console.log('2. MISSING-VAR FAILURES (must throw, never render "undefined")');
line('=');

function expectThrow(label: string, fn: () => unknown) {
  try {
    const out = fn();
    check(label, false, `no throw, returned ${JSON.stringify(out)}`);
  } catch (e) {
    const msg = e instanceof TemplateRenderError ? e.message : `WRONG ERROR TYPE: ${String(e)}`;
    check(label, e instanceof TemplateRenderError, `-> ${msg}`);
  }
}

expectThrow('vendor_notify with no needed_by', () =>
  renderTemplate('vendor_notify', { ...ORDER_VARS, needed_by: '' }),
);
expectThrow('vendor_nudge step 3 with no time_left', () =>
  renderTemplate('vendor_nudge', { ...ORDER_VARS, ladder_step: '3' }),
);
expectThrow('vendor_nudge step 4 (no vendor copy exists)', () =>
  renderTemplate('vendor_nudge', { ...ORDER_VARS, ladder_step: '4' }),
);
expectThrow('vendor_pickup with no address', () =>
  renderTemplate('vendor_pickup', { items: 'bed', notified_at: 'now', link: 'x' }),
);
check(
  'vendor_nudge step 1 does not require time_left',
  renderTemplate('vendor_nudge', { ...ORDER_VARS, ladder_step: '1' }).body.length > 0,
);

// --- 3. Ladder against a synthetic log --------------------------------------

console.log('');
line('=');
console.log('3. NUDGE LADDER  (admission order, SILENCE = 120 min)');
line('=');

const T0 = '2026-08-15T14:00:00.000Z';
const t = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();

const baseLog: LadderEvent[] = [
  { type: 'order_placed', created_at: T0, payload: {} },
  { type: 'vendor_notified', created_at: T0, payload: { vendor_id: 'v-synthetic-1' } },
];

console.log(`  SILENCE defaults: ${JSON.stringify(SILENCE_MINUTES_DEFAULT)}`);
console.log(`  vendor_notified at ${T0}\n`);

const fmt = (p: LadderStepPlan) =>
  `step ${p.step} @${p.multiplier}x  due ${p.dueAtIso.slice(11, 16)}  ` +
  `to=[${p.recipients.join('+')}]  ch=${p.channel}  tpl=${p.template ?? '-'}  ` +
  `emits=[${p.emits.join(',')}]${p.requiresHumanConfirm ? '  HUMAN-CONFIRM' : ''}`;

for (const mins of [30, 60, 120, 180, 240, 300]) {
  const st = deriveLadderState({
    urgency: 'admission',
    events: baseLog,
    now: t(mins),
    vendorName: 'Wasatch Home Medical',
    backupVendorName: 'Timp Valley DME',
    isHighCost: true,
  });
  console.log(`  t+${String(mins).padStart(3)}m  due=[${st.due.map((d) => d.step).join(',')}]  next=${st.next ? `step ${st.next.step} @ ${st.next.dueAtIso.slice(11, 16)}` : '-'}`);
}

console.log('\n  Full plan for each step (t+300m, nothing fired yet, high-cost order):');
for (const p of deriveLadderState({
  urgency: 'admission',
  events: baseLog,
  now: t(300),
  vendorName: 'Wasatch Home Medical',
  backupVendorName: 'Timp Valley DME',
  isHighCost: true,
}).due) {
  console.log(`    ${fmt(p)}`);
  console.log(`      summary: ${p.summary}`);
}

console.log('\n  Stop conditions:');
for (const stop of ['vendor_confirmed', 'vendor_declined', 'delivered'] as const) {
  const st = deriveLadderState({
    urgency: 'admission',
    events: [...baseLog, { type: stop, created_at: t(45), payload: {} }],
    now: t(300),
  });
  check(`${stop} at t+45m stops the ladder`, !st.active && st.stoppedBy === stop, `due=[${st.due.map((d) => d.step).join(',')}]`);
}

const reNotified = deriveLadderState({
  urgency: 'admission',
  events: [
    ...baseLog,
    { type: 'message_sent', created_at: t(60), payload: { kind: 'nudge', ladder_step: 1 } },
    { type: 'vendor_notified', created_at: t(200), payload: {} },
  ],
  now: t(280),
});
check(
  're-notify restarts the ladder (markers before it do not count)',
  reNotified.active && reNotified.fired.length === 0 && reNotified.due.map((d) => d.step).join(',') === '1',
  `fired=[${reNotified.fired.join(',')}] due=[${reNotified.due.map((d) => d.step).join(',')}]`,
);

// --- 4. Clock-jump idempotency ----------------------------------------------

console.log('');
line('=');
console.log('4. CLOCK-JUMP IDEMPOTENCY  (stat order, SILENCE = 30 min)');
line('=');

/** Simulates the caller: derive due steps, append a marker event for each. */
function sweep(log: LadderEvent[], nowIso: string): LadderEvent[] {
  const st = deriveLadderState({ urgency: 'stat', events: log, now: nowIso });
  const appended: LadderEvent[] = [];
  for (const p of st.due) {
    if (p.requiresHumanConfirm) continue; // step 5 surfaces an offer; no event until a human taps
    appended.push({
      type: p.emits.includes('message_sent') ? 'message_sent' : 'escalated',
      created_at: nowIso,
      payload: { ...p.marker, template: p.template, recipients: p.recipients },
    });
  }
  return [...log, ...appended];
}

const statLog: LadderEvent[] = [
  { type: 'order_placed', created_at: T0, payload: {} },
  { type: 'vendor_notified', created_at: T0, payload: {} },
];

// Path A: six 10-minute jumps.
let pathA = statLog;
for (let i = 1; i <= 6; i++) pathA = sweep(pathA, t(i * 10));

// Path B: one 60-minute jump.
const pathB = sweep(statLog, t(60));

const shape = (log: LadderEvent[]) =>
  log
    .filter((e) => e.type !== 'order_placed' && e.type !== 'vendor_notified')
    .map((e) => {
      const p = e.payload as Record<string, unknown>;
      return `${e.type}:step${String(p.ladder_step)}`;
    })
    .sort()
    .join(' | ');

console.log(`  six x +10m : ${shape(pathA)}`);
console.log(`  one x +60m : ${shape(pathB)}`);
check('identical event log after 60 virtual minutes', shape(pathA) === shape(pathB));

// Re-sweeping without advancing must be a no-op.
const reswept = sweep(pathB, t(60));
check('re-sweep at the same instant appends nothing', shape(reswept) === shape(pathB));

// A huge jump past every step still fires each step exactly once.
const bigJump = sweep(statLog, t(1440));
check(
  '+1 day fires steps 1-4 once each, step 5 waits for a human',
  shape(bigJump) === 'escalated:step4 | message_sent:step1 | message_sent:step2 | message_sent:step3',
  shape(bigJump),
);
const step5 = deriveLadderState({ urgency: 'stat', events: bigJump, now: t(1440) }).due;
check(
  'step 5 stays surfaced and never auto-fires',
  step5.length === 1 && step5[0].step === 5 && step5[0].requiresHumanConfirm && step5[0].emits.length === 0,
  `due=[${step5.map((d) => `${d.step}${d.requiresHumanConfirm ? '(confirm)' : ''}`).join(',')}]`,
);

// Rendering the nudges the sweep produced must work end to end.
console.log('\n  Bodies the +1d sweep would send:');
for (const e of bigJump.filter((x) => x.type === 'message_sent')) {
  const p = e.payload as Record<string, unknown>;
  const step = String(p.ladder_step) as '1' | '2' | '3';
  const vars: TemplateVars = {
    ...ORDER_VARS,
    ladder_step: step,
    ...nudgeTimeVars(t(1500), t(1440)),
  };
  const r = renderTemplate('vendor_nudge', vars);
  console.log(`    step ${step} (${r.chars} chars, ${r.smsSegments} seg): ${r.body}`);
}

// --- Result ------------------------------------------------------------------

console.log('');
line('=');
console.log(failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`);
line('=');
process.exit(failures === 0 ? 0 : 1);
