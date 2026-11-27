import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { PlanCard } from '@/app/commerce/components/plan-card'
import { Commerce } from '@/lib/commerce-client'
import {
  annualSaving,
  billableSeats,
  cents,
  chargeTotal,
  money,
  moneyFromCents,
} from '@/lib/money'

import { CreditsPanel } from './credits-panel'
import { InvoicesPayments, sliceInvoicePage } from './invoices-payments'
import { OverviewDashboard } from './overview-dashboard'
import { SubscriptionPortal } from './subscription-portal'
import type { CreditGrant, Invoice, Subscription, SubscriptionPlan } from './types'

const seen = (markup: string) =>
  markup.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&apos;/g, "'")

const PLANS: SubscriptionPlan[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'Starter tier for local experiments',
    price: 0,
    billingPeriod: 'monthly',
    features: ['Community support'],
    category: 'personal',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Individual production tier',
    price: 49,
    annualPrice: 41.5,
    billingPeriod: 'monthly',
    features: ['Priority inference', 'Unlimited chat'],
    highlighted: true,
    category: 'personal',
    trialDays: 14,
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Collaborative workspaces',
    price: 25,
    annualPrice: 20,
    billingPeriod: 'monthly',
    features: ['Shared audit log'],
    category: 'team',
    perSeat: true,
    minSeats: 3,
  },
]

const SUBSCRIPTION: Subscription = {
  id: '',
  customerId: 'cus_1',
  planId: '',
  status: 'active',
  currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
  currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
}

