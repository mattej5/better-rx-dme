"use client";

// N7 capture primitives.
//
// STUB pending object storage — there is no blob store in this build. Both of
// these produce a data URL that gets inlined into the event payload. Production
// uploads the bytes and stores a URL. Nothing here claims an upload happened.

import { useCallback, useEffect, useRef, useState } from "react";

/** Keeps an inlined capture inside the API's MAX_INLINE_CAPTURE_BYTES budget. */
const PHOTO_MAX_EDGE = 640;
const PHOTO_QUALITY = 0.5;

export function PhotoCapture({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      onChange(await downscale(file));
    } catch {
      setFailed(true);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handle(event.target.files?.[0])}
      />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL, not a remote asset
        <img
          src={value}
          alt="Photo you just took"
          className="w-full rounded-[8px] border border-[var(--line)]"
        />
      ) : null}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-2 min-h-[52px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] text-[14px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-60"
      >
        {busy ? "Working" : value ? "Retake photo" : label}
      </button>
      {required && !value ? (
        <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">Required for this stop.</p>
      ) : null}
      {failed ? (
        <p role="alert" className="mt-1 text-[12.5px]" style={{ color: "var(--burnt-dark)" }}>
          That photo didn&rsquo;t save. Try again.
        </p>
      ) : null}
    </div>
  );
}

function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("decode failed"));
      image.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Signature pad with the typed-name fallback beside it, not behind a toggle —
 * gloves, cold hands, and cracked screens all beat a canvas, and the pinned
 * proof-of-capture rule accepts either.
 */
export function SignatureCapture({
  name,
  onName,
  onImage,
}: {
  name: string;
  onName: (value: string) => void;
  onImage: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#24333F";
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) return;
    onImage(canvas.toDataURL("image/png"));
  }, [onImage]);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    onImage(null);
  }

  return (
    <div>
      <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        Signature
      </p>
      <canvas
        ref={canvasRef}
        className="mt-1 h-[150px] w-full touch-none rounded-[8px] border border-dashed border-[var(--line)] bg-[var(--surface)]"
        onPointerDown={(event) => {
          const ctx = event.currentTarget.getContext("2d");
          if (!ctx) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          drawing.current = true;
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const ctx = event.currentTarget.getContext("2d");
          if (!ctx) return;
          const p = point(event);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          emit();
        }}
        onPointerLeave={() => {
          if (!drawing.current) return;
          drawing.current = false;
          emit();
        }}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-1 min-h-[40px] rounded-[var(--radius-btn)] border border-[var(--line)] px-3 text-[12.5px] font-extrabold uppercase tracking-[0.04em]"
      >
        Clear
      </button>

      <label className="mt-3 block">
        <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
          Or type who signed
        </span>
        <input
          type="text"
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder="Name of the person at the door"
          className="mt-1 min-h-[52px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
        />
      </label>
    </div>
  );
}
