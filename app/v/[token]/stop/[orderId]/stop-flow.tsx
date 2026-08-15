"use client";

// N7 — the driver's screen. One-handed, 390×844, possibly in the dark.
//
// Every button here is a real POST to /api/v/[token]/… . When a write fails the
// server's own sentence is printed; nothing is optimistically marked done.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import ConditionAckSheet from "@/components/condition-ack-sheet";
import StopCard from "@/components/stop-card";
import type { ConditionValue } from "@/src/lib/domain";
import { CONDITION_LABEL, formatDayTime } from "@/src/lib/domain";

import { PhotoCapture, SignatureCapture } from "./capture";
import type { StopDetail } from "./data";

type SheetKey = "eta" | "decline" | "delivered" | "window" | "pickup" | "condition" | null;

const ETA_CHOICES = [15, 30, 45, 60, 120];

/** The vendor picks one. Free text is available but never required. */
const DECLINE_REASONS = [
  "No truck available today",
  "Item is out of stock",
  "Outside our service area",
  "No hazmat driver available",
  "Address or access problem",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ActionSheet({
  title,
  hint,
  onClose,
  children,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-[17px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          {title}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] rounded-[var(--radius-btn)] border border-[var(--line)] px-3 text-[12.5px] font-extrabold uppercase tracking-[0.04em]"
        >
          Back
        </button>
      </div>
      {hint ? <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[56px] w-full rounded-[var(--radius-btn)] text-[16px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-60"
      style={{ background: "var(--salmon)", color: "#24333F" }}
    >
      {children}
    </button>
  );
}

function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function StopFlow({ stop }: { stop: StopDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [signatureName, setSignatureName] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [podPhoto, setPodPhoto] = useState<string | null>(null);
  const [empties, setEmpties] = useState("");
  const [conditionPhoto, setConditionPhoto] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [windowStart, setWindowStart] = useState(() =>
    localInput(new Date(Date.now() + 2 * 3_600_000)),
  );
  const [windowEnd, setWindowEnd] = useState(() =>
    localInput(new Date(Date.now() + 4 * 3_600_000)),
  );

  const swap = stop.variant === "oxygen_swap";
  const pickup = stop.variant === "pickup";
  const finished = stop.stage === "delivered" || stop.stage === "picked_up";

  function post(path: string, body: Record<string, unknown>, success: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v/${stop.token}/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order_id: stop.orderId, ...body }),
        });
        const payload: unknown = await res.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message: unknown }).message)
            : "We couldn't save that.";
        if (!res.ok) {
          setError(message);
          return;
        }
        setSheet(null);
        setDone(success);
        router.refresh();
      } catch {
        setError("We couldn't reach the hospice. Check your signal and try again.");
      }
    });
  }

  function sendEta(minutes: number) {
    // The driver's stated ETA is the primary signal. GPS only refines it after.
    const path = stop.stage === "needs_eta" && !stop.etaIso ? "confirm" : "eta";
    const etaIso = new Date(Date.now() + minutes * 60_000).toISOString();
    post(path, { eta_iso: etaIso, minutes }, `We told the hospice about ${minutes} minutes.`);
  }

  function shareLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("This phone won't share a location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        post(
          "gps",
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy_m: position.coords.accuracy,
          },
          "Location shared. The hospice sees a sharper ETA.",
        ),
      () => setError("We didn't get your location. Your ETA still stands."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function markDelivered() {
    post(
      "delivered",
      {
        signature_name: signatureName || null,
        signature_image_url: signatureImage,
        pod_photo_url: podPhoto,
        ...(swap && empties ? { empties_retrieved: Number(empties) } : {}),
      },
      swap ? "Swap recorded." : "Delivery recorded.",
    );
  }

  function markPickedUp() {
    post("picked-up", { condition_photo_url: conditionPhoto }, "Pickup recorded.");
  }

  function saveCondition(value: ConditionValue) {
    post(
      "condition",
      { condition: value, phase: pickup ? "post_delivery" : "delivery", photo_url: conditionPhoto },
      `Condition saved: ${CONDITION_LABEL[value].toLowerCase()}.`,
    );
  }

  const canDeliver = Boolean(signatureName.trim() || signatureImage || podPhoto);

  const primaryLabel = pickup
    ? stop.stage === "needs_window"
      ? "Set pickup time"
      : "Picked up"
    : stop.stage === "needs_eta"
      ? "On my way"
      : swap
        ? "Swap done"
        : "Delivered";

  function onPrimary() {
    setDone(null);
    if (pickup) return setSheet(stop.stage === "needs_window" ? "window" : "pickup");
    return setSheet(stop.stage === "needs_eta" ? "eta" : "delivered");
  }

  const secondary: { label: string; run: () => void } | null = pickup
    ? stop.stage === "needs_window"
      ? { label: "Picked up now", run: () => setSheet("pickup") }
      : { label: "Change pickup time", run: () => setSheet("window") }
    : stop.stage === "needs_eta"
      ? { label: swap ? "Swap done" : "Delivered", run: () => setSheet("delivered") }
      : { label: "Update my ETA", run: () => setSheet("eta") };

  return (
    <div>
      {stop.source === "fixture" ? (
        <p
          className="mb-3 rounded-[8px] px-3 py-2 text-[13px]"
          style={{ background: "var(--paper-alt)", color: "var(--ink-soft)" }}
        >
          Sample stop. This preview has no database, so nothing you tap will be saved.
        </p>
      ) : null}

      {stop.isReplacement ? (
        <div
          className="mb-3 rounded-[8px] border-l-4 px-3 py-2"
          style={{ borderColor: "var(--burnt-dark)", background: "var(--burnt-tint)" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--burnt-dark)" }}>
            Replacement
          </p>
          <p className="text-[13.5px]">
            The first one arrived faulty. This redelivery is on your account
            {stop.replacementNoCharge ? " at no charge to the hospice" : ""}.
          </p>
        </div>
      ) : null}

      {stop.stage === "declined" ? (
        <div
          className="mb-3 rounded-[8px] px-3 py-2"
          style={{ background: "var(--red-tint)" }}
        >
          <p className="text-[13.5px]">
            You declined this stop{stop.declineReason ? `: ${stop.declineReason}` : ""}. The
            hospice has it. Nothing was cancelled automatically.
          </p>
        </div>
      ) : null}

      <StopCard
        variant={stop.variant}
        hazmat={stop.hazmat}
        mode="full"
        orderNo={stop.orderNo}
        patientLabel={`${stop.patientLabel} · ${stop.hospiceName}`}
        address={stop.address}
        addressNote={stop.addressNote ?? undefined}
        mapHref={stop.mapHref}
        windowLabel={stop.windowLabel}
        items={stop.items.map((item) => ({
          hcpcs: item.hcpcs,
          plainName: item.plainName,
          qty: item.qty,
        }))}
        familyNote={stop.familyNote ?? undefined}
        readOnly={finished}
        pending={pending}
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        secondaryLabel={secondary?.label}
        onSecondary={secondary ? secondary.run : undefined}
        onDecline={pickup ? undefined : () => setSheet("decline")}
        declineLabel="Can't take this stop"
      />

      {stop.hazmat ? (
        <p className="mt-2 text-[13px]" style={{ color: "var(--burnt-dark)" }}>
          Oxygen on board. Secure the cylinders upright and keep them away from heat.
        </p>
      ) : null}

      {done ? (
        <p
          role="status"
          className="mt-3 rounded-[8px] px-3 py-2 text-[14px]"
          style={{ background: "var(--green-tint)" }}
        >
          {done}
        </p>
      ) : null}

      {error && sheet === null ? (
        <p
          role="alert"
          className="mt-3 rounded-[8px] px-3 py-2 text-[14px]"
          style={{ background: "var(--red-tint)" }}
        >
          {error}
        </p>
      ) : null}

      {finished && stop.proof ? (
        <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <p
            className="text-[16.5px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {stop.proof.kind === "picked_up" ? "Picked up" : "Delivered"}{" "}
            {formatDayTime(stop.proof.at)}
          </p>
          {stop.proof.signatureName ? (
            <p className="mt-1 text-[14px]">Signed by {stop.proof.signatureName}</p>
          ) : null}
          {stop.proof.signatureImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- inlined data URL
            <img
              src={stop.proof.signatureImageUrl}
              alt="Signature captured at the door"
              className="mt-2 w-full rounded-[8px] border border-[var(--line)]"
            />
          ) : null}
          {stop.proof.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- inlined data URL
            <img
              src={stop.proof.photoUrl}
              alt="Photo captured at the stop"
              className="mt-2 w-full rounded-[8px] border border-[var(--line)]"
            />
          ) : null}
          {stop.proof.note ? (
            <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{stop.proof.note}</p>
          ) : null}
          {stop.conditionReported ? (
            <p className="mt-2 text-[14px]">
              Condition: {CONDITION_LABEL[stop.conditionReported]}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setSheet("condition")}
              className="mt-3 min-h-[48px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] text-[13.5px] font-extrabold uppercase tracking-[0.04em]"
            >
              Report a problem
            </button>
          )}
        </section>
      ) : null}

      {sheet === "eta" ? (
        <ActionSheet
          title="When will you be there?"
          hint="Pick the closest one. You can update it later."
          onClose={() => setSheet(null)}
        >
          <div className="grid grid-cols-2 gap-2">
            {ETA_CHOICES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={pending}
                onClick={() => sendEta(minutes)}
                className="min-h-[56px] rounded-[var(--radius-btn)] border border-[var(--line)] text-[15px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-60"
              >
                {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <p className="text-[13.5px] text-[var(--ink-soft)]">
              Sharing your location sharpens the ETA. It does not replace it, and the
              hospice never sees a live map of your route.
            </p>
            <button
              type="button"
              onClick={shareLocation}
              disabled={pending}
              className="mt-2 min-h-[52px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] text-[13.5px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-60"
            >
              Share my location
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-3 rounded-[8px] px-3 py-2 text-[14px]" style={{ background: "var(--red-tint)" }}>
              {error}
            </p>
          ) : null}
        </ActionSheet>
      ) : null}

      {sheet === "delivered" ? (
        <ActionSheet
          title={swap ? "Finish the swap" : "Confirm the delivery"}
          hint="A signature or a photo. One of the two, then the time is stamped for you."
          onClose={() => setSheet(null)}
        >
          <SignatureCapture
            name={signatureName}
            onName={setSignatureName}
            onImage={setSignatureImage}
          />
          <div className="mt-4">
            <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
              Photo
            </p>
            <PhotoCapture
              label="Take a photo"
              value={podPhoto}
              onChange={setPodPhoto}
            />
          </div>
          {swap ? (
            <div className="mt-4">
              <Field label="Empty cylinders you took">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={empties}
                  onChange={(event) => setEmpties(event.target.value)}
                  className="mt-1 min-h-[52px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
                />
              </Field>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                Full cylinders left and empties taken are one stop. One tap covers both.
              </p>
            </div>
          ) : null}
          {!canDeliver ? (
            <p className="mt-3 text-[13.5px] text-[var(--ink-soft)]">
              Sign, type a name, or take a photo before you finish.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 rounded-[8px] px-3 py-2 text-[14px]" style={{ background: "var(--red-tint)" }}>
              {error}
            </p>
          ) : null}
          <div className="mt-4">
            <Primary onClick={markDelivered} disabled={pending || !canDeliver}>
              {pending ? "Saving" : swap ? "Swap done" : "Delivered"}
            </Primary>
          </div>
        </ActionSheet>
      ) : null}

      {sheet === "window" ? (
        <ActionSheet
          title="Set the pickup time"
          hint={stop.familyNote ?? "Give the family a window they can plan around."}
          onClose={() => setSheet(null)}
        >
          <Field label="From">
            <input
              type="datetime-local"
              value={windowStart}
              onChange={(event) => setWindowStart(event.target.value)}
              className="mt-1 min-h-[52px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
            />
          </Field>
          <div className="mt-3">
            <Field label="To">
              <input
                type="datetime-local"
                value={windowEnd}
                onChange={(event) => setWindowEnd(event.target.value)}
                className="mt-1 min-h-[52px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
              />
            </Field>
          </div>
          {error ? (
            <p role="alert" className="mt-3 rounded-[8px] px-3 py-2 text-[14px]" style={{ background: "var(--red-tint)" }}>
              {error}
            </p>
          ) : null}
          <div className="mt-4">
            <Primary
              disabled={pending}
              onClick={() =>
                post(
                  "pickup-scheduled",
                  {
                    window_start: new Date(windowStart).toISOString(),
                    window_end: new Date(windowEnd).toISOString(),
                    family_note: stop.familyNote,
                  },
                  "Pickup time sent to the hospice.",
                )
              }
            >
              {pending ? "Saving" : "Send this time"}
            </Primary>
          </div>
        </ActionSheet>
      ) : null}

      {sheet === "pickup" ? (
        <ActionSheet
          title="Confirm the pickup"
          hint="Photograph the equipment before it goes on the truck. That photo protects you too."
          onClose={() => setSheet(null)}
        >
          <PhotoCapture
            label="Photograph the equipment"
            value={conditionPhoto}
            onChange={setConditionPhoto}
            required
          />
          <p className="mt-3 text-[13.5px] text-[var(--ink-soft)]">
            Sanitize before it goes back on the shelf.
          </p>
          {error ? (
            <p role="alert" className="mt-3 rounded-[8px] px-3 py-2 text-[14px]" style={{ background: "var(--red-tint)" }}>
              {error}
            </p>
          ) : null}
          <div className="mt-4">
            <Primary onClick={markPickedUp} disabled={pending || !conditionPhoto}>
              {pending ? "Saving" : "Picked up"}
            </Primary>
          </div>
        </ActionSheet>
      ) : null}

      {sheet === "condition" ? (
        <ActionSheet
          title="Report the condition"
          hint="One tap. This goes on the record for this order."
          onClose={() => setSheet(null)}
        >
          <ConditionAckSheet
            itemLabel={stop.items.map((item) => item.plainName).join(", ")}
            defaultValue={stop.conditionReported ?? undefined}
            onDone={saveCondition}
            pending={pending}
            error={error}
            photoSlot={
              <PhotoCapture
                label="Add a photo"
                value={conditionPhoto}
                onChange={setConditionPhoto}
              />
            }
          />
        </ActionSheet>
      ) : null}

      {sheet === "decline" ? (
        <ActionSheet
          title="Why can't you take it?"
          hint="Say the real reason. It goes on your record either way, and the hospice needs it to find another truck."
          onClose={() => setSheet(null)}
        >
          <div className="flex flex-col gap-2">
            {DECLINE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                disabled={pending}
                onClick={() => setDeclineReason(reason)}
                aria-pressed={declineReason === reason}
                className="min-h-[52px] rounded-[var(--radius-btn)] px-3 text-left text-[14.5px] disabled:opacity-60"
                style={{
                  border: `1px solid ${declineReason === reason ? "var(--ink)" : "var(--line)"}`,
                  background: declineReason === reason ? "var(--ink)" : "var(--surface)",
                  color: declineReason === reason ? "#FFFFFF" : "var(--ink)",
                }}
              >
                {reason}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Field label="Anything else">
              <input
                type="text"
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                className="mt-1 min-h-[52px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
              />
            </Field>
          </div>
          <p className="mt-3 text-[13.5px] text-[var(--ink-soft)]">
            Nothing is cancelled by this. A person at the hospice picks what happens next.
          </p>
          {error ? (
            <p role="alert" className="mt-3 rounded-[8px] px-3 py-2 text-[14px]" style={{ background: "var(--red-tint)" }}>
              {error}
            </p>
          ) : null}
          <div className="mt-4">
            <Primary
              disabled={pending || !declineReason.trim()}
              onClick={() =>
                post("decline", { reason: declineReason.trim() }, "The hospice knows.")
              }
            >
              {pending ? "Sending" : "Send reason"}
            </Primary>
          </div>
        </ActionSheet>
      ) : null}
    </div>
  );
}
