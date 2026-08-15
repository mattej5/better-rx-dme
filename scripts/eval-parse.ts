/**
 * npm run eval:parse — the AI ROI evidence for deliverable B (specs/engine.md §6).
 *
 * Runs all 24 fixtures twice: regex-only (the baseline) and the hybrid parser.
 * The hybrid pass makes one real API call per fall-through case, so it only runs
 * when ANTHROPIC_API_KEY is set. Without a key the HYBRID column reads n/a and
 * no hybrid score, cost, or timing is printed — an unmeasured number is worse
 * than no number. The regex baseline is real either way.
 *
 * Every hybrid cost figure here is summed from token counts read off the API
 * responses. Nothing is taken from the specs/engine.md 3.5 table.
 *
 * No test framework, no network mocking. Plain ASCII output — it gets pasted
 * into a slide.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ACTION_CONFIDENCE_GATE,
  parseWithRegex,
  parseVendorReply,
  type OrderContext,
  type ParseIntent,
  type ParseResult,
} from '../src/lib/parse-vendor-reply.ts';

// --- Fixtures ----------------------------------------------------------------

type Fixture = {
  id: string;
  group: string;
  message: string;
  orderContext: OrderContext;
  expected: {
    intent: ParseIntent;
    eta?: string;
    minConfidence: number;
  };
};

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, '..', 'evals', 'vendor-replies.json');

const fixtureFile = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as { cases: Fixture[] };
const cases = fixtureFile.cases;

// --- Hybrid availability -----------------------------------------------------

/** The LLM pass landed (N4 part 2). It still only runs with a key. */
const HYBRID_IMPLEMENTED = true;
const HAS_API_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const HYBRID_ACTIVE: boolean = HYBRID_IMPLEMENTED && HAS_API_KEY;

/** Exit-code gate from §6. Only enforced once the hybrid actually runs. */
const HYBRID_FLOOR = 20;

// --- Pass criteria -----------------------------------------------------------

/** ±5 minutes on absolute ETAs, per evals/vendor-replies.json _convention. */
const ETA_TOLERANCE_MS = 5 * 60 * 1000;

function isRelativeEta(eta: string): boolean {
  return /^\+\d+[mh]$/.test(eta);
}

function relativeEtaMinutes(eta: string): number {
  const n = Number(eta.slice(1, -1));
  return eta.endsWith('h') ? n * 60 : n;
}

function etaMatches(actual: string | undefined, expected: string | undefined): boolean {
  if (expected === undefined) return actual === undefined;
  if (actual === undefined) return false;

  if (isRelativeEta(expected) || isRelativeEta(actual)) {
    if (!isRelativeEta(expected) || !isRelativeEta(actual)) return false;
    return relativeEtaMinutes(actual) === relativeEtaMinutes(expected);
  }

  const a = Date.parse(actual);
  const e = Date.parse(expected);
  if (Number.isNaN(a) || Number.isNaN(e)) return false;
  return Math.abs(a - e) <= ETA_TOLERANCE_MS;
}

function passes(result: ParseResult, expected: Fixture['expected']): boolean {
  if (result.intent !== expected.intent) return false;
  if (result.confidence < expected.minConfidence) return false;
  // _convention.etaAbsent: no expected eta means none may be extracted. A parse
  // that invents a time fails even when the intent is right.
  if (!etaMatches(result.eta, expected.eta)) return false;
  return true;
}

// --- Rendering ---------------------------------------------------------------

function shortEta(eta: string): string {
  if (isRelativeEta(eta)) return eta;
  const parsed = Date.parse(eta);
  if (Number.isNaN(parsed)) return eta;
  const m = /T(\d{2}):(\d{2})/.exec(eta);
  return m ? `${m[1]}:${m[2]}` : eta;
}

function describeExpected(expected: Fixture['expected']): string {
  const parts: string[] = [expected.intent];
  if (expected.eta !== undefined) parts.push(`eta=${shortEta(expected.eta)}`);
  if (expected.intent === 'unknown') parts.push('(must not guess)');
  return parts.join(' ');
}

function describeActual(result: ParseResult): string {
  const parts = [`${result.intent}@${result.confidence.toFixed(2)}`];
  if (result.eta !== undefined) parts.push(`eta=${shortEta(result.eta)}`);
  return parts.join(' ');
}

const CASE_W = 32;
const COL_W = 10;
const RULE = '-'.repeat(78);

