/**
 * npm run tokens:parse-system — measure PARSE_SYSTEM against the real tokenizer.
 *
 * This exists because specs/engine.md 3.4 asserts a cache-minimum number that is
 * wrong (it says 512; the minimum cacheable prefix on Opus 4.8 is 4096), and the
 * 3.5 cost table prices cached input at $0.50/MTok on the strength of it. If
 * PARSE_SYSTEM lands under 4096 tokens it silently will not cache — no error,
 * just cache_creation_input_tokens: 0 forever — and that whole line item is void.
 *
 * So the number gets measured, not assumed. Requires ANTHROPIC_API_KEY. Without
 * one it prints the character count and says plainly that the token count is
 * unmeasured, rather than printing an estimate that could be mistaken for a fact.
 */

import { PARSE_SYSTEM } from '../src/lib/parse-vendor-reply.ts';

const CACHE_MINIMUM_TOKENS = 4096; // Opus 4.8. NOT the 512 in specs/engine.md 3.4.
const MODEL = 'claude-opus-4-8';

async function main(): Promise<void> {
  console.log('');
  console.log('PARSE_SYSTEM size check');
  console.log(`  model                ${MODEL}`);
  console.log(`  characters           ${PARSE_SYSTEM.length.toLocaleString()}`);
  console.log(`  cache minimum        ${CACHE_MINIMUM_TOKENS} tokens (Opus 4.8)`);
  console.log('');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  tokens               NOT MEASURED - ANTHROPIC_API_KEY is not set.');
    console.log('');
    console.log('  Set a key and re-run to get the real number. Until then, treat the');
    console.log('  cached-input line in specs/engine.md 3.5 as unverified.');
    console.log('');
    return;
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  const counted = await client.messages.countTokens({
    model: MODEL,
    system: [{ type: 'text', text: PARSE_SYSTEM }],
    messages: [{ role: 'user', content: 'x' }],
  });

  // countTokens has no way to price only the system block, so the single-character
  // user turn plus envelope overhead is included. That is a handful of tokens and
  // it errs high, so subtracting nothing keeps the comparison conservative in the
  // wrong direction - note it rather than fudge it.
  const tokens = counted.input_tokens;
  const clears = tokens >= CACHE_MINIMUM_TOKENS;

  console.log(`  tokens               ${tokens.toLocaleString()} (system + 1-char user turn + envelope)`);
  console.log(`  clears 4096          ${clears ? 'YES' : 'NO'}`);
  console.log('');

  if (clears) {
    console.log('  The system block caches. Every parse after the first in a 5-minute');
    console.log('  window reads it at $0.50/MTok instead of $5.00/MTok.');
    console.log('  Confirm with cache_read_input_tokens on a second live parse - a');
    console.log('  token count alone proves eligibility, not a cache hit.');
  } else {
    console.log('  The system block DOES NOT CACHE. There will be no error and no');
    console.log('  warning - cache_creation_input_tokens just stays 0. The $0.50/MTok');
    console.log('  cached-input line in specs/engine.md 3.5 does not apply, and the');
    console.log('  cost table needs repricing at the full $5.00/MTok input rate.');
  }
  console.log('');
}

await main();
