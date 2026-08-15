import Link from 'next/link'
import { now } from '@/src/lib/clock'
import {
  ClockControls,
  DeathSimulationControl,
  InboundSmsControl,
} from './demo-controls'

type DemoData = {
  configurationMessage: string | null
  dataMessage: string | null
  magicLink: string | null
  offsetSeconds: number
}

async function loadDemoData(): Promise<DemoData> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { configurationMessage: 'Supabase key not set', dataMessage: null, magicLink: null, offsetSeconds: 0 }
  }
  if (!process.env.SUPABASE_URL) {
    return { configurationMessage: 'Supabase URL not set', dataMessage: null, magicLink: null, offsetSeconds: 0 }
  }

  try {
    const { supabase } = await import('@/src/lib/supabase')
    const [stateResult, linkResult] = await Promise.all([
      supabase.from('demo_state').select('clock_offset_seconds').eq('id', 1).maybeSingle(),
      supabase
        .from('magic_links')
        .select('token')
        .eq('scope', 'run_list')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const errors = [stateResult.error?.message, linkResult.error?.message].filter(Boolean)
    if (errors.length) {
      return {
        configurationMessage: null,
        dataMessage: `Supabase read failed: ${errors.join('; ')}`,
        magicLink: null,
        offsetSeconds: 0,
      }
    }

    const hasData = Boolean(stateResult.data || linkResult.data)
    return {
      configurationMessage: null,
      dataMessage: hasData ? null : 'No data yet. Run the seed script.',
      magicLink: linkResult.data ? `/v/${linkResult.data.token}` : null,
      offsetSeconds: stateResult.data?.clock_offset_seconds ?? 0,
    }
  } catch (error) {
    return {
      configurationMessage: null,
      dataMessage: `Supabase read failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      magicLink: null,
      offsetSeconds: 0,
    }
  }
}

type ThreadLink = { orderId: string; orderNo: string; vendorName: string; patientName: string }

/**
 * Orders the presenter can open on the vendor's phone: still open, and the agent
 * has already sent something, so there is a thread to reply into.
 */
async function loadThreadLinks(): Promise<ThreadLink[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return []
  try {
    const { supabase } = await import('@/src/lib/supabase')
    const sent = await supabase.from('messages').select('order_id').eq('direction', 'out')
    if (sent.error) return []
    const orderIds = [...new Set((sent.data ?? []).map((m) => m.order_id))]
    if (orderIds.length === 0) return []

    const orders = await supabase
      .from('orders')
      .select('id,order_no,vendor_id,patient_id')
      .in('id', orderIds)
      .not('status', 'in', '(delivered,picked_up)')
      .order('ordered_at', { ascending: false })
      .limit(6)
    if (orders.error || !orders.data?.length) return []

    const [vendors, patients] = await Promise.all([
      supabase
        .from('vendors')
        .select('id,name')
        .in('id', orders.data.map((o) => o.vendor_id).filter((id): id is string => Boolean(id))),
      supabase
        .from('patients')
        .select('id,first_name,last_name')
        .in('id', orders.data.map((o) => o.patient_id)),
    ])
    const vendorName = new Map((vendors.data ?? []).map((v) => [v.id, v.name]))
    const patientName = new Map(
      (patients.data ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]),
    )

    return orders.data.map((o) => ({
      orderId: o.id,
      orderNo: o.order_no,
      vendorName: (o.vendor_id && vendorName.get(o.vendor_id)) || 'Unassigned vendor',
      patientName: patientName.get(o.patient_id) ?? 'Unknown patient',
    }))
  } catch {
    return []
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      {children}
    </section>
  )
}

function RunListLink({ link }: { link: string }) {
  return (
    <div>
      <p className="mb-1 text-sm text-slate-600">Open this on the vendor phone, or paste it into a browser tab for the judges.</p>
      <a href={link} className="block break-all font-mono text-sm text-blue-700 underline">{link}</a>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default async function DemoPage() {
  const [demoData, virtualNow, threadLinks] = await Promise.all([
    loadDemoData(),
    now(),
    loadThreadLinks(),
  ])

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-slate-100 p-4 text-slate-900 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Demo control panel</h1>
        <p className="text-sm text-slate-600">Plain presenter utility board. Every control here hits the live app.</p>
      </header>

      {demoData.configurationMessage ? (
        <div className="mb-4 rounded border border-amber-400 bg-amber-50 p-4 font-semibold">{demoData.configurationMessage}</div>
      ) : null}
      {demoData.dataMessage ? (
        <div className="mb-4 rounded border border-amber-400 bg-amber-50 p-4 font-semibold">{demoData.dataMessage}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Virtual clock">
          <dl className="mb-3 text-sm">
            <dt className="font-semibold">Virtual now</dt>
            <dd className="font-mono">{virtualNow.toISOString()}</dd>
            <dt className="mt-2 font-semibold">Offset</dt>
            <dd>{demoData.offsetSeconds.toLocaleString()} seconds</dd>
          </dl>
          <ClockControls />
        </Card>

        <Card title="Reset">
          <p className="text-sm text-slate-600">
            Manual: run <code className="font-mono">scripts/reset-demo.sql</code> in the Supabase editor, then reseed with{' '}
            <code className="font-mono">scripts/seed.mjs</code>.
          </p>
        </Card>

        <Card title="Patient death through eRx ingress">
          <DeathSimulationControl />
        </Card>

        <Card title="Simulated inbound SMS">
          <InboundSmsControl />
        </Card>

        <Card title="Vendor phone">
          <p className="mb-2 text-sm text-slate-600">
            Open one of these to reply as the vendor. The reply runs the real parse and the
            agent answers in the thread.
          </p>
          {threadLinks.length === 0 ? (
            <p className="text-sm">No open order has been messaged yet, so there is no thread to open.</p>
          ) : (
            <ul className="space-y-1">
              {threadLinks.map((link) => (
                <li key={link.orderId}>
                  <Link
                    href={`/demo/thread/${link.orderId}`}
                    className="block rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="font-semibold">{link.orderNo}</span>
                    <span className="text-slate-600"> · {link.vendorName} · {link.patientName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Vendor run-list link">
          {demoData.magicLink ? <RunListLink link={demoData.magicLink} /> : <p className="text-sm">No magic links yet</p>}
        </Card>
      </div>
    </main>
  )
}
