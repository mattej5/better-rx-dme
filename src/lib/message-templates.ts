/**
 * Message templates — specs/engine.md §3.2.
 *
 * PURE. No I/O, no DB, no network, no Date.now(). Give it a template id and a
 * bag of strings, get a rendered message back. `sendMessage()` (N2) owns the
 * transport; this file owns the words.
 *
 * Voice rules (graded — specs/engine.md §3.2, CLAUDE.md "grandma rule"):
 *   - Plain language. Every user is a first-time user; a dispatcher reads this
 *     in a truck with one hand on the wheel.
 *   - Headlines name the thing. CTAs are verb + object, three words or fewer.
 *   - Never: "per our records", "as previously communicated",
 *     "we apologize for any inconvenience". See BANNED_PHRASES / checkVoice().
 *   - Death-adjacent copy is calm: state the fact plainly, no euphemism, no
 *     drama, and lead with what the reader has to DO.
 *
 * Missing required vars are a LOUD failure (TemplateRenderError). A template
 * that renders "Needed before undefined" in front of a judge is worse than one
 * that refuses to render.
 */

/** Pinned. Matches the `template` field of sendMessage() in specs/engine.md §3.1. */
export type TemplateId =
  | 'vendor_notify'
  | 'vendor_nudge'
  | 'vendor_pickup'
  | 'vendor_ack'
  | 'family_delivery'
  | 'family_pickup'
  | 'family_failure_recovery';

export const TEMPLATE_IDS = [
  'vendor_notify',
  'vendor_nudge',
  'vendor_pickup',
  'vendor_ack',
  'family_delivery',
  'family_pickup',
  'family_failure_recovery',
] as const satisfies readonly TemplateId[];

export type TemplateAudience = 'vendor' | 'family';

export type RenderedMessage = {
  template: TemplateId;
  /** Email subject / push title. Ignored by SMS transport. */
  subject: string;
  /** The message itself. This is what goes down the wire. */
  body: string;
  /** Email button label. Verb + object, <= 3 words. Empty when there is no link. */
  cta: string;
  chars: number;
  /**
   * SMS encoding the BODY forces. One non-GSM-7 character (a curly quote, an em
   * dash, an emoji) drops the whole message to UCS-2 and the segment size from
   * 160 to 70 — so vendor bodies are deliberately written in GSM-7 only.
   */
  encoding: 'GSM-7' | 'UCS-2';
  /** GSM-7: 160 for a single part, 153 per concatenated part. UCS-2: 70 / 67. */
  smsSegments: number;
};

export type TemplateVars = Record<string, string>;

export type TemplateMeta = {
  id: TemplateId;
  audience: TemplateAudience;
  /** Transport the copy was written for. The seam still accepts either channel. */
  primaryChannel: 'sms' | 'email';
  /**
   * false = written and tested, but deliberately NOT wired to anything in v1.
   * See WIRED_IN_V1 note below.
   */
  wiredInV1: boolean;
  requiredVars: readonly string[];
  optionalVars: readonly string[];
};

/**
 * v1 WIRING — specs/engine.md addendum #8 (Vin, 8/14 late):
 *   "~~Family time-change notices~~ — CUT. No family-facing comms in v1;
 *    family status link stays P2 stretch."
 *
 * This CONTRADICTS §1.4, which still lists a family `sendMessage()` inside the
 * death fan-out. Resolved in favour of the addendum (later, and named an owner):
 * the three `family_*` templates below are implemented as pure render functions
 * — the copy is already approved and costs nothing to keep — but NOTHING calls
 * them in v1. The fan-out lane (T7) must not wire them. If the call is
 * reversed, flip `wiredInV1` and the fan-out gets them for free.
 */

export class TemplateRenderError extends Error {
  readonly template: string;
  readonly missing: string[];

  constructor(template: string, missing: string[], detail?: string) {
    const head = `Cannot render template "${template}"`;
    super(
      missing.length > 0
        ? `${head}: missing required vars [${missing.join(', ')}]${detail ? ` — ${detail}` : ''}`
        : `${head}${detail ? `: ${detail}` : ''}`,
    );
    this.name = 'TemplateRenderError';
    this.template = template;
    this.missing = missing;
  }
}

/** Phrases that must never appear in outbound copy (specs/engine.md §3.2). */
export const BANNED_PHRASES = [
  'per our records',
  'as previously communicated',
  'we apologize for any inconvenience',
  'we apologise for any inconvenience',
] as const;

/**
 * Voice guard. Run against STATIC template output in the check script, not on
 * every render — an interpolated vendor free-text var containing a banned
 * phrase must not blow up a live send.
 */
export function checkVoice(text: string): string[] {
  const haystack = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => haystack.includes(p));
}

// --- Nudge bodies ------------------------------------------------------------

/**
 * Ladder steps that actually put an SMS in front of the vendor. Steps 4 and 5
 * are internal (nurse banner / DON escalation, backup-vendor offer) and have no
 * vendor template — see nudge-ladder.ts.
 *
 * Escalating in SPECIFICITY, never in temper. Step 1 is a friendly check-in.
 * Step 2 names the deadline and asks for a one-word answer. Step 3 names the
 * deadline hard, says how long is left, and states the consequence as a fact.
 */
