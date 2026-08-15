'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendVendorReply } from '@/app/actions/vendor-reply'

export default function ReplyForm({ orderId }: { orderId: string }) {
  const [body, setBody] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    const text = body.trim()
    if (!text || pending) return
    startTransition(async () => {
      const state = await sendVendorReply(orderId, text)
      setNote(state.message)
      if (state.ok) setBody('')
      router.refresh()
    })
  }

  return (
    <div
      className="mt-3 rounded-[10px] p-3"
      style={{ background: 'var(--paper-alt)', border: '1px solid var(--line)' }}
    >
      <label htmlFor="vendor-reply" className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        Reply as the vendor
      </label>
      <textarea
        id="vendor-reply"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        rows={2}
        placeholder="running late, maybe 45 min"
        className="mt-1 w-full rounded-[3px] p-2 text-[14px]"
        style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || body.trim() === ''}
        className="mt-2 w-full rounded-[3px] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.06em] disabled:opacity-50"
        style={{ background: 'var(--secondary)', color: '#FFFFFF' }}
      >
        {pending ? 'Sending' : 'Send'}
      </button>
      {note ? <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">{note}</p> : null}
    </div>
  )
}
