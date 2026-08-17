/**
 * A panel states WHY it is empty, and the shell hands it the reason.
 *
 * `loadBillingData` fans out ten reads with Promise.allSettled and records a
 * reason per panel in `loadErrors`. Recording it is half the job: an empty list
 * and a failed read look identical once they reach a component, so a panel that
 * takes the reason and drops it renders a failure as a fact about the customer
 * — "no payment methods on file", "no subscription", "$0.00".
 *
 * Two halves, and each was right on its own while the pair was broken: a panel
 * must SAY the reason it is given, and the shell must GIVE it. The second half
 * is checked as a set — every read that records a reason renders one — so a
 * read added tomorrow has to be wired before this passes.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AccountMembers } from './account-members'
import { CreditsPanel } from './credits-panel'
import { InvoicesPayments } from './invoices-payments'
import { OverviewDashboard } from './overview-dashboard'
import { PaymentMethodManager } from './payment-manager'
import { SpendAlertsPanel } from './spend-alerts'
import { SubscriptionPortal } from './subscription-portal'
import { TransactionsPanel } from './transactions-panel'
import type { Subscription } from './types'

// The sentence a 503 produces today, verbatim from the shell's `why`.
const REASON = "Billing couldn't answer (503). no available server"

/** What a reader sees, not what React escaped it to. */
const seen = (markup: string) => markup.replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

/** A balance READ and found empty — the only thing entitled to print $0.00. */
const ZERO_BALANCE = { balance: 0, holds: 0, available: 0 }

const SUBSCRIPTION: Subscription = {
  id: '',
  customerId: '',
  planId: '',
  status: 'active',
  currentPeriodStart: new Date('2026-01-01'),
  currentPeriodEnd: new Date('2026-02-01'),
}

const OVERVIEW = {
  subscription: SUBSCRIPTION,
  plans: [],
  paymentMethods: [],
  usage: null,
  usageLoading: false,
  creditGrants: [],
  creditBalance: 0,
  isAdmin: false,
  userEmail: 'z@hanzo.ai',
  invoices: [],
  spendAlerts: [],
  onNavigate: () => {},
  businessProfile: {
    legalName: '',
    displayName: '',
    registeredAddress: { line1: '', city: '', zip: '', country: 'US' },
  },
}

/**
 * One row per read.
 *
 * `claim` is what the panel prints when the account genuinely holds nothing —
 * true after a read, false after a failure. `failed` renders the panel with a
 * reason; `read` renders the same panel with a successful, empty read, which is
 * what keeps `claim` honest: a panel could otherwise pass by never printing it.
 */
