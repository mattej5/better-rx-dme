/**
 * The `sendMessage()` seam — specs/engine.md §3.1, specs/00-contracts.md
 * "Comms transport".
 *
 * ONE call site for every outbound message in the product. Nothing else in the
 * app talks to Twilio or Resend. A call site says WHO and WHICH TEMPLATE; this
 * file decides HOW it goes out, from config plus `to.channel`. "Transport is a
 * config, not an architecture."
 *
 * Transport ladder:
 *   sms   -> Twilio (vendor channel)  -> Resend, only if the address is an
 *                                        email (ADR 0005 email-as-SMS)
 *                                     -> log_only
 *   email -> Resend                   -> log_only
 *
 * `log_only` is the demo safety net: missing credentials never produce a stack
 * trace in front of a judge. The message is still rendered, still written to
 * `messages`, still appended as `message_sent` — with `status:'logged'` so the
 * timeline says plainly that nothing left the building. We do not pretend a
 * send happened.
 *
 * Provider transport chosen with `fetch` against the REST APIs rather than the
 * `twilio` / `resend` npm packages: two POSTs do not justify two dependencies,
 * Node 26 and the Vercel runtime both have global fetch, and the Twilio SDK
 * pulls a large tree into a lambda that sends one form-encoded request.
 *
 * Writes, per specs/00-contracts.md:
 *   outbound -> `messages` row (direction 'out') + `message_sent`
 *   inbound  -> `messages` row (direction 'in')  + `message_received`
 * Those two event types are in the pinned union. No new event types are added.
 *
 * NUDGE MARKERS (amendment 9). Ladder state is derived by COUNTING
 * `message_sent` events carrying `payload.kind='nudge'` + `payload.ladder_step`.
 * A dropped marker re-fires that rung forever. The marker is never recomputed
 * here: it is taken from `opts.marker` (the `LadderStepPlan.marker` the ladder
 * already produced) or, failing that, read straight out of `vars.ladder_step`,
 * which is the same value the ladder wrote into the plan's `vars`.
 *
 * WHY NO `import 'server-only'`: this module is imported by
 * `scripts/send-test-sms.ts` under plain Node, where `server-only` throws. The
 * browser is blocked with a runtime guard instead, and every server-only
 * dependency (`events.ts`, `supabase.ts`) is loaded through a lazy `await
 * import(...)` at call time, so nothing server-only is pulled in until a real
 * write happens.
 */

import {
  renderTemplate,
  templateMeta,
  type RenderedMessage,
  type TemplateId,
  type TemplateVars,
} from './message-templates.ts';
import type { LadderStep } from './nudge-ladder.ts';
import type { Role } from './role.ts';

export type Channel = 'email' | 'sms';

export type Recipient = { channel: Channel; address: string; label: string };

/** Which wire the message actually went down. Recorded on every send. */
export type TransportName = 'twilio' | 'resend' | 'log_only' | 'dry_run';

/** What actually happened. `logged` and `dry_run` are NOT deliveries. */
export type SendStatus = 'sent' | 'failed' | 'logged' | 'dry_run';

export type NudgeMarker = { kind: 'nudge'; ladder_step: LadderStep };

export type Actor = { role: Role; userName: string };

/**
 * Automated sends have no human behind them. The pinned `Actor` role union has
 * no 'system' member and we are not widening it, so scheduled work is attributed
 * to the nurse role with an unmistakable name. Callers with a real session
 * should pass their own actor.
 */
export const SYSTEM_ACTOR: Actor = { role: 'nurse', userName: 'BetterRX (automatic)' };

export type SendOptions = {
  /** From `LadderStepPlan.marker`. Pass it through; never recompute it. */
  marker?: NudgeMarker;
  /** Session actor. Defaults to SYSTEM_ACTOR for engine-driven sends. */
  actor?: Actor;
  /** `messages.vendor_id`, when the recipient is a vendor. */
  vendorId?: string | null;
  /** Override the process config. Tests and the dry-run path use this. */
  config?: MessagingConfig;
};

