import { NextResponse } from "next/server";

import { appendEvent } from "@/src/lib/events";
import { runRules } from "@/src/lib/rules";
import {
  changePatientStatus,
  type PatientStatus,
} from "@/src/lib/fanout";
import type { Json } from "@/src/types/db";

const KNOWN_EVENT_TYPES = new Set([
  "newOrUpdatePatient",
  "newDmeOrder",
  "dmeStatusUpdate",
  "patientStatusChanged",
]);
const PATIENT_STATUSES = new Set<PatientStatus>([
  "active",
  "condition_worsened",
  "deceased",
  "discharged",
]);
const DME_STATUS_EVENTS = new Set([
  "dispatched",
  "eta_updated",
  "delivered",
  "pickup_scheduled",
  "picked_up",
]);

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function patientExternalId(envelope: JsonObject, payload: JsonObject): string | null {
  const payloadPatient = object(payload.patient);
  const direct = text(payloadPatient?.external_id);
  if (direct) return direct;

  const patient = object(envelope.patient);
  const identifiers = Array.isArray(patient?.identifiers) ? patient.identifiers : [];
  for (const raw of identifiers) {
    const identifier = object(raw);
    if (text(identifier?.idType) === "external_id") return text(identifier?.id);
  }
  return null;
}

function accountId(envelope: JsonObject): string | null {
  const account = object(envelope.account);
  const identifiers = Array.isArray(account?.identifiers) ? account.identifiers : [];
  return text(object(identifiers[0])?.id);
}

function envelopePayload(envelope: JsonObject): JsonObject {
  const rootPayload = object(envelope.payload);
  if (rootPayload) return rootPayload;
  const patient = object(envelope.patient);
  return object(patient?.payload) ?? {};
}

