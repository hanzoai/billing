import type { Metadata } from 'next'
import { CouponInput } from './components/coupon-input'
import { ReferralSection } from './components/referral-section'
import { BillingToggle } from './components/billing-toggle'
import type { PricingPlan } from './components/plan-card'

export const metadata: Metadata = {
  title: 'Hanzo Commerce — Pricing & Plans',
  description: 'Transparent AI compute pricing. Pay for what you use, scale infinitely. Earn 20% on idle compute resale.',
  metadataBase: new URL('https://commerce.hanzo.ai'),
  openGraph: {
    title: 'Hanzo Commerce — Pricing & Plans',
    description: 'Transparent AI compute pricing. Pay for what you use, scale infinitely.',
    url: 'https://commerce.hanzo.ai',
    siteName: 'Hanzo',
  },
}

// Skeleton fallback when the pricing service is unreachable at build time —
// aligned with the canonical @hanzo/plans/subscription.json tiers.
const FALLBACK_PLANS: PricingPlan[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'Explore the API. No monthly fee — usage is billed to your card.',
    priceMonthly: 0,
    priceAnnual: 0,
    features: ['60 requests/min', '100K tokens/min', 'Community support', 'API access', 'Earn up to 20% on idle compute & LLM resale'],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For developers shipping real products. One $20 subscription with unified AI usage across hanzo.ai, hanzo.app, and hanzo.team.',
    priceMonthly: 20,
    priceAnnual: 16,
    popular: true,
    features: ['$20/mo included usage', 'hanzo.team access — invite up to 3 guests', '500 requests/min', '1M tokens/min', 'Priority inference', 'Earn up to 20% on idle compute & LLM resale'],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: 'plus',
    name: 'Plus',
    description: '5x Pro for power users. Max-tier models and priority support.',
    priceMonthly: 100,
    priceAnnual: 80,
    features: ['Everything in Pro, 5x the usage', '$100/mo included usage', 'hanzo.team access — invite up to 3 guests', '2500 requests/min', '5M tokens/min', 'Max-tier model access', 'Priority support'],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: 'max',
    name: 'Max',
    description: 'Maximum AI power for individuals. 20x Pro usage and unlimited premium models.',
    priceMonthly: 200,
    priceAnnual: 160,
    features: ['Everything in Plus', 'Unlimited premium model access', 'hanzo.team access — invite up to 3 guests', '5000 requests/min', '10M tokens/min', '$100/mo cloud credits included', 'Dedicated support channel'],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'hanzo.team for your whole org. $25 per user, minimum 2 seats.',
    priceMonthly: 25,
    priceAnnual: 20,
    features: ['$25/user/mo — minimum 2 seats', 'SSO / SAML + IAM team management', 'Shared billing + usage analytics', 'Audit log + enterprise-grade security', 'Up to 100 members', 'Priority support'],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full-scale AI infrastructure. Dedicated support, SLA, and on-prem deployment.',
    priceMonthly: 9999,
    priceAnnual: 7999,
    contactSales: true,
    features: ['Unlimited members', 'Multi-region redundancy with automated failover', 'Dedicated account manager', 'Custom rate limits', 'On-premise deployment', 'SOC 2 Type II controls'],
  },
]

async function getPlans(): Promise<PricingPlan[]> {
  try {
    const res = await fetch('https://pricing.hanzo.ai/v1/pricing/subscriptions', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return FALLBACK_PLANS
    const data = await res.json()
    const plans: PricingPlan[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.plans)
        ? data.plans
        : []
    return plans.length > 0 ? plans : FALLBACK_PLANS
  } catch {
    return FALLBACK_PLANS
  }
}

/* ── Static stat cards ─────────────────────────────────────────── */
const STATS = [
  { value: '14+', label: 'Zen AI models' },
  { value: '1M', label: 'Max context window' },
  { value: 'Multi-region', label: 'Automated failover' },
  { value: '20%', label: 'Idle compute payout' },
]

/* ── Hanzo H-mark SVG (inline, no external deps) ───────────────── */
function HMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 67 67" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: 'var(--color-text)' }}>
      <path d="M22.21 67V44.6369H0V67H22.21Z" fill="currentColor" />
      <path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="currentColor" opacity="0.87" />
      <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="currentColor" />
      <path d="M22.21 0H0V22.3184H22.21V0Z" fill="currentColor" />
      <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="currentColor" />
      <path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="currentColor" opacity="0.87" />
      <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="currentColor" />
    </svg>
  )
}