export type SendResult = {
  messageId: string;
  transport: TransportName;
  status: SendStatus;
  /** false = the `messages` row / `message_sent` event were NOT written. */
  recorded: boolean;
  /** Provider-side id (Twilio SID, Resend id). null when nothing was sent. */
  providerId: string | null;
  body: string;
  /** The nudge marker written into the `message_sent` payload, if any. */
  marker: NudgeMarker | null;
};

// --- Config ------------------------------------------------------------------

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  /** Either a Messaging Service SID (MG...) or an E.164 number. */
  from: string;
  fromKind: 'messaging_service' | 'phone_number';
};

export type ResendConfig = { apiKey: string; from: string };

export type MessagingConfig = {
  twilio: TwilioConfig | null;
  resend: ResendConfig | null;
  /** MESSAGING_DRY_RUN=1. Renders and selects, sends nothing, writes nothing. */
  dryRun: boolean;
  /** Env var names that would enable a transport but are unset. Names only. */
  missing: string[];
};

const RESEND_DEFAULT_FROM = 'BetterRX DME <onboarding@resend.dev>';

function trimmed(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Read transport config from the environment. Never throws, never logs a
 * secret. `missing` carries variable NAMES so a failure message can tell a
 * human exactly what to set.
 */
export function readMessagingConfig(
  env: Record<string, string | undefined> = process.env,
): MessagingConfig {
  const missing: string[] = [];

  const accountSid = trimmed(env.TWILIO_ACCOUNT_SID);
  const authToken = trimmed(env.TWILIO_AUTH_TOKEN);
  // Either sender works. Messaging Service wins when both are present.
  const serviceSid = trimmed(env.TWILIO_MESSAGING_SERVICE_SID);
  const phoneNumber = trimmed(env.TWILIO_PHONE_NUMBER) || trimmed(env.TWILIO_FROM_NUMBER);

  let twilio: TwilioConfig | null = null;
  if (accountSid && authToken && (serviceSid || phoneNumber)) {
    twilio = serviceSid
      ? { accountSid, authToken, from: serviceSid, fromKind: 'messaging_service' }
      : { accountSid, authToken, from: phoneNumber, fromKind: 'phone_number' };
  } else {
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!serviceSid && !phoneNumber) {
      missing.push('TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER');
    }
  }

  const resendKey = trimmed(env.RESEND_API_KEY);
  const resend: ResendConfig | null = resendKey
    ? { apiKey: resendKey, from: trimmed(env.RESEND_FROM) || RESEND_DEFAULT_FROM }
    : null;
  if (!resendKey) missing.push('RESEND_API_KEY');

  const dryRunRaw = trimmed(env.MESSAGING_DRY_RUN).toLowerCase();
  const dryRun = dryRunRaw === '1' || dryRunRaw === 'true' || dryRunRaw === 'yes';

  return { twilio, resend, dryRun, missing };
}

// --- Transport selection -----------------------------------------------------

export type TransportChoice = {
  transport: TransportName;
  /** true = not the transport this channel wanted. Surfaced on the timeline. */
  degraded: boolean;
  /** One plain sentence. Goes into the event payload, so it must read well. */
  reason: string;
};

function looksLikeEmail(address: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim());
}

/**
 * NANP 555-01XX is the reserved fictional range, and it is what the seed mints
 * for synthetic vendors. Twilio rejects these with a 400, which would put a red
 * "failed" line on a judge-visible timeline for a number that was never real.
 * The address, not the config, is what makes this unsendable, so the decision
 * belongs here with the rest of the transport rules.
 */
export function isUnroutableNumber(address: string): boolean {
  return /^\+?1?\D*\d{3}\D*555\D*01\d{2}$/.test(address.trim());
}

/**
 * PURE. The whole transport decision, in one testable function. Call sites
 * never choose a transport; they state a channel and this picks the wire.
 */
