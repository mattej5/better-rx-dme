"use client";

import { useState } from "react";

/**
 * The dispatcher who gets the text is usually not the person driving. Copying the
 * link is the forward mechanic — the token is deliberately not single-use.
 * Client component because the clipboard and the current URL only exist in the browser.
 */
export default function ShareBar({ hint }: { hint: string }) {
  const [copied, setCopied] = useState(false);

  function textDriver() {
    window.location.href = `sms:?&body=${encodeURIComponent(window.location.href)}`;
  }

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link for your driver", url);
    }
  }

  return (
    <div
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-3"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <p className="text-[13.5px] text-[var(--ink)]">{hint}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="min-h-[44px] flex-1 rounded-[var(--radius-btn)] text-[13px] font-extrabold uppercase tracking-[0.04em]"
          style={{ background: "var(--salmon)", color: "#24333F" }}
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={textDriver}
          className="min-h-[44px] flex-1 rounded-[var(--radius-btn)] border border-[var(--line)] text-[13px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink)]"
        >
          Text driver
        </button>
      </div>
    </div>
  );
}