const PANELS: Array<{ panel: string; claim: string; failed: () => string; read: () => string }> = [
  {
    panel: 'payment',
    claim: 'No payment methods on file.',
    failed: () => renderToStaticMarkup(<PaymentMethodManager error={REASON} />),
    read: () => renderToStaticMarkup(<PaymentMethodManager paymentMethods={[]} />),
  },
  {
    panel: 'balance',
    // A balance is money: the zero itself is the claim.
    claim: '$0.00',
    failed: () => renderToStaticMarkup(<OverviewDashboard {...OVERVIEW} balance={null} balanceError={REASON} />),
    read: () => renderToStaticMarkup(<OverviewDashboard {...OVERVIEW} balance={ZERO_BALANCE} />),
  },
  {
    panel: 'subscriptions',
    claim: 'No subscription',
    failed: () => renderToStaticMarkup(
      <SubscriptionPortal subscription={SUBSCRIPTION} availablePlans={[]} subscriptionError={REASON} />,
    ),
    read: () => renderToStaticMarkup(<SubscriptionPortal subscription={SUBSCRIPTION} availablePlans={[]} />),
  },
  {
    panel: 'invoices',
    claim: 'No invoices yet',
    failed: () => renderToStaticMarkup(<InvoicesPayments invoices={[]} error={REASON} />),
    read: () => renderToStaticMarkup(<InvoicesPayments invoices={[]} />),
  },
  {
    panel: 'payment (overview tile)',
    // The overview's own summary of the same read.
    claim: 'Add a payment method',
    failed: () => renderToStaticMarkup(<OverviewDashboard {...OVERVIEW} balance={ZERO_BALANCE} paymentError={REASON} />),
    read: () => renderToStaticMarkup(<OverviewDashboard {...OVERVIEW} balance={ZERO_BALANCE} />),
  },
  {
    panel: 'creditBalance',
    claim: '$0.00',
    failed: () => renderToStaticMarkup(<CreditsPanel creditGrants={[]} creditBalance={0} balanceError={REASON} />),
    read: () => renderToStaticMarkup(<CreditsPanel creditGrants={[]} creditBalance={0} />),
  },
  {
    panel: 'alerts',
    claim: 'No spend alerts configured.',
    failed: () => renderToStaticMarkup(<SpendAlertsPanel alerts={[]} error={REASON} />),
    read: () => renderToStaticMarkup(<SpendAlertsPanel alerts={[]} />),
  },
  {
    panel: 'plans',
    // The grid already refused to invent a catalog; it never said why.
    claim: '',
    failed: () => renderToStaticMarkup(
      <SubscriptionPortal subscription={SUBSCRIPTION} availablePlans={[]} defaultView="plans" plansError={REASON} />,
    ),
    read: () => renderToStaticMarkup(
      <SubscriptionPortal subscription={SUBSCRIPTION} availablePlans={[]} defaultView="plans" />,
    ),
  },
  {
    panel: 'credits',
    claim: 'No credit grants yet.',
    failed: () => renderToStaticMarkup(<CreditsPanel creditGrants={[]} error={REASON} />),
    read: () => renderToStaticMarkup(<CreditsPanel creditGrants={[]} />),
  },
  {
    panel: 'transactions',
    claim: 'No transactions found.',
    failed: () => renderToStaticMarkup(<TransactionsPanel transactions={[]} error={REASON} />),
    read: () => renderToStaticMarkup(<TransactionsPanel transactions={[]} />),
  },
  {
    panel: 'accounts',
    claim: 'No members yet.',
    failed: () => renderToStaticMarkup(<AccountMembers members={[]} userRole="owner" error={REASON} />),
    read: () => renderToStaticMarkup(<AccountMembers members={[]} userRole="owner" />),
  },
]

describe('a failed read states its reason and claims nothing', () => {
  it.each(PANELS)('$panel', ({ claim, failed }) => {
    const markup = seen(failed())
    expect(markup).toContain(REASON)
    if (claim) expect(markup).not.toContain(claim)
  })
})

describe('a successful read still says what it found', () => {
  it.each(PANELS.filter((p) => p.claim))('$panel', ({ claim, read }) => {
    // The half that keeps the half above from passing vacuously: a panel that
    // never prints its empty state would trade a false "you have none" for no
    // answer at all.
    expect(seen(read())).toContain(claim)
  })
})

describe('the shell hands every recorded reason to a panel', () => {
  const src = readFileSync(new URL('../components/billing-shell.tsx', import.meta.url), 'utf8')

  // Every place a reason becomes a prop. Listed one by one, not matched by a
  // pattern: `payment` feeds two components, and a rule that only asked for
  // "at least one site per read" stayed green when either was deleted.
  const SITES = [
    'balanceError={loadErrors.balance ?? null}',
    'paymentError={loadErrors.payment ?? null}',
    'error={loadErrors.payment ?? null}',
    'subscriptionError={loadErrors.subscriptions ?? null}',
    'plansError={loadErrors.plans ?? null}',
    'error={loadErrors.invoices ?? null}',
    'error={loadErrors.credits ?? null}',
    'balanceError={loadErrors.creditBalance ?? null}',
    'error={loadErrors.transactions ?? null}',
    'error={loadErrors.alerts ?? null}',
    'error={loadErrors.accounts ?? null}',
  ]

  it.each(SITES)('%s', (site) => {
    expect(src).toContain(site)
  })

  it('leaves no recorded reason without a site', () => {
    // The keys `loadBillingData` writes into `loadErrors`, taken from the list
    // it iterates rather than restated here: a read added there with nowhere to
    // render fails this instead of shipping silent.
    const recorded = [...src.matchAll(/\['(\w+)', \w+\]/g)].map((m) => m[1])
    const wired = new Set(SITES.map((s) => s.match(/loadErrors\.(\w+)/)![1]))
    expect(recorded).toHaveLength(10)
    expect(recorded.filter((r) => !wired.has(r))).toEqual([])
  })
})
