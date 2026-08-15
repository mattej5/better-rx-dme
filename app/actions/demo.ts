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
    message: 'Seed script not landed',
    detail: 'Reset seed is a T1 stub; no database changes were made.',
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
        message: `Scenario jump not landed (T2): ${scenario}`,
        detail: 'No events or database rows were changed.',
      }
    : { ok: false, message: 'Unknown scenario' }

  revalidatePath('/', 'layout')
  return state
}

export async function simulateInboundSms(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  const body = String(formData.get('body') ?? '').trim()
  const state = body
    ? {
        ok: false,
        message: 'Parse loop not landed (N4)',
        detail: `Recorded in this panel only: “${body}”`,
      }
    : { ok: false, message: 'Enter a simulated vendor reply' }

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
