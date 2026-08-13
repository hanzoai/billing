'use client'

import { useState } from 'react'
import { getOrgByHost } from '@/lib/config'

export function CouponInput() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const apply = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setStatus('loading')
    setMessage('')
    try {
      const { commerceUrl } = getOrgByHost(window.location.host)
      const res = await fetch(`${commerceUrl}/v1/coupon/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      // The validate endpoint returns 200 with { valid, coupon, rewards } for
      // known codes (valid:false for unknown/expired) and a non-2xx only on
      // transport or auth errors.
      const data = await res.json().catch(() => null)
      if (res.ok && data?.valid) {
        const reward = Array.isArray(data.rewards) && data.rewards.length > 0
          ? data.rewards[0]?.description
          : undefined
        setStatus('ok')
        setMessage(reward ?? data.coupon?.name ?? `Code applied: ${trimmed}`)
      } else if (res.ok) {
        setStatus('error')
        setMessage(data?.error ?? 'Invalid or expired coupon code.')
      } else {
        setStatus('error')
        setMessage('Unable to validate coupon right now.')
      }
    } catch {
      setStatus('error')
      setMessage('Unable to validate coupon right now.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
      <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '380px' }}>
        <input
          type="text"
          placeholder="Coupon or promo code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setStatus('idle'); setMessage('') }}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          style={{
            flex: 1,
            background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
            border: `1px solid ${status === 'error' ? 'rgba(239,68,68,0.5)' : status === 'ok' ? 'rgba(34,197,94,0.5)' : 'color-mix(in oklab, var(--color-text) 10%, transparent)'}`,
            borderRadius: '8px',
            padding: '10px 14px',
            color: 'var(--color-text)',
            fontSize: '14px',
            letterSpacing: '0.05em',
          }}
        />
        <button
          type="button"
          onClick={apply}
          disabled={status === 'loading' || !code.trim()}
          style={{
            background: status === 'loading' ? 'color-mix(in oklab, var(--color-text) 6%, transparent)' : 'color-mix(in oklab, var(--color-text) 9%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-text) 12%, transparent)',
            borderRadius: '8px',
            padding: '10px 18px',
            color: code.trim() ? 'var(--color-text)' : 'color-mix(in oklab, var(--color-text) 30%, transparent)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: code.trim() && status !== 'loading' ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {message && (
        <p style={{
          fontSize: '13px',
          color: status === 'ok' ? '#4ade80' : '#f87171',
          margin: 0,
        }}>
          {message}
        </p>
      )}
    </div>
  )
}
