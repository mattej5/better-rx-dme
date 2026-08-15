import { now } from '@/src/lib/clock'
import {
  ClockControls,
  DeathSimulationControl,
  InboundSmsControl,
  ResetControl,
  ScenarioControls,
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
      dataMessage: hasData ? null : 'No data yet — run seed (T1)',
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      {children}
    </section>
  )
}

function QrPlaceholder({ link }: { link: string }) {
  return (
    <div>
      <svg
        viewBox="0 0 21 21"
        width="168"
        height="168"
        role="img"
        aria-label="Run-list QR placeholder"
        className="border border-slate-300 bg-white p-2"
      >
        <rect width="21" height="21" fill="white" />
        <path fill="black" d="M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1zM3 3h3v3H3zM15 3h3v3h-3zM3 15h3v3H3zM10 2h1v3h-1zM9 7h4v2H9zM10 11h2v2h-2zM14 10h2v2h-2zM17 9h3v2h-3zM9 15h2v5H9zM12 14h3v2h-3zM14 17h2v3h-2zM17 13h3v2h-3zM18 17h2v3h-2z" />
      </svg>
      <p className="mt-2 text-xs font-semibold text-amber-800">Inline SVG placeholder; use the raw link below.</p>
      <a href={link} className="mt-1 block break-all font-mono text-sm text-blue-700 underline">{link}</a>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default async function DemoPage() {
  const [demoData, virtualNow] = await Promise.all([loadDemoData(), now()])

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-slate-100 p-4 text-slate-900 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Demo control panel</h1>
        <p className="text-sm text-slate-600">Plain presenter utility board. Integration stubs are labeled.</p>
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
          <ResetControl />
        </Card>

        <Card title="Scenario jumps (T2 stubs)">
          <ScenarioControls />
        </Card>

        <Card title="Patient death through eRx ingress">
          <DeathSimulationControl />
        </Card>

        <Card title="Simulated inbound SMS">
          <InboundSmsControl />
        </Card>

        <Card title="Vendor run-list link">
          {demoData.magicLink ? <QrPlaceholder link={demoData.magicLink} /> : <p className="text-sm">No magic links yet (N6)</p>}
        </Card>
      </div>
    </main>
  )
}