const OVERVIEW_BASE = {
  subscription: SUBSCRIPTION,
  plans: PLANS,
  paymentMethods: [],
  usage: null,
  usageLoading: false,
  creditGrants: [] as CreditGrant[],
  creditBalance: 0,
  isAdmin: false,
  userEmail: 'dev@hanzo.ai',
  invoices: [] as Invoice[],
  spendAlerts: [],
  onNavigate: () => {},
  businessProfile: {
    legalName: 'Hanzo Dev',
    displayName: 'Hanzo Dev',
    registeredAddress: { line1: '1 Main St', city: 'San Francisco', zip: '94105', country: 'US' },
  },
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('mocked /v1/billing client responses drive billing views', () => {
  it('fetches plans, credit grants, credit balance, and invoices from mocked endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const json = (payload: unknown) =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })

      switch (url.pathname) {
        case '/v1/billing/plans':
          return json([
            { slug: 'pro', name: 'Pro', price: 4900, priceAnnual: 4150, currency: 'usd', category: 'personal', features: ['Priority inference'] },
          ])
        case '/v1/billing/credit-balance':
          return json({ userId: 'u_1', balances: [{ currency: 'usd', available: 0 }] })
        case '/v1/billing/credits':
          return json({
            grants: [
              { id: 'gr_1', name: 'Welcome Grant', amountCents: 2000, remainingCents: 1250, currency: 'usd', active: true },
              { id: 'gr_2', name: 'Expired Grant', amountCents: 500, remainingCents: 0, currency: 'usd', active: false, voided: true },
            ],
            count: 2,
          })
        case '/v1/billing/invoices':
          return json([
            { id: 'inv_101', number: 'INV-101', total: 49, currency: 'usd', status: 'paid', createdAt: '2026-01-15T00:00:00Z', items: [{ id: 'it_1', description: 'Pro Plan', quantity: 1, unitPrice: 49, total: 49 }] },
          ])
        case '/v1/billing/usage':
          return json({ user: 'u_1', count: 1, currency: 'usd', usage: [{ transactionId: 'tx_1', amount: 350, currency: 'usd', createdAt: '2026-01-16T00:00:00Z' }] })
        default:
          return new Response('Not Found', { status: 404 })
      }
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const client = new Commerce({ commerceUrl: 'https://api.hanzo.ai', token: 'tok_test' })
    const [plans, balanceResp, grants, rawInvoices, usage] = await Promise.all([
      client.getPlans(),
      client.getCreditBalance('u_1'),
      client.getCreditGrants('u_1'),
      client.getInvoices('u_1'),
      client.getUsage('u_1'),
    ])

    expect(plans[0]?.price).toBe(4900)
    expect(balanceResp.balances?.[0]?.available).toBe(0)
    expect(grants).toHaveLength(2)
    expect(usage.totalCost).toBe(3.5)

    const mappedInvoices: Invoice[] = rawInvoices.map((inv) => ({
      id: inv.id ?? 'inv',
      invoiceNumber: inv.number ?? 'inv',
      date: new Date(inv.createdAt ?? '2026-01-01T00:00:00Z'),
      amount: inv.total ?? 0,
      total: inv.total ?? 0,
      currency: inv.currency,
      status: (inv.status as Invoice['status']) ?? 'paid',
      items: (inv.items ?? []).map((it) => ({
        id: it.id ?? 'item',
        description: it.description ?? '',
        quantity: it.quantity ?? 1,
        unitPrice: it.unitPrice ?? 0,
        total: it.total ?? 0,
      })),
    }))

    const overviewHtml = seen(
      renderToStaticMarkup(
        <OverviewDashboard
          {...OVERVIEW_BASE}
          balance={{ balance: 0, holds: 0, available: balanceResp.balances?.[0]?.available ?? 0 }}
          creditGrants={grants.map((g) => ({
            id: g.id ?? 'gr',
            name: g.name ?? 'Grant',
            amountCents: g.amountCents ?? 0,
            remainingCents: g.remainingCents ?? 0,
            currency: g.currency ?? 'usd',
            active: !!g.active,
            voided: g.voided,
          }))}
          invoices={mappedInvoices}
          usage={{
            totalCost: usage.totalCost ?? 0,
            currency: usage.currency ?? 'usd',
            period: { start: usage.period?.start ?? '', end: usage.period?.end ?? '' },
            records: [],
          }}
        />,
      ),
    )

    expect(overviewHtml).toContain('Your credit balance is $0')
    expect(overviewHtml).toContain('$3.50')
    expect(overviewHtml).toContain('$41.50/mo billed annually')
    expect(overviewHtml).toContain('save $90 a year')

    const creditsHtml = seen(
      renderToStaticMarkup(
        <CreditsPanel
          creditBalance={1250}
          creditGrants={grants.map((g) => ({
            id: g.id ?? 'gr',
            name: g.name ?? 'Grant',
            amountCents: g.amountCents ?? 0,
            remainingCents: g.remainingCents ?? 0,
            currency: g.currency ?? 'usd',
            active: !!g.active,
            voided: g.voided,
          }))}
        />,
      ),
    )
    expect(creditsHtml).toContain('$12.50')
    expect(creditsHtml).toContain('Welcome Grant')
    expect(creditsHtml).toContain('$12.50 of $20.00 remaining')
    expect(creditsHtml).toContain('Expired Grant')
    expect(creditsHtml).toContain('Voided')

    const invoicesHtml = seen(renderToStaticMarkup(<InvoicesPayments invoices={mappedInvoices} />))
    expect(invoicesHtml).toContain('#INV-101')
    expect(invoicesHtml).toContain('$49.00')
    expect(invoicesHtml).toContain('Single Purchase')
    expect(invoicesHtml).toContain('Paid')
  })
})

describe('plan display and seat pricing fidelity', () => {
  it('renders PlanCard monthly, annual, free, and contact-sales states', () => {
    const monthly = seen(
      renderToStaticMarkup(
        <PlanCard
          billingInterval="monthly"
          plan={{
            id: 'pro',
            name: 'Pro',
            description: 'Pro tier',
            priceMonthly: 49,
            priceAnnual: 41.5,
            features: ['Fast models'],
          }}
        />,
      ),
    )
    const annual = seen(
      renderToStaticMarkup(
        <PlanCard
          billingInterval="annual"
          plan={{
            id: 'pro',
            name: 'Pro',
            description: 'Pro tier',
            priceMonthly: 49,
            priceAnnual: 41.5,
            features: ['Fast models'],
          }}
        />,
      ),
    )
    const enterprise = seen(
      renderToStaticMarkup(
        <PlanCard
          billingInterval="monthly"
          plan={{
            id: 'ent',
            name: 'Enterprise',
            description: 'Custom',
            priceMonthly: null,
            contactSales: true,
            features: ['SLA'],
          }}
        />,
      ),
    )
    const free = seen(
      renderToStaticMarkup(
        <PlanCard
          billingInterval="monthly"
          plan={{
            id: 'dev',
            name: 'Developer',
            description: 'Free tier',
            priceMonthly: 0,
            features: ['Starter'],
          }}
        />,
      ),
    )

    expect(monthly).toContain('$49/mo')
    expect(monthly).toContain('billed monthly')
    expect(annual).toContain('$41.5/mo')
    expect(annual).toContain('billed annually')
    expect(annual).toContain('Save $90/yr')
    expect(enterprise).toContain('Contact sales')
    expect(enterprise).toContain('Talk to sales')
    expect(free).toContain('Free')
    expect(billableSeats(PLANS[2]!, 1)).toBe(3)
    expect(chargeTotal(PLANS[2]!, 1)).toBe(75)
  })

  it('renders fractional prices in SubscriptionPortal without truncating cents', () => {
    const portalHtml = seen(
      renderToStaticMarkup(
        <SubscriptionPortal
          subscription={SUBSCRIPTION}
          availablePlans={[{ ...PLANS[1]!, price: 8.25, annualPrice: 7 }]}
          defaultView="plans"
        />,
      ),
    )
    expect(portalHtml).toContain('$8.25')
  })
})

