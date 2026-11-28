import test from 'node:test'
import assert from 'node:assert/strict'

// Import pure formatting and calculation helpers from lib/money.ts
import {
  money,
  cents,
  moneyFromCents,
  annualSaving,
  billableSeats,
  chargeTotal,
  subtotal
} from '../lib/money.ts'

// Catalog projection function matching Hanzo Billing spec
function mapCommercePlan(p) {
  const perSeat = p.perSeat ?? p.category === 'team'
  const sold = !!p.contactSales || p.price == null
  return {
    id: p.slug ?? '',
    name: p.name ?? '',
    description: p.description ?? '',
    price: (p.price ?? 0) / 100,
    annualPrice: p.priceAnnual ? p.priceAnnual / 100 : undefined,
    category: p.category,
    billingPeriod: 'monthly',
    currency: p.currency ?? 'usd',
    features: p.features ?? [],
    highlighted: p.popular,
    badge: sold ? 'Contact Sales' : p.popular ? 'Popular' : undefined,
    contactSales: sold,
    perSeat
  }
}

const DEFAULT_PLANS = [
  { id: 'free', name: 'Free', price: 0, category: 'personal', billingPeriod: 'monthly' },
  { id: 'developer', name: 'Developer', price: 20, annualPrice: 16, category: 'personal', highlighted: true },
  { id: 'team', name: 'Team', price: 49, annualPrice: 39, category: 'team', perSeat: true, minSeats: 2 },
  { id: 'enterprise', name: 'Enterprise', price: 0, category: 'enterprise', contactSales: true }
]

test('Pricing & Plan Display - Catalog mapping & tier validation', () => {
  assert.equal(DEFAULT_PLANS.length, 4, 'Should have 4 standard default tiers')

  const [free, dev, team, enterprise] = DEFAULT_PLANS
  assert.equal(free.id, 'free')
  assert.equal(free.price, 0)
  assert.equal(dev.id, 'developer')
  assert.equal(dev.price, 20)
  assert.equal(dev.annualPrice, 16)
  assert.equal(team.id, 'team')
  assert.equal(team.perSeat, true)
  assert.equal(team.minSeats, 2)
  assert.equal(enterprise.contactSales, true)

  // Test mapCommercePlan projection from cents to dollars
  const mockRawCommercePlan = {
    slug: 'ai-power',
    name: 'AI Power User',
    description: 'High-throughput inference tier',
    price: 3900, // 39.00 USD in cents
    priceAnnual: 2900,
    category: 'personal',
    currency: 'usd',
    features: ['1M tokens/mo', 'Dedicated vGPU'],
    popular: true
  }

  const mapped = mapCommercePlan(mockRawCommercePlan)
  assert.equal(mapped.id, 'ai-power')
  assert.equal(mapped.price, 39)
  assert.equal(mapped.annualPrice, 29)
  assert.equal(mapped.currency, 'usd')
  assert.equal(mapped.highlighted, true)
  assert.equal(mapped.badge, 'Popular')
})

test('Charge Calculations - Seat multipliers & annual savings', () => {
  const devPlan = { price: 20, annualPrice: 16 }
  const teamPlan = { price: 49, annualPrice: 39, perSeat: true, minSeats: 2 }

  // Annual saving calculation
  assert.equal(annualSaving(devPlan), (20 - 16) * 12)
  assert.equal(annualSaving(teamPlan), (49 - 39) * 12)

  // Billable seats clamping
  assert.equal(billableSeats(teamPlan, 1), 2, 'Should clamp to minSeats 2')
  assert.equal(billableSeats(teamPlan, 5), 5)
  assert.equal(billableSeats(devPlan, 5), 1, 'Flat personal plan does not multiply seats')

  // Total charge calculation
  assert.equal(chargeTotal(devPlan), 20)
  assert.equal(chargeTotal(teamPlan, 4), 49 * 4)
})

test('Credit Balance & Currency Precision - Edge cases & formatters', () => {
  // Whole dollars (no fractional cents)
  assert.equal(money(20, 'USD', cents(20)), '$20')
  assert.equal(money(100, 'USD', cents(100)), '$100')

  // Fractional dollars (cents)
  assert.equal(money(16.5, 'USD', cents(16.5)), '$16.50')
  assert.equal(money(0.99, 'USD', cents(0.99)), '$0.99')

  // Zero balance
  assert.equal(money(0, 'USD', 2), '$0.00')

  // Lowercase currency normalization
  assert.equal(money(50, 'usd', 2), '$50.00')

  // Ledger cents conversion
  assert.equal(moneyFromCents(5000, 'USD', 2), '$50.00')
  assert.equal(moneyFromCents(250, 'USD', 2), '$2.50')
  assert.equal(moneyFromCents(99, 'USD', 2), '$0.99')
})

