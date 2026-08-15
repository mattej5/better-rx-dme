'use client'

import { useActionState } from 'react'
import {
  advanceClock,
  jumpScenario,
  resetSeed,
  simulateInboundSms,
  simulatePatientDeath,
} from '@/app/actions/demo'

type ActionState = {
  message: string
  detail?: string
  ok: boolean
}

const initialState: ActionState = { message: '', ok: false }

function Result({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <div
      aria-live="polite"
      className={`mt-3 rounded border p-3 text-sm ${
        state.ok ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <p className="font-semibold">{state.message}</p>
      {state.detail ? <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{state.detail}</pre> : null}
    </div>
  )
}

function SubmitButton({ children, name, value }: React.ComponentProps<'button'>) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className="rounded border border-slate-400 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function ClockControls() {
  const [state, action, pending] = useActionState(advanceClock, initialState)
  return (
    <form action={action}>
      <div className="flex flex-wrap gap-2" aria-disabled={pending}>
        <SubmitButton name="seconds" value="900">+15m</SubmitButton>
        <SubmitButton name="seconds" value="3600">+1h</SubmitButton>
        <SubmitButton name="seconds" value="86400">+1d</SubmitButton>
      </div>
      <p className="mt-2 text-xs text-slate-600">Advancing the clock also runs the rules sweep against every open order.</p>
      <Result state={state} />
    </form>
  )
}

export function ResetControl() {
  const [state, action, pending] = useActionState(resetSeed, initialState)
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-red-400 bg-white px-3 py-2 text-sm font-semibold text-red-800"
      >
        {pending ? 'Resetting…' : 'Reset seed (stub)'}
      </button>
      <p className="mt-2 text-xs text-slate-600">Not wired up yet. Run scripts/reset-demo.sql, then reseed with scripts/seed.mjs.</p>
      <Result state={state} />
    </form>
  )
}

export function ScenarioControls() {
  const [state, action, pending] = useActionState(jumpScenario, initialState)
  return (
    <form action={action}>
      <div className="flex flex-wrap gap-2" aria-disabled={pending}>
        <SubmitButton name="scenario" value="DME-10305">DME-10305 at risk</SubmitButton>
        <SubmitButton name="scenario" value="DME-09911">DME-09911 pickup</SubmitButton>
        <SubmitButton name="scenario" value="DME-09803">DME-09803 delayed</SubmitButton>
        <SubmitButton name="scenario" value="urgency-cascade">Urgency cascade</SubmitButton>
      </div>
      <p className="mt-2 text-xs text-slate-600">Scenario replay is not landed yet; these buttons are honest stubs.</p>
      <Result state={state} />
    </form>
  )
}

export function InboundSmsControl() {
  const [state, action, pending] = useActionState(simulateInboundSms, initialState)
  return (
    <form action={action}>
      <label htmlFor="vendor-reply" className="block text-sm font-semibold">Vendor reply</label>
      <textarea
        id="vendor-reply"
        name="body"
        required
        rows={4}
        placeholder="Example: stuck behind an accident, maybe 2hrs"
        className="mt-1 w-full rounded border border-slate-400 bg-white p-2 text-sm"
      />
      <label htmlFor="vendor-reply-order" className="mt-2 block text-sm font-semibold">
        Order number (optional)
      </label>
      <input
        id="vendor-reply-order"
        name="orderNo"
        placeholder="Leave blank for the newest order waiting on a vendor"
        className="mt-1 w-full rounded border border-slate-400 bg-white p-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded border border-slate-400 bg-white px-3 py-2 text-sm font-semibold"
      >
        {pending ? 'Parsing…' : 'Simulate inbound SMS'}
      </button>
      <p className="mt-2 text-xs text-slate-600">
        Deterministic first pass. A reply under 0.75 confidence is recorded and left for a nurse
        rather than applied.
      </p>
      <Result state={state} />
    </form>
  )
}

export function DeathSimulationControl() {
  const [state, action, pending] = useActionState(simulatePatientDeath, initialState)
  return (
    <form action={action}>
      <label htmlFor="patient-external-id" className="block text-sm font-semibold">Patient external_id</label>
      <input
        id="patient-external-id"
        name="patientExternalId"
        defaultValue="PT-87602"
        required
        className="mt-1 w-full rounded border border-slate-400 bg-white p-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-white"
      >
        {pending ? 'Posting…' : 'Simulate EMR death via eRx ingress'}
      </button>
      <p className="mt-2 text-xs text-slate-600">Posts to /api/erx/events, the live eRx ingress endpoint. Press again to demonstrate the replay no-op.</p>
      <Result state={state} />
    </form>
  )
}
