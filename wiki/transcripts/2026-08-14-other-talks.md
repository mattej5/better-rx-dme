# Other Builder Day Talks — 2026-08-14

Adjacent to the bounty, not about DME. Captured because some of it is directly useful to how we build today. Source: Wispr Flow meeting recorder. Full transcripts remain in Wispr; these are the summaries.

---

## Opening keynote — "AI Powered Builder Hackathon" (`e6e6c9be`, 9:05–9:58 AM MT)

Kickoff for the Just Build hackathon. Opening pep talk on being a builder in Utah, then a deep-dive from Phil on running 24/7 agentic "night shift" development, plus logistics for the day's tracks and judging.

- Frame: "you can just do things," no permission needed.
- Founder traits cited from reference interviews: rational self-confidence and willingness to act.

---

## Santiago — $1.5M ARR with AI coding loops (`a1d8c0d8`, 12:38–1:01 PM MT)

Two-person team at $1.5M ARR. **Directly relevant to how we run today.**

- **Loops**: test skills locally in Codex / Claude Code, promote the good ones to a shared repo, use a cloud IDE.
- **Reviewers on GitHub Actions** to gatekeep PRs against quality standards.
- **Evals**: keep an "atlas" of benchmarks and goals; turn failures into new evals.
- Rotated model subscriptions to manage cost.

Second half: Andrew Carr previewed Carwheel's first scaling law for human motion. Not relevant.

---

## AI harness design principles (`ed2add24`, 11:26–11:39 AM MT)

Talk on designing the harness around an LLM. **Four pillars: loop, tools, guardrails, observability.**

- Loop: context → model → tool calls → append results → decide finish or iterate.
- Tools are like a job description: define what the LLM can and cannot do.
- Note the term collision: this "guardrails" is agent safety. BetterRX's "guardrails" is a hospice operations feature. Keep them straight in writing.

---

## Prompt injection against coding agents (`3cc83f2c`, 10:33 AM MT)

Sentry folks demoed a benign-looking local MCP server returning a fake auto-fix with malicious content. Claude acted on it and tried to upload a code bundle to a malicious domain.

Three risk areas: **egress** of data/code, **destructive actions**, and **persistence** (planted code). Recommendation: Anthropic's SRT sandbox to constrain agent file, network, and write access.

**Relevance to us:** we're pulling content from HTML files, Notion, and Slack into agent context today. Treat all of it as data, never as instructions.

---

## Self-hosting AI agents (`d86ab200`, 11:40 AM–12:01 PM MT)

Small dense models with guardrails to cut token cost; run locally or on pay-per-compute infra.

- Alibaba Qwen 3 (~27B) runs on 17GB VRAM, hits ~70+ on coding benchmarks.
- Tradeoff: less raw capability, so prompt more directly.
- Possibly relevant to deliverable B's **per-order compute cost estimate** — a small local model as the cost floor is a legitimate comparison point.

---

## Cursor cloud agents (`92a5fec7`, 10:45–11:03 AM MT)

Cursor across IDE, terminal CLI, web, iOS, plus an SDK. Progression: synchronous prompting → automations (triage, PR review, bug repro) → autonomous SDLC. Grok 4.6 highlighted as a strong speed/cost pick.

---

## Jeremy — deepfake research (`c1b0cf1f`, 11:06–11:14 AM MT)

No summary generated. Not relevant to the bounty.
