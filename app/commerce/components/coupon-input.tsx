'use client'

import { useState } from 'react'

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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_COMMERCE_API ?? 'https://api.hanzo.ai/api/v1'}/coupons/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
        },
      )
      if (res.ok) {
        const data = await res.json()
        setStatus('ok')
        setMessage(data.description ?? `Code applied: ${trimmed}`)
      } else {
        setStatus('error')
        setMessage('Invalid or expired coupon code.')
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
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${status === 'error' ? 'rgba(239,68,68,0.5)' : status === 'ok' ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#fafafa',
            fontSize: '14px',
            outline: 'none',
            letterSpacing: '0.05em',
          }}
        />
        <button
          type="button"
          onClick={apply}
          disabled={status === 'loading' || !code.trim()}
          style={{
            background: status === 'loading' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '10px 18px',
            color: code.trim() ? '#fafafa' : 'rgba(255,255,255,0.3)',
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
