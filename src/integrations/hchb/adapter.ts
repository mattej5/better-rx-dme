// STUB: HCHB partner-connection adapter. Types + one pure mapping function.
// No runtime dependencies, no network calls, no database calls. It exists to
// prove the shape of the seam described in docs/INTEGRATION.md (deliverable D).
//
// Direction: HCHB pushes ADT and supply-order records into our partner
// connection. This file maps those records onto the pinned BetterRX eRx
// envelope (specs/data.md §5), which is what POST /api/erx/events accepts.
//
// The HCHB field names below are [assumed]. We have no HCHB API document.
// wiki/facts/integration-and-data.md records only that HCHB ships a
// purpose-built DME/supply integration layer [brief]; the field spellings are
// our extrapolation and must be re-checked against real HCHB docs before use.

import type { OrderUrgency } from '@/src/lib/domain';

export type Iso = string;

/** HCHB-flavored inbound records (shape [assumed]). */

export interface HchbAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateCode: string;
  postalCode: string;
}

export interface HchbPatientRef {
  patientId: string;
  medicalRecordNumber?: string;
  agencyId: string;
}

/** ADT: admit / discharge / transfer / death. */
export interface HchbAdtMessage {
  messageId: string;
  messageType: 'ADT';
  eventCode: 'A01' | 'A03' | 'A08' | 'A13' | 'DEATH';
  eventDateTime: Iso;
  patient: HchbPatientRef & {
    firstName: string;
    lastName: string;
    birthDate?: string;
    address?: HchbAddress;
  };
  patientStatus?: 'active' | 'discharged' | 'deceased';
}

/** Supply/DME order raised in HCHB by the nurse or the plan of care. */
export interface HchbSupplyOrder {
  messageId: string;
  messageType: 'SUPPLY_ORDER';
  orderId: string;
  orderDateTime: Iso;
  patient: HchbPatientRef;
  priority: 'STAT' | 'ROUTINE' | 'ADMISSION';
  neededByDateTime?: Iso | null;
  deliverTo: HchbAddress;
  orderingPhysicianNpi?: string;
  comments?: string;
  lines: {
    lineId: string;
    hcpcsCode: string;
    description: string;
    quantity: number;
  }[];
}

export type HchbInboundMessage = HchbAdtMessage | HchbSupplyOrder;

/** The pinned eRx envelope we emit (specs/data.md §5). */

export interface ErxEnvelope<T extends string, B> {
  meta: { eventType: T };
  account: { identifiers: { id: string }[] };
  patient: { identifiers: { id: string; idType: string }[] } & B;
}

export interface ErxAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ErxDmeItem {
  externalId: string;
  product: { codeType: 'HCPCS'; code: string; name: string };
  quantity: number;
  urgency: OrderUrgency;
  targetDateTime: Iso | null;
  deliveryAddress: ErxAddress;
  physician?: { identifier: { id: string; idType: 'npi' } };
  notes?: string;
}

export type NewDmeOrder = ErxEnvelope<'newDmeOrder', { dmeOrders: ErxDmeItem[] }>;

export type PatientStatusChanged = ErxEnvelope<
  'patientStatusChanged',
  {
    payload: {
      external_id: string;
      patient: { external_id: string };
      status: 'active' | 'discharged' | 'deceased';
      changed_at: Iso;
    };
  }
>;

export type MappedEnvelope = NewDmeOrder | PatientStatusChanged;

const URGENCY: Record<HchbSupplyOrder['priority'], OrderUrgency> = {
  STAT: 'stat',
  ROUTINE: 'routine',
  ADMISSION: 'admission',
};

type PatientStatus = PatientStatusChanged['patient']['payload']['status'];

const ADT_STATUS: Record<HchbAdtMessage['eventCode'], PatientStatus> = {
  A01: 'active',
  A03: 'discharged',
  A08: 'active',
  A13: 'active',
  DEATH: 'deceased',
};

function toErxAddress(a: HchbAddress): ErxAddress {
  return {
    street1: a.addressLine1,
    street2: a.addressLine2,
    city: a.city,
    state: a.stateCode,
    zip: a.postalCode,
    country: 'USA',
  };
}

/**
 * Map one HCHB record onto the eRx envelope POST /api/erx/events accepts.
 *
 * Idempotency: `messageId` becomes the envelope external_id, which the ingress
 * writes to `order_events.external_id` (unique). A replayed HCHB webhook
 * therefore no-ops. Tenancy: `patient.agencyId` becomes
 * `account.identifiers[0].id`, which the ingress maps to `orders.hospice_account`.
 */
export function mapToErxEnvelope(message: HchbInboundMessage): MappedEnvelope {
  const account = { identifiers: [{ id: message.patient.agencyId }] };
  const identifiers = [{ id: message.patient.patientId, idType: 'external_id' }];

  if (message.messageType === 'ADT') {
    return {
      meta: { eventType: 'patientStatusChanged' },
      account,
      patient: {
        identifiers,
        payload: {
          external_id: message.messageId,
          patient: { external_id: message.patient.patientId },
          status: message.patientStatus ?? ADT_STATUS[message.eventCode],
          changed_at: message.eventDateTime,
        },
      },
    };
  }

  const deliveryAddress = toErxAddress(message.deliverTo);
  const physician = message.orderingPhysicianNpi
    ? { identifier: { id: message.orderingPhysicianNpi, idType: 'npi' as const } }
    : undefined;

  return {
    meta: { eventType: 'newDmeOrder' },
    account,
    patient: {
      identifiers,
      dmeOrders: message.lines.map((line) => ({
        externalId: `${message.messageId}:${line.lineId}`,
        product: { codeType: 'HCPCS', code: line.hcpcsCode, name: line.description },
        quantity: line.quantity,
        urgency: URGENCY[message.priority],
        targetDateTime: message.neededByDateTime ?? null,
        deliveryAddress,
        physician,
        notes: message.comments,
      })),
    },
  };
}
