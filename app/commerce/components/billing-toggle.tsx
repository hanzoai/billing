'use client'

import { useState } from 'react'
import { PlanCard, type PricingPlan } from './plan-card'

interface BillingToggleProps {
  plans: PricingPlan[]
}

export function BillingToggle({ plans }: BillingToggleProps) {
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')

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