describe('currency precision and insufficient-balance banners', () => {
  it('avoids negative-zero output and float drift in cents/annualSaving', () => {
    expect(money(-0)).toBe('$0.00')
    expect(money(-0.001, 'USD', 2)).toBe('$0.00')
    expect(moneyFromCents(-0)).toBe('$0.00')
    expect(cents(20.000000000000004)).toBe(0)
    expect(cents(16.5)).toBe(2)
    expect(annualSaving({ price: 49, annualPrice: 41.5 })).toBe(90)
  })

  it('shows insufficient-balance banner only on read zero/negative balances', () => {
    const zeroHtml = seen(
      renderToStaticMarkup(
        <OverviewDashboard {...OVERVIEW_BASE} balance={{ balance: 0, holds: 0, available: 0 }} />,
      ),
    )
    const negativeHtml = seen(
      renderToStaticMarkup(
        <OverviewDashboard {...OVERVIEW_BASE} balance={{ balance: -250, holds: 0, available: -250 }} />,
      ),
    )
    const positiveHtml = seen(
      renderToStaticMarkup(
        <OverviewDashboard {...OVERVIEW_BASE} balance={{ balance: 1500, holds: 0, available: 1500 }} />,
      ),
    )
    const errorHtml = seen(
      renderToStaticMarkup(
        <OverviewDashboard {...OVERVIEW_BASE} balance={null} balanceError="503 unavailable" />,
      ),
    )

    expect(zeroHtml).toContain('Your credit balance is $0')
    expect(zeroHtml).toContain('Add funds')
    expect(negativeHtml).toContain('Your credit balance is -$2.50')
    expect(positiveHtml).not.toContain('Your credit balance is')
    expect(errorHtml).not.toContain('Your credit balance is')
  })
})

describe('invoice history pagination and clamping', () => {
  const makeInvoices = (count: number): Invoice[] =>
    Array.from({ length: count }, (_, idx) => ({
      id: `inv_${idx + 1}`,
      invoiceNumber: `INV-${idx + 1}`,
      date: new Date('2026-01-10T00:00:00Z'),
      amount: 10 + idx,
      total: 10 + idx,
      currency: 'usd',
      status: idx % 2 === 0 ? 'paid' : 'failed',
    }))

  it('paginates >20 invoices and clamps page index when list shrinks after retry', () => {
    const html21 = seen(renderToStaticMarkup(<InvoicesPayments invoices={makeInvoices(21)} />))
    expect(html21).toContain('Showing 1–20 of 21')
    expect(html21).toContain('#INV-1')
    expect(html21).not.toContain('#INV-21')
    expect(html21).toContain('Previous')
    expect(html21).toContain('Next')

    // Simulate page 2 (index 1) followed by shrunk 1-invoice retry result
    const page2BeforeRetry = sliceInvoicePage(makeInvoices(21), 1)
    expect(page2BeforeRetry.safePage).toBe(1)
    expect(page2BeforeRetry.totalPages).toBe(2)
    expect(page2BeforeRetry.pageInvoices.map((i) => i.invoiceNumber)).toEqual(['INV-21'])

    const afterRetryShrink = sliceInvoicePage(makeInvoices(1), 1)
    expect(afterRetryShrink.safePage).toBe(0)
    expect(afterRetryShrink.totalPages).toBe(1)
    expect(afterRetryShrink.pageInvoices.map((i) => i.invoiceNumber)).toEqual(['INV-1'])
  })
})
