'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

type DemoActionState = {
  message: string
  detail?: string
  ok: boolean
}

function missingSupabaseConfiguration(): string | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 'Supabase key not set'
  if (!process.env.SUPABASE_URL) return 'Supabase URL not set'
  return null
}

async function sweepAllOpenOrders(): Promise<{ flagged: number; cleared: number }> {
  const { runRulesSweep } = await import('@/src/lib/rules')
  return runRulesSweep()
}

export async function advanceClock(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  const rawSeconds = Number(formData.get('seconds'))
  const allowedSeconds = new Set([15 * 60, 60 * 60, 24 * 60 * 60])
  let state: DemoActionState

  if (!allowedSeconds.has(rawSeconds)) {
    state = { ok: false, message: 'Invalid clock advance' }
  } else {
    const configurationError = missingSupabaseConfiguration()
    if (configurationError) {
      state = { ok: false, message: configurationError }
    } else {
      try {
        const { supabase } = await import('@/src/lib/supabase')
        const { data: current, error: readError } = await supabase
          .from('demo_state')
          .select('clock_offset_seconds, seeded_at')
          .eq('id', 1)
          .maybeSingle()

        if (readError) {
          state = { ok: false, message: 'Clock read failed', detail: readError.message }
        } else {
          const nextOffset = (current?.clock_offset_seconds ?? 0) + rawSeconds
          const { error: writeError } = await supabase.from('demo_state').upsert({
            id: 1,
            clock_offset_seconds: nextOffset,
            seeded_at: current?.seeded_at ?? null,
          })

          if (writeError) {
            state = { ok: false, message: 'Clock update failed', detail: writeError.message }
          } else {
            const sweep = await sweepAllOpenOrders()
            const virtualNow = new Date(Date.now() + nextOffset * 1000)
            state = {
              ok: true,
              message: `Clock advanced to ${virtualNow.toISOString()}`,
              detail: `Rules sweep: ${sweep.flagged} flagged / ${sweep.cleared} cleared.`,
            }
          }
        }
      } catch (error) {
        state = {
          ok: false,
          message: 'Clock update failed',
          detail: error instanceof Error ? error.message : 'Unknown Supabase error',
        }
      }
    }
  }

  revalidatePath('/', 'layout')
  return state
}

export async function resetSeed(
  _previousState: DemoActionState,
  _formData: FormData,
): Promise<DemoActionState> {
  void _previousState
  void _formData
  const state = {
    ok: false,
    message: 'Reset not wired up in this panel',
    detail: 'Run scripts/reset-demo.sql, then reseed with scripts/seed.mjs. No database changes were made.',
  }
  revalidatePath('/', 'layout')
  return state
}

export async function jumpScenario(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  const scenario = String(formData.get('scenario') ?? '')
  const allowed = new Set(['DME-10305', 'DME-09911', 'DME-09803', 'urgency-cascade'])
  const state = allowed.has(scenario)
    ? {
        ok: false,
        message: `Scenario jump not landed: ${scenario}`,
        detail: 'No events or database rows were changed.',
      }
    : { ok: false, message: 'Unknown scenario' }

  revalidatePath('/', 'layout')
  return state
}

/**
 * The inbound half of the comms loop, end to end: record the reply through the
 * `receiveMessage()` seam, parse it with `parseVendorReply()`, and apply it only
 * if it clears the confidence gate. A messy reply is not an error — it is
 * recorded, shown as an interpretation, and left for a nurse. A real Twilio
 * webhook would call exactly these three functions.
 */
