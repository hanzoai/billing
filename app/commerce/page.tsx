import type { Metadata } from 'next'
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

// The paint before the catalog answers. Every row here is a copy of a row the
// catalog owns, so it is generated from the catalog rather than written: read
// api.hanzo.ai/v1/pricing/subscriptions and paste what it returns.
const FALLBACK_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "An account and the free models, bounded by a daily allowance.",
    priceMonthly: 0,
    priceAnnual: 0,
    features: ["The free models — 20 messages a day, resetting at midnight UTC", "60 requests a minute", "Add credit at any time to reach the paid models"],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: "go",
    name: "Go",
    description: "Omnichannel agent hosting and the Hanzo desktop app, for builders getting started.",
    priceMonthly: 8,
    priceAnnual: 7,
    features: ["Hanzo Bot Gateway — host local agents across WhatsApp, Telegram, Discord and Slack", "Hanzo Chat & UI — desktop app layout with instant global model context"],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Multi-agent orchestration, background review, and maximum reasoning depth.",
    priceMonthly: 19,
    priceAnnual: 16.5,
    popular: true,
    features: ["Auto Drive orchestration — multi-agent teams executing repo milestones (/plan, /code, /solve)", "Auto Review — background watcher running changes in hidden git worktrees to suggest fixes silently", "High and XHigh reasoning dials — maximum context processing depth", "Headless browser CDP — the agent tests and screenshots its own front-end work"],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: "max",
    name: "Max",
    description: "Enso orchestration, unlimited managed agents, and shared team workspaces.",
    priceMonthly: 99,
    priceAnnual: 83.25,
    features: ["Enso orchestration — dedicated routing through Hanzo's foundational framework model", "Unlimited managed agents — continuous background scheduling to unified team dashboards", "Shared team workspaces — RBAC, KMS-backed credentials, centralized billing", "Priority GPU inference queues"],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: "team",
    name: "Team",
    description: "For teams building together. Org workspaces, SSO via Hanzo IAM, and one unified bill.",
    priceMonthly: 25,
    priceAnnual: 20,
    features: ["$25 per user per month, or $20 billed annually — minimum 2 seats", "Org workspaces with shared history and projects", "SSO via Hanzo IAM", "One unified bill for everyone", "Centralized, KMS-backed credentials"],
    payouts: { idleResalePercent: 20 },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Dedicated capacity, on-prem or air-gapped deployment, custom SLAs and model hosting.",
    priceMonthly: null,
    contactSales: true,
    features: ["Dedicated compute cluster", "On-premise or air-gapped deployment", "Custom SLA up to 99.999%", "Custom model training and hosting", "SOC 2 support and compliance review", "White-glove onboarding and 24/7 engineering support"],
    payouts: { idleResalePercent: 20 },
  },
]

async function getPlans(): Promise<PricingPlan[]> {
  try {
    const res = await fetch('https://api.hanzo.ai/v1/pricing/subscriptions', {
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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)', display: 'flex' }}>

      {/* ── The rail ─────────────────────────────────────────────────
          A COLUMN on the left, the arrangement hanzo.app and hanzo.chat
          already use, rather than a bar across the top.

          This is an account surface — you come here to do a thing to your
          own billing and then leave — and a horizontal bar spends the one
          dimension a page has least of on four links that never change,
          while pushing the thing you came for down. A rail spends the
          dimension there is plenty of, and it is where every other Hanzo
          app of this kind puts its navigation, so moving between them
          costs no relearning.

          It hides below `md`: 240px of chrome on a 390px phone is most of
          the screen. There the links fall to the footer, which already
          carries them. */}
      <aside
        className="hz-rail"
        style={{
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          height: '100vh',
          width: '240px',
          flexShrink: 0,
          // `display` is NOT here. It is the one property the media query below
          // has to change, and an inline declaration is the wrong place to state
          // something a stylesheet must be able to answer — fighting that with
          // `!important` would leave two homes for one property. `.hz-rail` owns
          // it: flex on a desktop, none on a phone, decided once.
          flexDirection: 'column',
          gap: '4px',
          padding: '20px 12px',
          borderRight: '1px solid color-mix(in oklab, var(--color-text) 7%, transparent)',
          background: 'rgba(9,9,11,0.9)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <a href="https://hanzo.ai" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '4px 8px', marginBottom: '16px' }}>
          <HMark />
          {/* The company's name. A bare "Hanzo" is the one spelling that is
              nobody's in particular, and the rest of the estate says Hanzo AI. */}
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Hanzo AI</span>
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { label: 'Docs', href: 'https://docs.hanzo.ai' },
            { label: 'Chat', href: 'https://hanzo.chat' },
            { label: 'Console', href: 'https://console.hanzo.ai' },
          ].map((link) => (
            <a key={link.label} href={link.href} style={{
              display: 'block',
              padding: '8px 12px',
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
      </aside>

      {/* The page itself, beside the rail. */}
      <div style={{ flex: 1, minWidth: 0 }}>

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
    </div>
  )
}