async function alreadyIngested(externalId: string): Promise<boolean> {
  const { supabase } = await import("@/src/lib/supabase");
  const result = await supabase
    .from("order_events")
    .select("id")
    .eq("external_id", externalId)
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

async function findOrder(orderNo: string, hospiceAccount: string) {
  const { supabase } = await import("@/src/lib/supabase");
  const result = await supabase
    .from("orders")
    .select("id")
    .eq("order_no", orderNo)
    .eq("hospice_account", hospiceAccount)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function POST(request: Request) {
  let envelope: JsonObject;
  try {
    const parsed = await request.json();
    const candidate = object(parsed);
    if (!candidate) return error("Request body must be a JSON object");
    envelope = candidate;
  } catch {
    return error("Request body must be valid JSON");
  }

  const meta = object(envelope.meta);
  const eventType = text(meta?.eventType);
  if (!eventType) return error("meta.eventType is required");
  if (!KNOWN_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return error("Supabase is not configured", 500);
  }

  const hospiceAccount = accountId(envelope);
  if (!hospiceAccount) return error("account.identifiers[0].id is required");
  const payload = envelopePayload(envelope);
  const externalId = text(payload.external_id) ?? text(meta?.externalId);

  try {
    const { supabase } = await import("@/src/lib/supabase");

    if (eventType === "patientStatusChanged") {
      if (!externalId) return error("payload.external_id or meta.externalId is required");
      const prefix = `${externalId}:`;
      const existingResult = await supabase
        .from("order_events")
        .select("external_id")
        .like("external_id", `${prefix}%`);
      if (existingResult.error) throw existingResult.error;
      const doneExternalIds = new Set(
        (existingResult.data ?? []).flatMap((row) => (row.external_id ? [row.external_id] : [])),
      );
      const hasPriorRun = doneExternalIds.size > 0;

      const externalPatientId = patientExternalId(envelope, payload);
      if (!externalPatientId) return error("patient external_id is required");
      const status = text(payload.status);
      if (!status || !PATIENT_STATUSES.has(status as PatientStatus)) {
        return error("payload.status is invalid");
      }

      const patientResult = await supabase
        .from("patients")
        .select("id")
        .eq("external_id", externalPatientId)
        .maybeSingle();
      if (patientResult.error) throw patientResult.error;
      if (!patientResult.data) return error("Patient not found", 404);

      const tenantOrder = await supabase
        .from("orders")
        .select("id")
        .eq("patient_id", patientResult.data.id)
        .eq("hospice_account", hospiceAccount)
        .limit(1)
        .maybeSingle();
      if (tenantOrder.error) throw tenantOrder.error;
      if (!tenantOrder.data) return error("Patient not found for hospice account", 404);

      const receipt = await changePatientStatus(
        patientResult.data.id,
        status as PatientStatus,
        { externalId, hospiceAccount, doneExternalIds },
      );
      if (hasPriorRun && receipt.ordersProcessed === 0) {
        return NextResponse.json({ ok: true, deduped: true });
      }
      return NextResponse.json({ ok: true, ...receipt });
    }

    if (eventType === "newOrUpdatePatient") {
      const externalPatientId = patientExternalId(envelope, payload);
      if (!externalPatientId) return error("patient external_id is required");
      const patient = object(envelope.patient) ?? {};
      const details = object(payload.patient) ?? patient;
      const firstName = text(details.first_name) ?? text(details.firstName) ?? "Unknown";
      const lastName = text(details.last_name) ?? text(details.lastName) ?? "Patient";
      const careStatus = text(details.care_status) ?? text(details.status);

      const existingPatient = await supabase
        .from("patients")
        .select("id")
        .eq("external_id", externalPatientId)
        .maybeSingle();
      if (existingPatient.error) throw existingPatient.error;

      if (existingPatient.data) {
        // Never overwrite care_status unless the envelope explicitly carries a status,
        // and never repoint hospice_name from the account id on update.
        const patched = await supabase
          .from("patients")
          .update(careStatus ? { first_name: firstName, last_name: lastName, care_status: careStatus } : { first_name: firstName, last_name: lastName })
          .eq("id", existingPatient.data.id);
        if (patched.error) throw patched.error;
      } else {
        const inserted = await supabase.from("patients").insert({
          external_id: externalPatientId,
          first_name: firstName,
          last_name: lastName,
          care_status: careStatus ?? "active",
          hospice_name: "Desert Valley Hospice",
          // The sending system names itself in meta.source (HCHB, Axxess, WellSky,
          // MatrixCare); the roster chip renders it. Default stays HCHB.
          ...(meta && text(meta.source) ? { emr_source: text(meta.source) as string } : {}),
        });
        if (inserted.error) throw inserted.error;
      }
      return NextResponse.json({ ok: true });
    }

    const orderNo = text(payload.order_no) ?? text(payload.orderNo);
    if (!orderNo) {
      return NextResponse.json({ ok: true, ignored: true, reason: "unknown order" });
    }
    const order = await findOrder(orderNo, hospiceAccount);
    if (!order) {
      return NextResponse.json({ ok: true, ignored: true, reason: "unknown order" });
    }
    if (externalId && await alreadyIngested(externalId)) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    const ingressOpts = externalId ? { externalId } : undefined;
    if (eventType === "newDmeOrder") {
      await appendEvent(order.id, "order_placed", payload as unknown as Json, {
        role: "case_manager",
        userName: "BetterRX eRx ingress",
      }, ingressOpts);
    } else {
      const status = text(payload.status);
      if (!status || !DME_STATUS_EVENTS.has(status)) return error("payload.status is invalid");
      await appendEvent(order.id, status as "dispatched" | "eta_updated" | "delivered" | "pickup_scheduled" | "picked_up", payload as unknown as Json, {
        role: "case_manager",
        userName: "BetterRX eRx ingress",
      }, ingressOpts);
    }
    await runRules(order.id);
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const code = caught && typeof caught === "object" && "code" in caught ? (caught as { code?: string }).code : undefined;
    if (code === "23505") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    const message = caught instanceof Error ? caught.message : "Ingress processing failed";
    return error(message, 500);
  }
}