export function selectTransport(
  channel: Channel,
  config: MessagingConfig,
  address = '',
): TransportChoice {
  if (config.dryRun) {
    return {
      transport: 'dry_run',
      degraded: true,
      reason: 'MESSAGING_DRY_RUN is set. Nothing was sent and nothing was written.',
    };
  }

  if (channel === 'sms') {
    if (isUnroutableNumber(address)) {
      return {
        transport: 'log_only',
        degraded: true,
        reason:
          'This vendor has a synthetic phone number from the reserved 555-01XX range, ' +
          'so the message was recorded but not sent. A real number sends for real.',
      };
    }
    if (config.twilio) {
      return { transport: 'twilio', degraded: false, reason: 'Sent as SMS through Twilio.' };
    }
    // ADR 0005: Resend email standing in for SMS. Only possible if the address
    // is an email — you cannot email a phone number, and pretending otherwise
    // is exactly the silent failure the trial-account constraint warns about.
    if (config.resend && looksLikeEmail(address)) {
      return {
        transport: 'resend',
        degraded: true,
        reason: 'Twilio is not configured, so this went out as email standing in for SMS.',
      };
    }
    return {
      transport: 'log_only',
      degraded: true,
      reason: config.resend
        ? 'Twilio is not configured and this recipient has a phone number, not an email, so this was recorded but not sent.'
        : 'No SMS transport is configured, so this was recorded but not sent. Set the TWILIO_ vars to send it.',
    };
  }

  if (config.resend) {
    return { transport: 'resend', degraded: false, reason: 'Sent as email through Resend.' };
  }
  return {
    transport: 'log_only',
    degraded: true,
    reason: 'Resend is not configured, so this was recorded but not sent.',
  };
}

// --- Providers ---------------------------------------------------------------

type ProviderResult = {
  ok: boolean;
  providerId: string | null;
  providerStatus: string | null;
  error: string | null;
};

const PROVIDER_TIMEOUT_MS = 15_000;

async function sendViaTwilio(
  cfg: TwilioConfig,
  to: string,
  body: string,
): Promise<ProviderResult> {
  const form = new URLSearchParams({ To: to, Body: body });
  if (cfg.fromKind === 'messaging_service') form.set('MessagingServiceSid', cfg.from);
  else form.set('From', cfg.from);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      },
    );
    const json: unknown = await res.json().catch(() => null);
    const data = (json ?? {}) as { sid?: string; status?: string; message?: string; code?: number };
    if (!res.ok) {
      return {
        ok: false,
        providerId: null,
        providerStatus: null,
        error: `Twilio ${res.status}${data.code ? ` (${data.code})` : ''}: ${data.message ?? 'no detail'}`,
      };
    }
    return {
      ok: true,
      providerId: data.sid ?? null,
      providerStatus: data.status ?? null,
      error: null,
    };
  } catch (err) {
    return { ok: false, providerId: null, providerStatus: null, error: describeError(err) };
  }
}

async function sendViaResend(
  cfg: ResendConfig,
  to: string,
  rendered: RenderedMessage,
): Promise<ProviderResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [to],
        subject: rendered.subject,
        text: rendered.body,
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    const json: unknown = await res.json().catch(() => null);
    const data = (json ?? {}) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return {
        ok: false,
        providerId: null,
        providerStatus: null,
        error: `Resend ${res.status}: ${data.message ?? data.name ?? 'no detail'}`,
      };
    }
    return { ok: true, providerId: data.id ?? null, providerStatus: 'queued', error: null };
  } catch (err) {
    return { ok: false, providerId: null, providerStatus: null, error: describeError(err) };
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.name === 'TimeoutError'
      ? `Provider did not answer within ${PROVIDER_TIMEOUT_MS / 1000}s.`
      : err.message;
  }
  return String(err);
}

// --- Persistence -------------------------------------------------------------

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Phone numbers and emails are masked in the event log; the full address lives
 *  in `messages.to_addr`, which is the column for it. */