export default async function CommercePage() {
  const plans = await getPlans()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' }}>

      {/* ── Nav bar ──────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        padding: '0 24px',
        borderBottom: '1px solid color-mix(in oklab, var(--color-text) 7%, transparent)',
        background: 'rgba(9,9,11,0.9)',
        backdropFilter: 'blur(16px)',
      }}>
        <a href="https://hanzo.ai" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <HMark />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Hanzo</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { label: 'Docs', href: 'https://docs.hanzo.ai' },
            { label: 'Chat', href: 'https://hanzo.chat' },
            { label: 'Console', href: 'https://console.hanzo.ai' },
          ].map((link) => (
            <a key={link.label} href={link.href} style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'color-mix(in oklab, var(--color-text) 40%, transparent)',
              textDecoration: 'none',
              borderRadius: '7px',
              transition: 'color 0.15s',
            }}>
              {link.label}
            </a>
          ))}
          <a href="https://billing.hanzo.ai" style={{
            marginLeft: '8px',
            padding: '7px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-brand-foreground)',
            background: 'var(--color-brand)',
            textDecoration: 'none',
            borderRadius: '8px',
            transition: 'opacity 0.15s',
          }}>
            Sign in
          </a>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 56px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
          border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
          borderRadius: '99px',
          padding: '4px 14px',
          marginBottom: '28px',
          fontSize: '12px',
          fontWeight: 500,
          color: 'color-mix(in oklab, var(--color-text) 50%, transparent)',
        }}>
          <span style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
          All services operational · 20% idle compute resale program active
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 76px)',
          fontWeight: 700,
          lineHeight: 1.05,
          margin: '0 0 20px',
          letterSpacing: '-0.035em',
          maxWidth: '820px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          Transparent AI pricing.<br />
          <span style={{ color: 'color-mix(in oklab, var(--color-text) 35%, transparent)' }}>Scale from zero.</span>
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'color-mix(in oklab, var(--color-text) 45%, transparent)',
          maxWidth: '540px',
          margin: '0 auto 44px',
          lineHeight: 1.65,
        }}>
          Full-stack AI commerce infrastructure — billing, payments, subscriptions, usage metering, and analytics.
        </p>

        {/* Coupon input (client component) */}
        <CouponInput />
      </section>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '0 24px 56px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1px',
        background: 'color-mix(in oklab, var(--color-text) 6%, transparent)',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid color-mix(in oklab, var(--color-text) 8%, transparent)',
      }}>
        {STATS.map((s) => (
          <div key={s.value} style={{
            background: 'var(--color-bg)',
            padding: '28px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text)', marginBottom: '4px' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '13px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)' }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Plans ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: '1100px', margin: '40px auto 0', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--color-text)', margin: '0 0 8px' }}>
            Choose your plan
          </h2>
          <p style={{ fontSize: '15px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0 }}>
            Every plan bills to a card on file. Change or cancel at any time.
          </p>
        </div>

        {/* BillingToggle handles monthly/annual switch + renders plan cards */}
        <BillingToggle plans={plans} />
      </section>

      {/* ── Feature comparison callout ───────────────────────────── */}
      <section style={{ maxWidth: '1100px', margin: '64px auto 0', padding: '0 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1px',
          background: 'color-mix(in oklab, var(--color-text) 6%, transparent)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid color-mix(in oklab, var(--color-text) 8%, transparent)',
        }}>
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              ),
              title: 'All Zen models included',
              body: 'Access the full Zen model family — from 600M to 480B params — across all plans.',
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                </svg>
              ),
              title: 'Crypto, card & wire',
              body: 'Pay with credit card, crypto wallet, or bank wire. All payment methods supported.',
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                </svg>
              ),
              title: 'Real-time usage metering',
              body: 'Per-request cost tracking, spend alerts, and detailed invoices available on all plans.',
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
              title: 'Team & org billing',
              body: 'Shared billing accounts, role-based access, and multi-org support on Team and above.',
            },
          ].map((item, i) => (
            <div key={i} style={{ background: 'var(--color-bg)', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ color: 'color-mix(in oklab, var(--color-text) 50%, transparent)' }}>{item.icon}</div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>{item.title}</h3>
              <p style={{ fontSize: '13px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0, lineHeight: 1.55 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Referral / affiliate section ─────────────────────────── */}
      <div style={{ marginTop: '80px' }}>
        <ReferralSection />
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid color-mix(in oklab, var(--color-text) 7%, transparent)',
        padding: '40px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HMark />
          <span style={{ fontSize: '13px', color: 'color-mix(in oklab, var(--color-text) 30%, transparent)' }}>
            © {new Date().getFullYear()} Hanzo AI Inc.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'Privacy', href: 'https://hanzo.ai/legal/privacy' },
            { label: 'Terms', href: 'https://hanzo.ai/legal/terms' },
            { label: 'Affiliate Terms', href: 'https://hanzo.ai/legal/affiliate' },
            { label: 'Status', href: 'https://status.hanzo.ai' },
            { label: 'Docs', href: 'https://docs.hanzo.ai' },
          ].map((link) => (
            <a key={link.label} href={link.href} style={{ fontSize: '13px', color: 'color-mix(in oklab, var(--color-text) 30%, transparent)', textDecoration: 'none' }}>
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}
