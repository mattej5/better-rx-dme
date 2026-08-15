/**
 * npm run sms:test -- +15551234567 ["optional body"]
 *
 * Sends ONE real SMS through Twilio so a human can satisfy the "one real test
 * SMS sent and received" check, and prints the message SID and the status
 * Twilio reports back.
 *
 * This is a CREDENTIALS SMOKE TEST, not the app's send path. It deliberately
 * does not go through `sendMessage()`: that seam is tied to an order and writes
 * a `messages` row plus a `message_sent` event, and a smoke test has no order
 * and should not put a fake one on a timeline. It shares `readMessagingConfig()`
 * with the seam so the env vars can never drift apart.
 *
 * Read wiki/facts/sms-delivery-constraints.md before running this. Short
 * version: on a Twilio trial account only Verified Caller IDs can receive
 * anything, and an unregistered A2P 10DLC sender to an unverified US number is
 * dropped by the carrier with no error path back to us.
 *
 * Flags:
 *   --dry-run   Print the transport configuration and what each channel would
 *               use. Sends nothing, costs nothing, needs no credentials.
 *   --yes, -y   Skip the confirmation prompt (for non-interactive shells).
 *   --help, -h
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import {
  describeTransports,
  maskAddress,
  readMessagingConfig,
  type TwilioConfig,
} from '../src/lib/messaging.ts';

const DEFAULT_BODY =
  'BetterRX DME test. New order: 1 hospital bed, Provo. Reply YES or a time.';

const USAGE = `Usage:
  npm run sms:test -- +15551234567 ["optional message body"]
  npm run sms:test -- --dry-run

Flags:
  --dry-run   Show the transport config and selection. Sends nothing.
  --yes, -y   Skip the confirmation prompt.
  --help, -h  This message.`;

function fail(message: string, code = 1): never {
  console.error(`\n${message}\n`);
  process.exit(code);
}

// --- Args --------------------------------------------------------------------

const argv = process.argv.slice(2);
const wantsHelp = argv.includes('--help') || argv.includes('-h');
const dryRun = argv.includes('--dry-run');
const assumeYes = argv.includes('--yes') || argv.includes('-y');
const positional = argv.filter((a) => !a.startsWith('-'));

if (wantsHelp) {
  console.log(USAGE);
  process.exit(0);
}

// --- Dry run: transport selection only, no credentials required --------------

if (dryRun) {
  const report = describeTransports();
  console.log('');
  console.log('DRY RUN - nothing is sent, nothing is written to the database.');
  console.log('');
  console.log('Configured transports (names only, no values are ever printed):');
  console.log(`  Twilio (sms):   ${report.twilioConfigured ? 'configured' : 'NOT configured'}`);
  console.log(`  Resend (email): ${report.resendConfigured ? 'configured' : 'NOT configured'}`);
  console.log(`  MESSAGING_DRY_RUN: ${report.dryRun ? 'on' : 'off'}`);
  if (report.missing.length > 0) {
    console.log(`  Unset: ${report.missing.join(', ')}`);
  }
  console.log('');
  console.log('Transport that sendMessage() would pick:');
  console.log(`  "sms"   to a phone number -> ${report.sms.transport}   ${report.sms.reason}`);
  console.log(`  "sms"   to an email       -> ${report.smsToEmail.transport}   ${report.smsToEmail.reason}`);
  console.log(`  "email" to an email       -> ${report.email.transport}   ${report.email.reason}`);
  console.log('');
  console.log('To send a real message: npm run sms:test -- +1XXXXXXXXXX');
  console.log('');
  process.exit(0);
}

const destination = positional[0];
if (!destination) {
  fail(`No destination number.\n\n${USAGE}`);
}
if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
  fail(
    `"${destination}" is not an E.164 phone number.\n` +
      'Write it with a plus and the country code, no spaces or dashes: +15551234567',
  );
}

const body = positional[1] ?? DEFAULT_BODY;

// --- Credentials -------------------------------------------------------------

const config = readMessagingConfig();
if (!config.twilio) {
  const twilioMissing = config.missing.filter((name) => name.startsWith('TWILIO_'));
  fail(
    `Twilio is not configured. Missing: ${twilioMissing.join(', ')}\n\n` +
      'Set these in .env.local (see .env.example), or pull them from Vercel:\n' +
      '  npx vercel env pull .env.local\n' +
      'Then run this again. The values are already set in the Vercel project.',
  );
}
const twilio: TwilioConfig = config.twilio;

// --- Warning -----------------------------------------------------------------

console.log('');
console.log('About to send one real SMS through Twilio.');
console.log('');
console.log(`  To:      ${destination}`);
console.log(`  From:    ${twilio.fromKind === 'messaging_service' ? 'Messaging Service' : 'number'} ${maskAddress(twilio.from)}`);
console.log(`  Account: ${maskAddress(twilio.accountSid)}`);
console.log(`  Body:    ${body}`);
console.log(`  Length:  ${body.length} characters`);
console.log('');
console.log('Before you confirm, two things that make a send look successful when it is not:');
console.log('');
console.log('  1. On a TRIAL account, Twilio only delivers to a Verified Caller ID.');
console.log('     Verify this number in the Twilio console first, or it will not arrive.');
console.log('     Trial messages also carry a "Sent from your Twilio trial account" prefix.');
console.log('');
console.log('  2. Without A2P 10DLC registration, US carriers drop the message themselves.');
console.log('     Twilio still returns status "queued" or "sent". The handset gets nothing');
console.log('     and no error comes back. Watch the final status below, not the first one.');
console.log('');
console.log('  Registration takes 10-15 days. Do not start it for this build.');
console.log('  See wiki/facts/sms-delivery-constraints.md.');
console.log('');

if (!assumeYes) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question('Send it? Type y to continue: ')).trim().toLowerCase();
  rl.close();
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\nNothing sent.\n');
    process.exit(0);
  }
}

// --- Send --------------------------------------------------------------------

const auth = `Basic ${btoa(`${twilio.accountSid}:${twilio.authToken}`)}`;
const messagesUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilio.accountSid)}/Messages.json`;

const form = new URLSearchParams({ To: destination, Body: body });
if (twilio.fromKind === 'messaging_service') form.set('MessagingServiceSid', twilio.from);
else form.set('From', twilio.from);

console.log('\nSending...');

type TwilioMessage = {
  sid?: string;
  status?: string;
  error_code?: number | null;
  error_message?: string | null;
  message?: string;
  code?: number;
  more_info?: string;
};

let res: Response;
try {
  res = await fetch(messagesUrl, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
} catch (err) {
  fail(
    `Could not reach Twilio: ${err instanceof Error ? err.message : String(err)}\n` +
      'Check your network and run this again.',
    2,
  );
}

const created = ((await res.json().catch(() => null)) ?? {}) as TwilioMessage;

if (!res.ok) {
  fail(
    `Twilio rejected the request (HTTP ${res.status}${created.code ? `, code ${created.code}` : ''}).\n` +
      `${created.message ?? 'No detail returned.'}\n` +
      (created.more_info ? `${created.more_info}\n` : '') +
      (created.code === 21608
        ? '\nCode 21608 means this is a trial account and the number is not a Verified Caller ID.\n' +
          'Verify it in the Twilio console under Phone Numbers > Verified Caller IDs, then run this again.'
        : ''),
    2,
  );
}

const sid = created.sid;
console.log('');
console.log(`  SID:    ${sid ?? '(none returned)'}`);
console.log(`  Status: ${created.status ?? '(none returned)'}`);

// --- Follow the status -------------------------------------------------------
// "queued" only means Twilio accepted it. The carrier verdict lands a few
// seconds later, and it is the only status worth reporting to the team.

if (sid) {
  const statusUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilio.accountSid)}/Messages/${sid}.json`;
  let last = created.status ?? '';
  const terminal = new Set(['delivered', 'undelivered', 'failed', 'received']);

  for (let attempt = 0; attempt < 6 && !terminal.has(last); attempt += 1) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(statusUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!poll || !poll.ok) break;
    const current = ((await poll.json().catch(() => null)) ?? {}) as TwilioMessage;
    if (current.status && current.status !== last) {
      last = current.status;
      console.log(`  Status: ${last}`);
    }
    if (current.error_code) {
      console.log(`  Error:  ${current.error_code} ${current.error_message ?? ''}`);
    }
  }

  console.log('');
  if (last === 'delivered') {
    console.log('Delivered. Confirm on the handset, then record it in the session log.');
  } else if (last === 'undelivered' || last === 'failed') {
    console.log(
      'The carrier did not deliver this. Check the error code above in the Twilio console.\n' +
        'If the code is 30032 or 30034, it is the A2P 10DLC block described in\n' +
        'wiki/facts/sms-delivery-constraints.md. Do not register; use the magic link instead.',
    );
  } else {
    console.log(
      `Twilio still reports "${last}". It has not confirmed delivery.\n` +
        'Check the handset, then check the message in the Twilio console before claiming it arrived.',
    );
  }
}

console.log('');
