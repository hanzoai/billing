'use client'

import { useState } from 'react'
import { PlanCard, type PricingPlan } from './plan-card'

interface BillingToggleProps {
  plans: PricingPlan[]
}

export function BillingToggle({ plans }: BillingToggleProps) {
  // ANNUAL first. It is the cheaper of the two and the one most buyers take, so
  // it is the price the page should be answering "what does this cost?" with —
  // Team reads $20 per user rather than $25, and the monthly rate is one click
  // away for anyone who wants it.
  //
  // The same choice hanzo.ai's team strip already made, for the same reason
  // stated there: annual is the headline, month-to-month is the note under it.
  // Two surfaces quoting the same plan at two different numbers is the thing
  // worth avoiding.
  const [interval, setInterval] = useState<'monthly' | 'annual'>('annual')

  return (
    <>
      {/* Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex',
          background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
          border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
          borderRadius: '10px',
          padding: '4px',
          gap: '4px',
        }}>
          {(['monthly', 'annual'] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              style={{
                background: interval === iv ? 'color-mix(in oklab, var(--color-text) 10%, transparent)' : 'transparent',
                border: interval === iv ? '1px solid color-mix(in oklab, var(--color-text) 15%, transparent)' : '1px solid transparent',
                borderRadius: '7px',
                padding: '6px 16px',
                color: interval === iv ? 'var(--color-text)' : 'color-mix(in oklab, var(--color-text) 40%, transparent)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {iv === 'monthly' ? 'Monthly' : 'Annual'}
              {iv === 'annual' && (
                <span style={{
                  background: 'rgba(74,222,128,0.15)',
                  color: '#4ade80',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  letterSpacing: '0.03em',
                }}>
                  Save 20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
      }}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} billingInterval={interval} />
        ))}
      </div>
    </>
  )
}