export type NudgeStep = 1 | 2 | 3;

export const NUDGE_STEPS = [1, 2, 3] as const satisfies readonly NudgeStep[];

function isNudgeStep(n: number): n is NudgeStep {
  return n === 1 || n === 2 || n === 3;
}

const NUDGE_COPY: Record<NudgeStep, (v: TemplateVars) => { subject: string; body: string; cta: string }> = {
  1: (v) => ({
    subject: `Still need a time - ${v.item_short}, ${v.area}`,
    body:
      `${v.hospice} here, checking on the ${v.item_short} for ${v.area}. ` +
      `Needed before ${v.needed_by}. Tap to confirm: ${v.link} ` +
      `Or reply with a time.`,
    cta: 'Confirm a time',
  }),
  2: (v) => ({
    subject: `${v.item_short} due ${v.needed_by} - need a time`,
    body:
      `${v.hospice}: the ${v.item_short} for ${v.area} has to be there before ${v.needed_by}. ` +
      `Reply YES if you've got it, or reply with a time. ${v.link}`,
    cta: 'Confirm a time',
  }),
  3: (v) => ({
    subject: `${v.item_short}, ${v.area} - ${v.time_left} to the ${v.needed_by} deadline`,
    body:
      `${v.hospice}: ${v.item_short}, ${v.area}. Hard deadline ${v.needed_by}, ` +
      `${v.time_left} from now. We have no time from you yet. Reply YES or a time, ` +
      `or we offer this to another supplier. ${v.link}`,
    cta: 'Confirm a time',
  }),
};

// --- Registry ----------------------------------------------------------------

type TemplateDef = TemplateMeta & {
  /** Extra required vars that only apply for certain var values (e.g. nudge step 3). */
  conditionalRequired?: (vars: TemplateVars) => readonly string[];
  render: (vars: TemplateVars) => { subject: string; body: string; cta: string };
};

const REGISTRY: Record<TemplateId, TemplateDef> = {
  vendor_notify: {
    id: 'vendor_notify',
    audience: 'vendor',
    primaryChannel: 'sms',
    wiredInV1: true,
    requiredVars: ['hospice', 'item_summary', 'area', 'needed_by', 'link'],
    optionalVars: [],
    render: (v) => ({
      subject: `New order - ${v.item_summary}, needed before ${v.needed_by}`,
      body:
        `New order from ${v.hospice}. ${v.item_summary} for a patient in ${v.area}. ` +
        `Needed before ${v.needed_by}. Tap to confirm: ${v.link} ` +
        `Or reply with a time.`,
      cta: 'Confirm a time',
    }),
  },

  vendor_nudge: {
    id: 'vendor_nudge',
    audience: 'vendor',
    primaryChannel: 'sms',
    wiredInV1: true,
    requiredVars: ['ladder_step', 'hospice', 'item_short', 'area', 'needed_by', 'link'],
    optionalVars: ['time_left'],
    conditionalRequired: (v) => (v.ladder_step === '3' ? ['time_left'] : []),
    render: (v) => {
      const step = Number(v.ladder_step);
      if (!Number.isInteger(step) || !isNudgeStep(step)) {
        throw new TemplateRenderError(
          'vendor_nudge',
          [],
          `ladder_step must be "1", "2" or "3" (steps 4 and 5 send no vendor message); got "${v.ladder_step}"`,
        );
      }
      return NUDGE_COPY[step](v);
    },
  },

  /**
   * Follows a patient death. Calm, plain, no euphemism, no drama. Leads with
   * the action, then states the fact. Oxygen gets the hazmat line (§1.4).
   */
  vendor_pickup: {
    id: 'vendor_pickup',
    audience: 'vendor',
    primaryChannel: 'sms',
    wiredInV1: true,
    requiredVars: ['address', 'items', 'notified_at', 'link'],
    optionalVars: ['family_note', 'oxygen'],
    render: (v) => {
      const parts = [
        `Pickup needed at ${v.address}.`,
        `The patient there has passed away.`,
        `Ready now: ${v.items}.`,
        `Notified ${v.notified_at}.`,
      ];
      if (v.family_note) parts.push(`Family asks: ${v.family_note}.`);
      if (v.oxygen === 'true') {
        parts.push('Oxygen on this stop, send a hazmat-certified driver.');
      }
      parts.push(`Address and details: ${v.link}`);
      return {
        subject: `Pickup needed - ${v.address}`,
        body: parts.join(' '),
        cta: 'See the stop',
      };
    },
  },

  /**
   * The reply the vendor gets back after we read their message. Closes the loop
   * on the vendor's phone: what we understood, or that a person is taking it.
   * `outcome` names which of the three endings the inbound path reached, so the
   * words still live here rather than in the call site. `detail` is the one
   * plain sentence naming what was recorded, required only when we acted.
   */
  vendor_ack: {
    id: 'vendor_ack',
    audience: 'vendor',
    primaryChannel: 'sms',
    wiredInV1: true,
    requiredVars: ['outcome'],
    optionalVars: ['detail'],
    conditionalRequired: (v) => (v.outcome === 'applied' ? ['detail'] : []),
    render: (v) => {
      if (v.outcome === 'applied') {
        return { subject: 'Got it', body: `Understood. ${v.detail}`, cta: '' };
      }
      if (v.outcome === 'held') {
        return {
          subject: 'Got it',
          body: 'Thanks. A nurse will confirm before anything changes on the order.',
          cta: '',
        };
      }
      return {
        subject: 'Got it',
        body: 'We could not read a time in that. A nurse will follow up.',
        cta: '',
      };
    },
  },

  // --- family_* : NOT WIRED IN V1 (addendum #8). Rendered, never sent. -------

  family_delivery: {
    id: 'family_delivery',
    audience: 'family',
    primaryChannel: 'email',
    wiredInV1: false,
    requiredVars: ['item', 'window_start', 'window_end'],
    optionalVars: ['phone'],
    render: (v) => ({
      subject: `Your ${v.item} arrives today`,
      body:
        `Your ${v.item} arrives today between ${v.window_start} and ${v.window_end}.` +
        (v.phone ? ` If no one can be there, call us at ${v.phone}.` : ''),
      cta: '',
    }),
  },

  family_pickup: {
    id: 'family_pickup',
    audience: 'family',
    primaryChannel: 'email',
    wiredInV1: false,
    requiredVars: ['item'],
    optionalVars: [],
    render: (v) => ({
      subject: 'Equipment pickup, nothing needed from you',
      body:
        `We've asked the equipment company to pick up the ${v.item}. ` +
        `They'll call you to pick a time. You don't need to do anything.`,
      cta: '',
    }),
  },

  family_failure_recovery: {
    id: 'family_failure_recovery',
    audience: 'family',
    primaryChannel: 'email',
    wiredInV1: false,
    requiredVars: ['relation', 'item', 'status'],
    optionalVars: ['callback_window'],
    render: (v) => ({
      subject: `Update on your ${v.relation}'s ${v.item}`,
      body:
        `Your ${v.relation}'s ${v.item} is running late, and you deserve to hear that ` +
        `from us rather than find out at the door. We've already put a second supplier on it. ` +
        `Here's what we know right now: ${v.status}. ` +
        `Someone from our team will call you within ${v.callback_window ?? 'the hour'}.`,
      cta: '',
    }),
  },
};

