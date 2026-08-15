/**
 * The same order, seen from the driver's phone (storyboard frame 4a).
 *
 * Every bubble is a real `messages` row for this order. The seat is the
 * VENDOR'S, so the sides are flipped against the hospice timeline: what the
 * agent sent (direction 'out') reads as a received text on the left, and the
 * vendor's own replies (direction 'in') sit on the right. Under each vendor
 * reply is what the agent understood and how sure it was — the explainability
 * screen, on the phone of the person who wrote the message.
 *
 * Presenter utility, not a brand-perfect screen. It never 500s: no Supabase,
 * no order, or a bad id all render a calm card.
 */

import Link from 'next/link'
import MessageBubble from '@/components/message-bubble'
import ParsedInterpretation from '@/components/parsed-interpretation'
import PollRefresh from '@/components/poll-refresh'
import { formatDayTime, formatTime } from '@/src/lib/domain'
import ReplyForm from './reply-form'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  direction: string
  body: string
  created_at: string
  parsed: unknown
}

type Thread = {
  orderNo: string
  vendorName: string
  patientName: string | null
  itemSummary: string | null
  messages: Row[]
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** What the parser understood, in plain words. Mirrors the order timeline's line. */
function interpretation(parsed: unknown): { line: string; confidence: number } | null {
  const p = record(parsed)
  if (typeof p.confidence !== 'number') return null
  const parts: string[] = []
  const intent = text(p.intent)
  if (intent) parts.push(intent.replace(/_/g, ' '))
  const eta = text(p.eta)
  if (eta) parts.push(/^\+\d+[mh]$/.test(eta) ? `in ${eta.slice(1)}` : `ETA ${formatDayTime(eta)}`)
  const reason = text(p.reason)
  if (reason) parts.push(`reason: ${reason}`)
  if (parts.length === 0) return null
  return { line: parts.join(', '), confidence: p.confidence }
}

async function loadThread(orderId: string): Promise<Thread | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const { supabase } = await import('@/src/lib/supabase')
    const order = await supabase
      .from('orders')
      .select('id,order_no,items,vendor_id,patient_id')
      .eq('id', orderId)
      .maybeSingle()
    if (order.error || !order.data) return null
    const row = order.data

    const [messages, vendor, patient] = await Promise.all([
      supabase
        .from('messages')
        .select('id,direction,body,created_at,parsed')
        .eq('order_id', row.id)
        .order('created_at', { ascending: true }),
      row.vendor_id
        ? supabase.from('vendors').select('name').eq('id', row.vendor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('patients')
        .select('first_name,last_name')
        .eq('id', row.patient_id)
        .maybeSingle(),
    ])

    const items = Array.isArray(row.items) ? row.items : []
    const summary = items
      .flatMap((raw) => {
        const item = record(raw)
        const name = text(item.plain_name) ?? text(item.hcpcs)
        return name ? [name] : []
      })
      .join(', ')

    return {
      orderNo: row.order_no,
      vendorName: vendor.data?.name ?? 'Vendor',
      patientName:
        [patient.data?.first_name, patient.data?.last_name].filter(Boolean).join(' ') || null,
      itemSummary: summary || null,
      messages: messages.data ?? [],
    }
  } catch {
    return null
  }
}

function CalmCard({ headline, detail }: { headline: string; detail: string }) {
  return (
    <main className="mx-auto min-h-screen max-w-[400px] p-4" style={{ background: 'var(--paper)' }}>
      <div
        className="rounded-[10px] p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <h1 className="text-[17px] font-bold">{headline}</h1>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">{detail}</p>
        <Link href="/demo" className="mt-3 inline-block text-[13px] font-semibold underline">
          Back to the demo panel
        </Link>
      </div>
    </main>
  )
}

export default async function VendorThreadPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const thread = await loadThread(orderId)

  if (!thread) {
    return (
      <CalmCard
        headline="This thread is not here"
        detail="Either the order id is wrong or the database is not configured. Nothing was changed."
      />
    )
  }

  const subtitle = [thread.patientName, thread.itemSummary, thread.orderNo]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="mx-auto min-h-screen max-w-[400px] p-3" style={{ background: 'var(--paper)' }}>
      <PollRefresh intervalMs={3000} />
      <div
        className="rounded-[10px] p-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <header className="border-b pb-2" style={{ borderColor: 'var(--line)' }}>
          <h1 className="text-[16px] font-bold">Vendor phone. {thread.vendorName}.</h1>
          <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">{subtitle}</p>
        </header>

        {thread.messages.length === 0 ? (
          <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
            No messages on this order yet.
          </p>
        ) : (
          <div className="mt-2">
            {thread.messages.map((message) => {
              const fromVendor = message.direction === 'in'
              const parsed = fromVendor ? interpretation(message.parsed) : null
              return (
                <div key={message.id} className={fromVendor ? 'flex flex-col items-end' : ''}>
                  <MessageBubble
                    direction={fromVendor ? 'outbound' : 'inbound'}
                    body={message.body}
                    who={fromVendor ? 'You' : 'BetterRX DME'}
                    at={formatTime(message.created_at)}
                  />
                  {parsed ? (
                    <div className="w-full">
                      <ParsedInterpretation line={parsed.line} confidence={parsed.confidence} />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <ReplyForm orderId={orderId} />
      </div>
      <p className="mt-3 text-center text-[11.5px] text-[var(--ink-soft)]">
        Synthetic data. Messages to 555-01XX numbers are recorded, not sent.
      </p>
    </main>
  )
}