export function maskAddress(address: string): string {
  const a = address.trim();
  if (looksLikeEmail(a)) {
    const [user, domain] = a.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return a.length <= 4 ? '***' : `***${a.slice(-4)}`;
}

type MessageRow = {
  order_id: string;
  vendor_id: string | null;
  direction: 'out' | 'in';
  channel: Channel;
  to_addr: string | null;
  body: string;
  parsed: Json | null;
};

/** Insert a `messages` row. Returns the row id, or null if Supabase is unset. */
async function insertMessage(row: MessageRow): Promise<string | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { supabase } = await import('./supabase.ts');
  const { data, error } = await supabase
    .from('messages')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Append through the engine lane's primitive. `appendEvent` also re-derives
 * `orders.status` from the log, which is why we never touch `orders` here.
 */
async function append(
  orderId: string,
  type: 'message_sent' | 'message_received',
  payload: Json,
  actor: Actor,
): Promise<void> {
  const { appendEvent } = await import('./events.ts');
  await appendEvent(orderId, type, payload, actor);
}

// --- The seam ----------------------------------------------------------------

function assertServer(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'sendMessage() runs on the server only — it holds provider credentials. ' +
        'Call it from a server action or a route handler.',
    );
  }
}

/**
 * Resolve the nudge marker WITHOUT recomputing it (amendment 9).
 * Priority: the caller's plan marker, then `vars.ladder_step`, which the ladder
 * itself wrote into `LadderStepPlan.vars`. Both are pass-through reads.
 */
function resolveMarker(
  template: TemplateId,
  vars: TemplateVars,
  explicit: NudgeMarker | undefined,
): NudgeMarker | null {
  if (explicit) return explicit;
  if (template !== 'vendor_nudge') return null;
  const step = Number(vars.ladder_step);
  if (!Number.isInteger(step) || step < 1 || step > 5) return null;
  return { kind: 'nudge', ladder_step: step as LadderStep };
}

/**
 * Send one message. The only outbound path in the product.
 *
 * Signature is pinned (specs/engine.md §3.1). `opts` is an additive second
 * argument: any call site written against the pinned one-argument form keeps
 * working, and ladder callers use it to hand the step marker through.
 *
 * Never throws on a provider failure — a dead Twilio must not take down an
 * order flow. Failures are recorded as `message_sent` with `status:'failed'`
 * and the reason, so the timeline tells the truth and the ladder rung is still
 * marked (an unmarked rung re-fires forever).
 */
export async function sendMessage(
  m: {
    orderId: string;
    to: { channel: Channel; address: string; label: string };
    template: TemplateId;
    vars: Record<string, string>;
  },
  opts: SendOptions = {},
): Promise<SendResult> {
  assertServer();

  const config = opts.config ?? readMessagingConfig();
  const rendered = renderTemplate(m.template, m.vars);
  const choice = selectTransport(m.to.channel, config, m.to.address);
  const marker = resolveMarker(m.template, m.vars, opts.marker);

  const meta = templateMeta(m.template);
  if (!meta.wiredInV1) {
    console.warn(
      `[messaging] template "${m.template}" is marked wiredInV1:false (family comms are cut in v1) but was sent anyway.`,
    );
  }

  // --- dry run: render + select only. No network, no database. --------------
  if (choice.transport === 'dry_run') {
    console.warn(
      `[messaging] DRY RUN — nothing sent, nothing written. ` +
        `template=${m.template} channel=${m.to.channel} to=${maskAddress(m.to.address)} ` +
        `wouldUse=${selectTransport(m.to.channel, { ...config, dryRun: false }, m.to.address).transport}`,
    );
    return {
      messageId: `dryrun:${m.orderId}:${m.template}`,
      transport: 'dry_run',
      status: 'dry_run',
      recorded: false,
      providerId: null,
      body: rendered.body,
      marker,
    };
  }

  let provider: ProviderResult = { ok: false, providerId: null, providerStatus: null, error: null };
  let status: SendStatus;

  if (choice.transport === 'twilio' && config.twilio) {
    provider = await sendViaTwilio(config.twilio, m.to.address, rendered.body);
    status = provider.ok ? 'sent' : 'failed';
  } else if (choice.transport === 'resend' && config.resend) {
    provider = await sendViaResend(config.resend, m.to.address, rendered);
    status = provider.ok ? 'sent' : 'failed';
  } else {
    status = 'logged';
    console.warn(
      `[messaging] NOT SENT (${choice.reason}) to=${maskAddress(m.to.address)} body=${rendered.body}`,
    );
  }

  if (status === 'failed') {
    console.error(`[messaging] send failed via ${choice.transport}: ${provider.error}`);
  }

  const payload: Json = {
    template: m.template,
    channel: m.to.channel,
    to_label: m.to.label,
    to_masked: maskAddress(m.to.address),
    transport: choice.transport,
    transport_reason: choice.reason,
    degraded: choice.degraded,
    status,
    provider_id: provider.providerId,
    provider_status: provider.providerStatus,
    error: provider.error,
    subject: rendered.subject,
    body: rendered.body,
    chars: rendered.chars,
    encoding: rendered.encoding,
    sms_segments: rendered.smsSegments,
    ...(marker ? { kind: marker.kind, ladder_step: marker.ladder_step } : {}),
  };

  let messageId: string | null = null;
  let recorded = false;
  try {
    messageId = await insertMessage({
      order_id: m.orderId,
      vendor_id: opts.vendorId ?? null,
      direction: 'out',
      channel: m.to.channel,
      to_addr: m.to.address,
      body: rendered.body,
      parsed: null,
    });
    if (messageId !== null) {
      await append(m.orderId, 'message_sent', payload, opts.actor ?? SYSTEM_ACTOR);
      recorded = true;
    } else {
      console.warn(
        '[messaging] Supabase is not configured, so this message was not recorded. ' +
          'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist messages and events.',
      );
    }
  } catch (err) {
    // A recording failure must not take down the send path mid-demo, but it is
    // never reported as success.
    console.error(`[messaging] could not record message: ${describeError(err)}`);
  }

  return {
    messageId: messageId ?? `unrecorded:${m.orderId}:${Date.now()}`,
    transport: choice.transport,
    status,
    recorded,
    providerId: provider.providerId,
    body: rendered.body,
    marker,
  };
}

