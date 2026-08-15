/**
 * parseVendorReply() — deterministic first, LLM second (specs/engine.md §3.4).
 *
 * This file currently contains PASS 1 ONLY: the regex baseline.
 *
 * The regex pass is a MEASUREMENT, not a product. It is implemented exactly as
 * specs/engine.md §3.4 writes it, including the places where it is wrong:
 *   - `ok` is scored `confirm` at 0.99, which is overconfident.
 *   - `no problem` is scored `decline` at 0.95, which is backwards.
 * Those failures are the deliverable. `npm run eval:parse` reports them.
 * Do not add cases to make more fixtures pass.
 */

export type ParseIntent =
  | 'confirm'
  | 'decline'
  | 'eta'
  | 'delay'
  | 'question'
  | 'unknown';

export type ParseResult = {
  intent: ParseIntent;
  eta?: string; // ISO, or a relative marker (+Nm / +Nh) when the reply states a duration
  reason?: string; // free text, for decline/delay
  confidence: number; // 0–1
  method: 'regex' | 'llm';
};

export type OrderContext = {
  orderId: string;
  item: string;
  patientArea: string;
  /** ISO. The order's date; wall-clock times in a reply resolve against this date. */
  neededBy: string;
  urgency: 'admission' | 'routine' | 'stat';
  vendorName: string;
  timezone?: string;
};

/** Single hospice timezone, pinned in specs/engine.md §7.4. */
export const HOSPICE_TIMEZONE = 'America/Denver';

/** Below this, no state change: the parse goes to a nurse to confirm (§3.4). */
export const ACTION_CONFIDENCE_GATE = 0.75;

// --- The four regexes, verbatim from specs/engine.md §3.4 ---------------------

const CONFIRM_RE = /^\s*(y|yes|yep|ok|okay|confirmed?|👍|10-4)\b/i;
const DECLINE_RE = /^\s*(n|no|nope|can'?t|cannot|unable|decline)\b/i;
const ETA_CLOCK_RE = /\b(eta|by|around|at)?\s*(\d{1,2})(:(\d{2}))?\s*(am|pm)\b/i;
const ETA_RELATIVE_RE = /\bin\s+(\d+)\s*(min|minutes|hr|hour|hours)\b/i;

const CONFIRM_CONFIDENCE = 0.99;
const DECLINE_CONFIDENCE = 0.95;
const ETA_CONFIDENCE = 0.9;

/** Above this word count with no clean match, hand off rather than trust the regex. */
const CLEAN_MATCH_WORD_LIMIT = 12;

// --- Time resolution ---------------------------------------------------------

function pad(n: number, width = 2): string {
  return String(Math.abs(n)).padStart(width, '0');
}

const PART_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: HOSPICE_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClockIn(instant: Date): WallClock {
  const parts = PART_FORMATTER.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Minutes the hospice timezone is offset from UTC at `instant` (-360 for MDT). */
function offsetMinutesAt(instant: Date): number {
  const w = wallClockIn(instant);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return (asIfUtc - instant.getTime()) / 60_000;
}

function offsetSuffix(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  return `${sign}${pad(Math.trunc(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`;
}

/** ISO timestamp for a wall-clock time on a given date in the hospice timezone. */
function isoAtHospiceWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = offsetMinutesAt(new Date(naive));
  offset = offsetMinutesAt(new Date(naive - offset * 60_000));
  return (
    `${pad(year, 4)}-${pad(month)}-${pad(day)}` +
    `T${pad(hour)}:${pad(minute)}:00${offsetSuffix(offset)}`
  );
}

function to24Hour(hour: number, meridiem: string): number {
  const isPm = meridiem.toLowerCase() === 'pm';
  if (hour === 12) return isPm ? 12 : 0;
  if (hour > 12) return hour;
  return isPm ? hour + 12 : hour;
}

// --- Extraction --------------------------------------------------------------

function extractEta(message: string, orderContext: OrderContext): string | undefined {
  const clock = ETA_CLOCK_RE.exec(message);
  if (clock) {
    const hour = to24Hour(Number(clock[2]), clock[5]);
    const minute = clock[4] ? Number(clock[4]) : 0;
    const orderDay = wallClockIn(new Date(orderContext.neededBy));
    return isoAtHospiceWallClock(orderDay.year, orderDay.month, orderDay.day, hour, minute);
  }

  const relative = ETA_RELATIVE_RE.exec(message);
  if (relative) {
    const unit = relative[2].toLowerCase().startsWith('h') ? 'h' : 'm';
    return `+${Number(relative[1])}${unit}`;
  }

  return undefined;
}

function wordCount(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

// --- Pass 1 ------------------------------------------------------------------

/**
 * The deterministic baseline. Zero cost, ~0.1ms, no network.
 * Reported as its own column in `npm run eval:parse` — this is the number the
 * hybrid has to beat for the AI ROI claim to mean anything.
 */
export function parseWithRegex(message: string, orderContext: OrderContext): ParseResult {
  const eta = extractEta(message, orderContext);

  if (CONFIRM_RE.test(message)) {
    // Bare confirm + time ("yes, 3pm") → confirm WITH eta.
    return eta
      ? { intent: 'confirm', eta, confidence: CONFIRM_CONFIDENCE, method: 'regex' }
      : { intent: 'confirm', confidence: CONFIRM_CONFIDENCE, method: 'regex' };
  }

  if (DECLINE_RE.test(message)) {
    return { intent: 'decline', confidence: DECLINE_CONFIDENCE, method: 'regex' };
  }

  if (eta) {
    return { intent: 'eta', eta, confidence: ETA_CONFIDENCE, method: 'regex' };
  }

  return { intent: 'unknown', confidence: 0, method: 'regex' };
}

/**
 * §3.4: fall through if pass 1 returned `unknown`, or if the message is longer
 * than 12 words and so any regex hit is more likely incidental than clean.
 */
export function needsLlmFallback(message: string, regexResult: ParseResult): boolean {
  return regexResult.intent === 'unknown' || wordCount(message) > CLEAN_MATCH_WORD_LIMIT;
}

// --- The seam ----------------------------------------------------------------

/**
 * The one place an LLM is allowed to touch this system (ADR 0003).
 * Provider-agnostic by contract (specs/00-contracts.md, "Comms transport") —
 * no SDK import, no API key read, no network call lives above this line.
 */
export async function parseVendorReply(
  message: string,
  orderContext: OrderContext,
): Promise<ParseResult> {
  const regexResult = parseWithRegex(message, orderContext);

  if (!needsLlmFallback(message, regexResult)) {
    return regexResult;
  }

  // N4 part 2: LLM fallback slots in here.
  // Until it lands, the regex result stands and the eval reports the baseline
  // honestly rather than a fabricated hybrid number.
  return regexResult;
}