export async function simulateInboundSms(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  const body = String(formData.get('body') ?? '').trim()
  const orderNo = String(formData.get('orderNo') ?? '').trim()

  if (!body) {
    revalidatePath('/', 'layout')
    return { ok: false, message: 'Enter a simulated vendor reply' }
  }
  const configurationError = missingSupabaseConfiguration()
  if (configurationError) {
    revalidatePath('/', 'layout')
    return { ok: false, message: configurationError }
  }

  let state: DemoActionState
  try {
    const { supabase } = await import('@/src/lib/supabase')
    const { canActOnParse, parseVendorReply } = await import('@/src/lib/parse-vendor-reply')
    const { receiveMessage, SYSTEM_ACTOR } = await import('@/src/lib/messaging')
    const { applyParsedIntent } = await import('@/src/lib/apply-parse')
    const { runRules } = await import('@/src/lib/rules')

    // Default to the order the vendor is most plausibly replying about: the most
    // recently placed order that is still waiting on the vendor.
    const orderQuery = supabase.from('orders').select('*')
    const orderRes = orderNo
      ? await orderQuery.eq('order_no', orderNo).maybeSingle()
      : await orderQuery
          .eq('status', 'ordered')
          .order('ordered_at', { ascending: false })
          .limit(1)
          .maybeSingle()

    if (orderRes.error || !orderRes.data) {
      revalidatePath('/', 'layout')
      return {
        ok: false,
        message: orderNo ? `No order ${orderNo}` : 'No order is waiting on a vendor reply',
      }
    }
    const order = orderRes.data

    const [vendorRes, patientRes] = await Promise.all([
      order.vendor_id
        ? supabase.from('vendors').select('name,dispatch_phone').eq('id', order.vendor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('patients').select('address').eq('id', order.patient_id).maybeSingle(),
    ])
    const vendor = vendorRes.data
    const area = ((): string => {
      const a = patientRes.data?.address
      const rec = a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : {}
      return [rec.city, rec.zip].filter((v) => typeof v === 'string' && v).join(' ') || 'the area'
    })()
    const item = Array.isArray(order.items)
      ? ((order.items[0] as Record<string, unknown> | undefined)?.plain_name as string) ?? 'equipment'
      : 'equipment'

    const result = await parseVendorReply(body, {
      orderId: order.id,
      item,
      patientArea: area,
      neededBy: order.target_at ?? order.ordered_at,
      urgency: order.urgency,
      vendorName: vendor?.name ?? 'the vendor',
    })

    const received = await receiveMessage({
      orderId: order.id,
      from: {
        channel: 'sms',
        address: vendor?.dispatch_phone ?? 'unknown',
        label: vendor?.name ?? 'Vendor',
      },
      vendorId: order.vendor_id,
      body,
      parsed: { ...result },
    })

    const readout =
      `${order.order_no} · intent ${result.intent} · confidence ${result.confidence.toFixed(2)} ` +
      `· parsed by ${result.method}`

    if (!canActOnParse(result)) {
      state = {
        ok: true,
        message: 'Recorded, not applied. This one needs a nurse.',
        detail: `${readout}\nBelow the 0.75 gate, so no order state changed. The interpretation is on the order timeline for someone to confirm.`,
      }
    } else {
      const applied = await applyParsedIntent({
        orderId: order.id,
        vendorId: order.vendor_id,
        messageId: received.recorded ? received.messageId : null,
        result,
        actor: SYSTEM_ACTOR,
        humanConfirmed: false,
      })
      if (applied.applied) {
        await runRules(order.id)
        state = {
          ok: true,
          message: `Applied to ${order.order_no}: ${applied.events.join(', ')}`,
          detail: readout,
        }
      } else {
        state = { ok: true, message: 'Recorded, not applied.', detail: `${readout}\n${applied.reason}` }
      }
    }
  } catch (error) {
    state = {
      ok: false,
      message: 'The reply could not be processed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  revalidatePath('/', 'layout')
  return state
}

export async function simulatePatientDeath(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  const patientExternalId = String(formData.get('patientExternalId') ?? '').trim()
  let state: DemoActionState

  if (!patientExternalId) {
    state = { ok: false, message: 'Patient external_id is required' }
  } else {
    try {
      const requestHeaders = await headers()
      const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
      const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
      if (!host) throw new Error('Could not determine the app origin')

      // Stable per patient so a second press demonstrates T10's replay no-op.
      const externalId = `demo-patient-death-${patientExternalId}`
      const response = await fetch(new URL('/api/erx/events', `${protocol}://${host}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          meta: { eventType: 'patientStatusChanged' },
          account: { identifiers: [{ id: 'ACCT-001' }] },
          patient: {
            identifiers: [{ id: patientExternalId, idType: 'external_id' }],
          },
          payload: {
            external_id: externalId,
            patient: { external_id: patientExternalId },
            status: 'deceased',
          },
        }),
        cache: 'no-store',
      })
      const responseBody = await response.text()
      state = {
        ok: response.ok,
        message: `POST /api/erx/events → HTTP ${response.status}`,
        detail: responseBody || '(empty response body)',
      }
    } catch (error) {
      state = {
        ok: false,
        message: 'eRx request failed before a response was received',
        detail: error instanceof Error ? error.message : 'Unknown request error',
      }
    }
  }

  revalidatePath('/', 'layout')
  return state
}