function row(caseId: string, regex: string, hybrid: string, expected: string): string {
  return (
    caseId.padEnd(CASE_W) + regex.padEnd(COL_W) + hybrid.padEnd(COL_W) + expected
  );
}

/**
 * Marginal inference cost of one parse. A regex parse costs nothing, and that
 * is a fact, not an estimate. An LLM parse costs whatever its measured token
 * counts cost — `result.usage.costUsd` is computed from the four counts read
 * off the response, not from the §3.5 table's assumed mix.
 */
function costUsd(result: ParseResult): number {
  if (result.method === 'regex') return 0;
  return result.usage?.costUsd ?? 0;
}

type TokenTotals = {
  input: number;
  cachedInput: number;
  cacheWrite: number;
  output: number;
  llmCalls: number;
};

function addUsage(totals: TokenTotals, result: ParseResult): void {
  if (result.method !== 'llm' || !result.usage) return;
  totals.llmCalls += 1;
  totals.input += result.usage.inputTokens;
  totals.cachedInput += result.usage.cachedInputTokens;
  totals.cacheWrite += result.usage.cacheWriteTokens;
  totals.output += result.usage.outputTokens;
}

function verdict(ok: boolean): string {
  return ok ? 'PASS' : 'FAIL';
}

function pct(n: number, total: number): string {
  return `${Math.round((n / total) * 100)}%`;
}

// --- Run ---------------------------------------------------------------------

type Outcome = {
  fixture: Fixture;
  regexResult: ParseResult;
  regexPass: boolean;
  hybridResult: ParseResult | null;
  hybridPass: boolean | null;
};