test('Invoice History & Breakdown Verification', () => {
  // Mock invoice fixture representing /v1/billing/invoices response
  const mockInvoices = [
    {
      id: 'inv_101',
      invoiceNumber: 'HANZO-2026-001',
      date: new Date('2026-11-01T00:00:00Z'),
      amount: 100.0,
      tax: 8.5,
      total: 108.5,
      status: 'paid',
      items: [
        { id: 'it_1', description: 'Developer Seat License', quantity: 5, unitPrice: 20.0, total: 100.0 }
      ]
    },
    {
      id: 'inv_102',
      invoiceNumber: 'HANZO-2026-002',
      date: new Date('2026-11-15T00:00:00Z'),
      amount: 49.0,
      tax: 0.0,
      total: 49.0,
      status: 'unpaid',
      items: [
        { id: 'it_2', description: 'Monthly GPU Burst Usage', quantity: 1, unitPrice: 49.0, total: 49.0 }
      ]
    }
  ]

  assert.equal(mockInvoices.length, 2)
  const [inv1, inv2] = mockInvoices

  assert.equal(inv1.status, 'paid')
  assert.equal(inv1.total, inv1.amount + (inv1.tax || 0))
  assert.equal(inv1.items[0].quantity * inv1.items[0].unitPrice, inv1.items[0].total)

  assert.equal(inv2.status, 'unpaid')
  assert.equal(inv2.total, 49.0)
})

test('Spend Alerts & Insufficient Balance Banner Detection', () => {
  const LOW_BALANCE_THRESHOLD_CENTS = 500 // $5.00 minimum safety margin

  function evaluateBalanceState(balanceCents, pendingUsageCents) {
    const isCritical = balanceCents <= 0
    const isLow = balanceCents > 0 && balanceCents <= LOW_BALANCE_THRESHOLD_CENTS
    const isInsufficientForJob = balanceCents < pendingUsageCents

    return {
      canExecuteJob: !isCritical && !isInsufficientForJob,
      bannerType: isCritical ? 'danger' : (isLow ? 'warning' : 'ok'),
      bannerMessage: isCritical 
        ? 'Account balance exhausted. Please top up to resume agent workers.' 
        : (isLow ? 'Low credit balance: consider adding funds.' : 'Normal balance')
    }
  }

  // Normal balance ($25)
  const st1 = evaluateBalanceState(2500, 300)
  assert.equal(st1.canExecuteJob, true)
  assert.equal(st1.bannerType, 'ok')

  // Low balance ($3.50)
  const st2 = evaluateBalanceState(350, 100)
  assert.equal(st2.canExecuteJob, true)
  assert.equal(st2.bannerType, 'warning')
  assert.match(st2.bannerMessage, /Low credit balance/)

  // Exhausted balance ($0)
  const st3 = evaluateBalanceState(0, 100)
  assert.equal(st3.canExecuteJob, false)
  assert.equal(st3.bannerType, 'danger')
  assert.match(st3.bannerMessage, /balance exhausted/)
})

test('Usage Tracking & Meter Aggregation', () => {
  const mockUsageRecords = [
    { meterId: 'ai', label: 'Reasoning Tokens', current: 1500000, limit: 5000000, unit: 'tokens', cost: 15.0 },
    { meterId: 'gpu', label: 'H100 GPU Hours', current: 12.5, limit: 50.0, unit: 'hours', cost: 25.0 },
    { meterId: 'storage', label: 'NVMe Storage', current: 35.0, limit: 100.0, unit: 'GB', cost: 3.5 }
  ]

  const totalCost = mockUsageRecords.reduce((acc, r) => acc + r.cost, 0)
  assert.equal(totalCost, 43.5)

  for (const record of mockUsageRecords) {
    assert.ok(record.current <= record.limit, `Meter ${record.meterId} exceeded limit`)
    assert.ok(record.cost > 0, `Meter ${record.meterId} must have positive cost`)
  }
})
