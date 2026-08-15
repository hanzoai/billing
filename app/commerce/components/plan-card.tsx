'use client'

import { SALES_URL } from '@/lib/config'

export interface PricingPlan {
  id: string
  name: string
  description: string
  /** DOLLARS. `null` on a tier sold by a person — not zero, and not free. */
  priceMonthly: number | null
  priceAnnual?: number
  category?: string
  popular?: boolean
  features: string[]
  payouts?: { idleResalePercent?: number }
  contactSales?: boolean
}

interface PlanCardProps {
  plan: PricingPlan
  billingInterval: 'monthly' | 'annual'
}

const BILLING_URL = 'https://billing.hanzo.ai'
const CAL_URL = SALES_URL

/**
 * Sold by a person — no self-serve price, and the CTA books a conversation.
 *
 * This test was written out four times (the price, the CTA's words, the CTA's
 * destination, and the card's own layout), which is how they came to disagree.
 * Stated once, they cannot.
 */
function bySales(plan: PricingPlan): boolean {
  return !!plan.contactSales || plan.priceMonthly == null || plan.priceMonthly >= 9999
}

/**
 * Costs nothing — which is NOT the same fact as having no price.
 *
 * Enterprise advertised itself as "Free". The catalog gives it
 * `priceMonthly: null`, the projection turned that into 0, and 0 read as free —
 * on the one tier nobody may self-serve. Only one of those two is a discount.
 */
function isFreePlan(plan: PricingPlan): boolean {
  return !bySales(plan) && plan.priceMonthly === 0
}

function price(plan: PricingPlan, interval: 'monthly' | 'annual'): string {
  if (bySales(plan)) return 'Contact sales'
  if (isFreePlan(plan)) return 'Free'
  const amt = interval === 'annual' && plan.priceAnnual ? plan.priceAnnual : plan.priceMonthly!
  return `$${amt}/mo`
}

// `priceAnnual` is the MONTHLY rate when billed for a year, not a yearly total,
// so a year's saving is twelve times the difference.
function annualSavings(plan: PricingPlan): string | null {
  if (bySales(plan) || !plan.priceAnnual || !plan.priceMonthly) return null
  const saved = (plan.priceMonthly - plan.priceAnnual) * 12
  if (saved <= 0) return null
  return `Save $${saved}/yr`
}

function ctaLabel(plan: PricingPlan): string {
  return bySales(plan) ? 'Talk to sales' : 'Get started'
}

function ctaHref(plan: PricingPlan): string {
  return bySales(plan) ? CAL_URL : `${BILLING_URL}#pricing`
}

export function PlanCard({ plan, billingInterval }: PlanCardProps) {
  const isPopular = plan.popular
  const isFree = isFreePlan(plan)
  const isSales = bySales(plan)
  const savings = annualSavings(plan)

  return (
    <div
      style={{
        position: 'relative',
        background: isPopular ? 'color-mix(in oklab, var(--color-text) 5%, transparent)' : 'color-mix(in oklab, var(--color-text) 2%, transparent)',
        border: isPopular ? '1px solid color-mix(in oklab, var(--color-text) 20%, transparent)' : '1px solid color-mix(in oklab, var(--color-text) 8%, transparent)',
        borderRadius: '16px',
        padding: '28px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Popular badge */}
      {isPopular && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-brand)',
          color: 'var(--color-brand-foreground)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '3px 12px',
          borderRadius: '99px',
          whiteSpace: 'nowrap',
        }}>
          Most Popular
        </div>
      )}

      {/* Header */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          {plan.name}
        </h3>
        <p style={{ fontSize: '13px', color: 'color-mix(in oklab, var(--color-text) 45%, transparent)', margin: 0, lineHeight: 1.5 }}>
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <span style={{ fontSize: isFree || isSales ? '28px' : '36px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {price(plan, billingInterval)}
        </span>
        {!isFree && !isSales && (
          <span style={{ fontSize: '13px', color: 'color-mix(in oklab, var(--color-text) 35%, transparent)', marginBottom: '4px' }}>
            {billingInterval === 'annual' ? 'billed annually' : 'billed monthly'}
          </span>
        )}
      </div>

      {/* Annual savings badge */}
      {billingInterval === 'annual' && savings && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'rgba(74,222,128,0.1)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: '6px',
          padding: '3px 8px',
          fontSize: '12px',
          color: '#4ade80',
          fontWeight: 500,
          marginTop: '-12px',
          width: 'fit-content',
        }}>
          {savings}
        </div>
      )}

      {/* CTA */}
      <a
        href={ctaHref(plan)}
        style={{
          display: 'block',
          textAlign: 'center',
          background: isPopular ? 'var(--color-brand)' : 'color-mix(in oklab, var(--color-text) 6%, transparent)',
          color: isPopular ? 'var(--color-brand-foreground)' : 'var(--color-text)',
          border: isPopular ? 'none' : '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
      >
        {ctaLabel(plan)}
      </a>

      {/* Features */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'color-mix(in oklab, var(--color-text) 60%, transparent)', lineHeight: 1.4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px', color: '#4ade80' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {/* Payout badge */}
      {plan.payouts?.idleResalePercent && (
        <div style={{
          marginTop: 'auto',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.15)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: 'rgba(251,191,36,0.85)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          Earn {plan.payouts.idleResalePercent}% on idle compute resale
        </div>
      )}
    </div>
  )
}
