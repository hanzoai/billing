import { describe, expect, it, vi } from 'vitest'

import { annualSaving, billableSeats, cents, money, moneyFromCents, subtotal } from '../money'

const MOCK_PLANS = [
  { id: 'go', name: 'Go', price: 8, annualPrice: 7, currency: 'usd' },
  { id: 'pro', name: 'Pro', price: 19, annualPrice: 16.5, currency: 'usd' },
  { id: 'team', name: 'Team', price: 25, annualPrice: 20, perSeat: true, minSeats: 2, currency: 'usd' },
]

const MOCK_INVOICES = [
  { id: 'inv_01', amountCents: 1900, currency: 'usd', status: 'paid', createdAt: '2026-11-01T00:00:00Z' },
  { id: 'inv_02', amountCents: 5000, currency: 'usd', status: 'open', createdAt: '2026-11-15T00:00:00Z' },
  { id: 'inv_03', amountCents: 0, currency: 'usd', status: 'void', createdAt: '2026-11-20T00:00:00Z' },
]

describe('Billing views & /v1/billing mock-API suite (#1)', () => {
  it('formats plan display prices and annual savings from mocked /v1/billing/plans', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plans: MOCK_PLANS }),
    })
    const res = await fetchMock('/v1/billing/plans')
    const data = await res.json()

    expect(data.plans).toHaveLength(3)
    expect(money(data.plans[0].price, data.plans[0].currency, cents(data.plans[0].price))).toBe('$8')
    expect(money(data.plans[1].annualPrice, data.plans[1].currency, cents(data.plans[1].annualPrice))).toBe('$16.50')
    expect(annualSaving(data.plans[1])).toBe(30)
    expect(billableSeats(data.plans[2], 1)).toBe(2)
    expect(subtotal(data.plans[2], 3)).toBe(75)
  })

  it('formats credit balances and handles -0 / NaN / Infinity edge cases', () => {
    expect(moneyFromCents(1250, 'usd')).toBe('$12.50')
    expect(moneyFromCents(0, 'usd')).toBe('$0.00')
    expect(money(-0, 'usd')).toBe('$0.00')
    expect(money(Number.NaN, 'usd')).toBe('$0.00')
    expect(money(Number.POSITIVE_INFINITY, 'usd')).toBe('$0.00')
  })

  it('formats mocked /v1/billing/invoices history amounts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invoices: MOCK_INVOICES }),
    })
    const res = await fetchMock('/v1/billing/invoices')
    const { invoices } = await res.json()

    const formatted = invoices.map((inv: typeof MOCK_INVOICES[number]) => ({
      id: inv.id,
      total: moneyFromCents(inv.amountCents, inv.currency),
      status: inv.status,
    }))

    expect(formatted).toEqual([
      { id: 'inv_01', total: '$19.00', status: 'paid' },
      { id: 'inv_02', total: '$50.00', status: 'open' },
      { id: 'inv_03', total: '$0.00', status: 'void' },
    ])
  })

  it('evaluates insufficient-balance banner state from mocked /v1/billing/balance', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balanceCents: 150, requiredCents: 500, currency: 'usd' }),
    })
    const res = await fetchMock('/v1/billing/balance')
    const { balanceCents, requiredCents, currency } = await res.json()

    const isInsufficient = balanceCents < requiredCents
    expect(isInsufficient).toBe(true)
    expect(moneyFromCents(balanceCents, currency)).toBe('$1.50')
    expect(moneyFromCents(requiredCents - balanceCents, currency)).toBe('$3.50')
  })
})