// --- Public API --------------------------------------------------------------

export function isTemplateId(id: string): id is TemplateId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, id);
}

export function templateMeta(template: TemplateId): TemplateMeta {
  const def = REGISTRY[template];
  return {
    id: def.id,
    audience: def.audience,
    primaryChannel: def.primaryChannel,
    wiredInV1: def.wiredInV1,
    requiredVars: def.requiredVars,
    optionalVars: def.optionalVars,
  };
}

export function allTemplateMeta(): TemplateMeta[] {
  return TEMPLATE_IDS.map(templateMeta);
}

/** GSM 03.38 basic set + the escape-table extras (which cost 2 septets each). */
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';

/** GSM-7 septet cost, or null if the text cannot be encoded in GSM-7 at all. */
function gsmSeptets(text: string): number | null {
  let septets = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) septets += 1;
    else if (GSM_EXTENDED.includes(ch)) septets += 2;
    else return null;
  }
  return septets;
}

export function smsEncoding(body: string): 'GSM-7' | 'UCS-2' {
  return gsmSeptets(body) === null ? 'UCS-2' : 'GSM-7';
}

/** Concatenated SMS parts carry a 7-byte UDH, hence 153 (GSM-7) / 67 (UCS-2). */
export function smsSegments(body: string): number {
  if (body.length === 0) return 0;
  const septets = gsmSeptets(body);
  if (septets === null) {
    return body.length <= 70 ? 1 : Math.ceil(body.length / 67);
  }
  return septets <= 160 ? 1 : Math.ceil(septets / 153);
}

/**
 * Render a template. Throws TemplateRenderError if a required var is missing,
 * blank, or if the template id is unknown. There is no silent fallback.
 */
export function renderTemplate(template: TemplateId, vars: TemplateVars): RenderedMessage {
  const def: TemplateDef | undefined = REGISTRY[template];
  if (!def) {
    throw new TemplateRenderError(String(template), [], 'unknown template id');
  }

  const required = [...def.requiredVars, ...(def.conditionalRequired?.(vars) ?? [])];
  const missing = required.filter((k) => {
    const value = vars[k];
    return typeof value !== 'string' || value.trim() === '';
  });
  if (missing.length > 0) {
    throw new TemplateRenderError(template, Array.from(new Set(missing)));
  }

  const { subject, body, cta } = def.render(vars);
  return {
    template,
    subject: subject.trim(),
    body: body.trim(),
    cta,
    chars: body.trim().length,
    encoding: smsEncoding(body.trim()),
    smsSegments: smsSegments(body.trim()),
  };
}

/** Convenience for callers that only want the wire body. */
export function renderBody(template: TemplateId, vars: TemplateVars): string {
  return renderTemplate(template, vars).body;
}