/**
 * Inbound half of the seam — specs/engine.md §3.3. Writes a `messages` row
 * (direction 'in') and appends `message_received`. The demo panel's simulated
 * inbox and a real Twilio webhook both land here; parsing is
 * `parseVendorReply()`'s job and its result is passed in as `parsed`.
 */
export async function receiveMessage(m: {
  orderId: string;
  from: { channel: Channel; address: string; label?: string };
  body: string;
  vendorId?: string | null;
  parsed?: Json | null;
  actor?: Actor;
}): Promise<{ messageId: string; recorded: boolean }> {
  assertServer();

  const payload: Json = {
    channel: m.from.channel,
    from_label: m.from.label ?? null,
    from_masked: maskAddress(m.from.address),
    body: m.body,
    parsed: m.parsed ?? null,
  };

  let messageId: string | null = null;
  let recorded = false;
  try {
    messageId = await insertMessage({
      order_id: m.orderId,
      vendor_id: m.vendorId ?? null,
      direction: 'in',
      channel: m.from.channel,
      to_addr: m.from.address,
      body: m.body,
      parsed: m.parsed ?? null,
    });
    if (messageId !== null) {
      await append(m.orderId, 'message_received', payload, m.actor ?? SYSTEM_ACTOR);
      recorded = true;
    } else {
      console.warn(
        '[messaging] Supabase is not configured, so this inbound message was not recorded. ' +
          'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
  } catch (err) {
    console.error(`[messaging] could not record inbound message: ${describeError(err)}`);
  }

  return { messageId: messageId ?? `unrecorded:${m.orderId}:${Date.now()}`, recorded };
}

/**
 * Human-readable transport report for the demo panel and the test script.
 * Names only — never a credential value.
 */
export function describeTransports(config: MessagingConfig = readMessagingConfig()): {
  dryRun: boolean;
  twilioConfigured: boolean;
  resendConfigured: boolean;
  missing: string[];
  sms: TransportChoice;
  /** channel 'sms' where the vendor record holds an email — the ADR 0005 path. */
  smsToEmail: TransportChoice;
  email: TransportChoice;
} {
  return {
    dryRun: config.dryRun,
    twilioConfigured: config.twilio !== null,
    resendConfigured: config.resend !== null,
    missing: config.missing,
    sms: selectTransport('sms', config, '+15555550123'),
    smsToEmail: selectTransport('sms', config, 'dispatch@example.com'),
    email: selectTransport('email', config, 'dispatch@example.com'),
  };
}
