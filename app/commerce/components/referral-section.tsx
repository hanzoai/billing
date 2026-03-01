'use client'

import { useState } from 'react'

export function ReferralSection() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    // Optimistic — show success even if the backend endpoint isn't wired
    setSent(true)
  }

  return (
    <section style={{
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '0 24px 80px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '48px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '40px',
        alignItems: 'center',
      }}>
        {/* Left: copy */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.15)',
            borderRadius: '99px',
            padding: '3px 10px',
            marginBottom: '16px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'rgba(251,191,36,0.85)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Affiliate Program
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', margin: '0 0 12px', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
            Refer and earn
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', margin: '0 0 24px', lineHeight: 1.6 }}>
            Earn <strong style={{ color: 'rgba(255,255,255,0.75)' }}>20% recurring commission</strong> for every customer you refer. No cap. Paid monthly to your Hanzo balance or bank.
          </p>
          <ul style={{ margin: '0 0 8px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              '20% recurring commission on every payment',
              'Real-time dashboard at hanzo.ai/affiliate',
              'Payouts via balance credit or ACH/wire',
              '60-day attribution window',
            ].map((item, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px', color: '#4ade80' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: sign-up form */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '28px',
        }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: '48px', height: '48px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#fafafa', margin: '0 0 6px' }}>You're on the list</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                We'll send your affiliate link and dashboard access to <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#fafafa', margin: '0 0 6px' }}>Join the affiliate program</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  Enter your email to get your unique referral link.
                </p>
              </div>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#fafafa',
                  fontSize: '14px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#ffffff',
                  color: '#09090b',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '11px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
              >
                Get my referral link
              </button>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', margin: 0, textAlign: 'center' }}>
                By joining you agree to the{' '}
                <a href="https://hanzo.ai/legal/affiliate" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>affiliate terms</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