async function run(): Promise<void> {
  const outcomes: Outcome[] = [];

  const regexStart = performance.now();
  const regexResults = cases.map((c) => parseWithRegex(c.message, c.orderContext));
  const regexMs = performance.now() - regexStart;

  let hybridMs = 0;
  let hybridCostUsd = 0;
  const tokens: TokenTotals = {
    input: 0,
    cachedInput: 0,
    cacheWrite: 0,
    output: 0,
    llmCalls: 0,
  };
  const hybridStart = performance.now();
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const hybridResult = HYBRID_ACTIVE ? await parseVendorReply(c.message, c.orderContext) : null;
    if (hybridResult) {
      hybridCostUsd += costUsd(hybridResult);
      addUsage(tokens, hybridResult);
    }
    outcomes.push({
      fixture: c,
      regexResult: regexResults[i],
      regexPass: passes(regexResults[i], c.expected),
      hybridResult,
      hybridPass: hybridResult ? passes(hybridResult, c.expected) : null,
    });
  }
  if (HYBRID_ACTIVE) hybridMs = performance.now() - hybridStart;

  // --- Header ---
  console.log('');
  console.log('BetterRX DME - vendor reply parsing eval (specs/engine.md 6)');
  console.log(`Fixtures: evals/vendor-replies.json  (${cases.length} cases)`);
  console.log('');

  if (!HYBRID_ACTIVE) {
    console.log('NOTE: the hybrid column is NOT MEASURED in this run.');
    if (!HAS_API_KEY) {
      console.log('      ANTHROPIC_API_KEY is not set, so the LLM pass did not run.');
      console.log('      The LLM pass IS implemented (src/lib/parse-vendor-reply.ts);');
      console.log('      it needs a key. Set one and re-run for the real number.');
    } else {
      console.log('      The LLM pass is switched off in this script.');
    }
    console.log('      No hybrid score, cost, or timing is reported here.');
    console.log('      Nothing below is estimated.');
    console.log('      The 20/24 exit gate is not applied until the hybrid runs.');
    console.log('');
  }

  // --- Table ---
  console.log(row('CASE', 'REGEX', 'HYBRID', 'EXPECTED'));
  console.log(RULE);

  const groups: string[] = [];
  for (const o of outcomes) {
    if (!groups.includes(o.fixture.group)) groups.push(o.fixture.group);
  }

  let regexTotal = 0;
  let hybridTotal = 0;

  for (const group of groups) {
    const inGroup = outcomes.filter((o) => o.fixture.group === group);
    console.log(`-- ${group} ${'-'.repeat(Math.max(0, 74 - group.length))}`);

    for (const o of inGroup) {
      console.log(
        row(
          o.fixture.id,
          verdict(o.regexPass),
          o.hybridPass === null ? 'n/a' : verdict(o.hybridPass),
          describeExpected(o.fixture.expected),
        ),
      );
    }

    const regexGroupPass = inGroup.filter((o) => o.regexPass).length;
    const hybridGroupPass = inGroup.filter((o) => o.hybridPass === true).length;
    regexTotal += regexGroupPass;
    hybridTotal += hybridGroupPass;

    console.log(
      row(
        `   ${group} subtotal`,
        `${regexGroupPass}/${inGroup.length}`,
        HYBRID_ACTIVE ? `${hybridGroupPass}/${inGroup.length}` : 'n/a',
        '',
      ).trimEnd(),
    );
    console.log('');
  }

  // --- Headline numbers ---
  console.log(RULE);
  console.log(
    `Regex baseline   ${regexTotal}/${cases.length} (${pct(regexTotal, cases.length)})` +
      `   |  cost $0.00   |  ${regexMs.toFixed(1)} ms total`,
  );
  if (HYBRID_ACTIVE) {
    console.log(
      `Hybrid           ${hybridTotal}/${cases.length} (${pct(hybridTotal, cases.length)})` +
        `   |  cost $${hybridCostUsd.toFixed(4)}   |  ${(hybridMs / 1000).toFixed(1)} s total`,
    );
    console.log(RULE);
    console.log('');
    console.log(`Measured token usage across ${tokens.llmCalls} LLM call(s):`);
    console.log(`  input, fresh        ${tokens.input}      @ $5.00/MTok`);
    console.log(`  input, cache read   ${tokens.cachedInput}      @ $0.50/MTok`);
    console.log(`  input, cache write  ${tokens.cacheWrite}      @ $6.25/MTok (1.25x)`);
    console.log(`  output              ${tokens.output}      @ $25.00/MTok`);
    if (tokens.llmCalls > 0) {
      console.log(
        `  cost per LLM call   $${(hybridCostUsd / tokens.llmCalls).toFixed(5)} average`,
      );
      if (tokens.cachedInput === 0) {
        console.log('');
        console.log('  WARNING: cache read tokens are 0. PARSE_SYSTEM is not caching.');
        console.log('  Check its size with `npm run tokens:parse-system` - the minimum');
        console.log('  cacheable prefix on Opus 4.8 is 4096 tokens, and a short prompt');
        console.log('  fails silently. The specs/engine.md 3.5 cached-input line is void');
        console.log('  until this is non-zero.');
      }
    }
  } else {
    console.log('Hybrid           not measured (no ANTHROPIC_API_KEY) - no number to report');
  }
  console.log(RULE);

  // --- Where the baseline loses ---
  const regexFailures = outcomes.filter((o) => !o.regexPass);
  if (regexFailures.length > 0) {
    console.log('');
    console.log(`Regex baseline misses (${regexFailures.length}):`);
    console.log('');
    for (const o of regexFailures) {
      console.log(`  ${o.fixture.id}`);
      console.log(`    message   "${o.fixture.message}"`);
      console.log(`    regex     ${describeActual(o.regexResult)}`);
      console.log(`    expected  ${describeExpected(o.fixture.expected)}`);
    }
  }

  const overconfident = regexFailures.filter(
    (o) =>
      o.regexResult.intent !== o.fixture.expected.intent &&
      o.regexResult.confidence >= ACTION_CONFIDENCE_GATE,
  );
  if (overconfident.length > 0) {
    console.log('');
    console.log(
      `${overconfident.length} of those ${regexFailures.length} are wrong ABOVE the ` +
        `${ACTION_CONFIDENCE_GATE} action gate:`,
    );
    for (const o of overconfident) {
      console.log(
        `  ${o.fixture.id.padEnd(CASE_W)}"${o.fixture.message}" -> ${describeActual(o.regexResult)}`,
      );
    }
    console.log('The baseline acting alone would have changed order state incorrectly here.');
    console.log('The rest failed by returning "unknown", which routes to a nurse - safe, but no help.');
  }
  console.log('');

  if (HYBRID_ACTIVE && hybridTotal < HYBRID_FLOOR) {
    console.error(
      `FAIL: hybrid ${hybridTotal}/${cases.length} is below the ${HYBRID_FLOOR}/${cases.length} floor (specs/engine.md 6).`,
    );
    process.exit(1);
  }
}

await run();
