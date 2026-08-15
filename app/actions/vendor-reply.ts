'use server'

/**
 * The vendor's half of the SMS thread, from the vendor's phone.
 *
 * Same three calls as `simulateInboundSms` in app/actions/demo.ts — record
 * through `receiveMessage()`, read with `parseVendorReply()`, apply only past
 * the confidence gate — plus the thing a real thread has and the demo panel
 * does not: the agent answers. That answer goes out through `sendMessage()`
 * like every other outbound message in the product, so it lands as a `messages`
 * row and shows up as the next bubble. Synthetic 555-01XX numbers degrade to
 * `log_only`, which is exactly right here: the thread is the delivery.
 *
 * Nothing here re-implements a seam. Parse, apply and transport are imported.
 */

import { revalidatePath } from 'next/cache'

export type VendorReplyState = {
  ok: boolean
  message: string
}

const RELATIVE_ETA_RE = /^\+(\d+)([mh])$/

/** One plain sentence naming what was recorded. Never longer than a sentence. */
function summarize(
  events: string[],
  eta: string | undefined,
  formatDayTime: (iso: string) => string,
): string {
  if (eta) {
    const relative = RELATIVE_ETA_RE.exec(eta)
    if (relative) {
      const amount = Number(relative[1])
      const unit = relative[2] === 'h' ? 'hour' : 'minute'
      return `A delay of about ${amount} ${unit}${amount === 1 ? '' : 's'} is on the order.`
    }
    if (!Number.isNaN(Date.parse(eta))) {
      return `New ETA ${formatDayTime(eta)} is on the order.`
    }
  }
  if (events.includes('vendor_declined')) return 'Your decline is on the order.'
  if (events.includes('vendor_confirmed')) return 'Your confirmation is on the order.'
  return 'Your reply is on the order.'
}

export async function sendVendorReply(
  orderId: string,
  body: string,
): Promise<VendorReplyState> {
  const text = body.trim()
  if (!text) return { ok: false, message: 'Type a reply first' }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: 'Supabase is not configured, so nothing was sent' }
  }

  try {
    const { supabase } = await import('@/src/lib/supabase')
    const { canActOnParse, parseVendorReply } = await import('@/src/lib/parse-vendor-reply')
    const { receiveMessage, sendMessage, SYSTEM_ACTOR } = await import('@/src/lib/messaging')
    const { applyParsedIntent } = await import('@/src/lib/apply-parse')
    const { runRules } = await import('@/src/lib/rules')
    const { formatDayTime } = await import('@/src/lib/domain')

    const orderRes = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (orderRes.error || !orderRes.data) {
      return { ok: false, message: 'That order is not here any more' }
    }
    const order = orderRes.data

    const [vendorRes, patientRes] = await Promise.all([
      order.vendor_id
        ? supabase
            .from('vendors')
            .select('name,dispatch_phone')
            .eq('id', order.vendor_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('patients').select('address').eq('id', order.patient_id).maybeSingle(),
    ])
    const vendor = vendorRes.data
    const address = patientRes.data?.address
    const areaRecord =
      address && typeof address === 'object' && !Array.isArray(address)
        ? (address as Record<string, unknown>)
        : {}
    const area =
      [areaRecord.city, areaRecord.zip].filter((v) => typeof v === 'string' && v).join(' ') ||
      'the area'
    const item = Array.isArray(order.items)
      ? ((order.items[0] as Record<string, unknown> | undefined)?.plain_name as string) ??
        'equipment'
      : 'equipment'

    const result = await parseVendorReply(text, {
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
      body: text,
      parsed: { ...result },
    })

    let outcome: 'applied' | 'held' | 'unreadable'
    let detail = ''
    let message: string

    if (!canActOnParse(result)) {
      outcome = result.intent === 'unknown' ? 'unreadable' : 'held'
      message =
        outcome === 'unreadable'
          ? 'Recorded. We could not read a time in that, so a nurse will follow up.'
          : 'Recorded. A nurse will confirm before anything changes.'
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
        outcome = 'applied'
        detail = summarize(applied.events, result.eta, formatDayTime)
        message = detail
      } else {
        outcome = 'unreadable'
        message = 'Recorded, not applied. A nurse will follow up.'
      }
    }

    await sendMessage(
      {
        orderId: order.id,
        to: {
          channel: 'sms',
          address: vendor?.dispatch_phone ?? 'unknown',
          label: vendor?.name ?? 'Vendor',
        },
        template: 'vendor_ack',
        vars: { outcome, ...(detail ? { detail } : {}) },
      },
      { vendorId: order.vendor_id, actor: SYSTEM_ACTOR },
    )

    revalidatePath('/', 'layout')
    return { ok: true, message }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'That reply could not be processed',
    }
  }
}
