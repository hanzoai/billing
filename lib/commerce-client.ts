/**
 * Commerce API client for Hanzo billing operations.
 *
 * Inlined from @hanzo/commerce/client (v7.4.0-dev) since the published
 * @hanzo/commerce package does not yet include this module.
 * Replace with `import { Commerce } from '@hanzo/commerce'` once v7.4.0 ships.
 */

const DEFAULT_TIMEOUT_MS = 10_000

export type CommerceClientConfig = {
  commerceUrl: string
  token?: string
}

export type Balance = {
  balance: number
  holds: number
  available: number
}

export type Transaction = {
  id?: string
  owner?: string
  type: 'hold' | 'hold-removed' | 'transfer' | 'deposit' | 'withdraw'
  destinationId?: string
  destinationKind?: string
  sourceId?: string
  sourceKind?: string
  currency: string
  amount: number
  tags?: string[]
  expiresAt?: string
  metadata?: Record<string, unknown>
  createdAt?: string
}

export type Subscription = {
  id?: string
  planId?: string
  userId?: string
  status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | string
  billingType?: 'charge_automatically' | 'send_invoice'
  periodStart?: string
  periodEnd?: string
  trialStart?: string
  trialEnd?: string
  quantity?: number
  createdAt?: string
  discount?: {
    id: string
    code: string | null
    name: string | null
    kind: 'percent' | 'amount'
    value: number
    currency: string | null
    duration: 'forever' | 'once' | 'repeating' | null
    durationInMonths: number | null
  } | null
}

export type Plan = {
  slug?: string
  name?: string
  description?: string
  price?: number
  currency?: string
  interval?: 'monthly' | 'yearly' | string
  intervalCount?: number
  trialPeriodDays?: number
  metadata?: Record<string, unknown>
}

export type Payment = {
  id?: string
  orderId?: string
  userId?: string
  amount?: number
  amountRefunded?: number
  fee?: number
  currency?: string
  status?: 'cancelled' | 'credit' | 'disputed' | 'failed' | 'fraudulent' | 'paid' | 'refunded' | 'unpaid' | string
  captured?: boolean
  live?: boolean
  createdAt?: string
}

export type CommerceInvoice = {
  id?: string
  number?: string
  userId?: string
  subscriptionId?: string
  amount?: number
  tax?: number
  total?: number
  currency?: string
  status?: 'paid' | 'unpaid' | 'failed' | 'pending' | 'refunded' | 'void' | string
  pdfUrl?: string
  createdAt?: string
  dueAt?: string
  items?: Array<{
    id?: string
    description?: string
    quantity?: number
    unitPrice?: number
    total?: number
  }>
}

export type CommercePaymentMethod = {
  id?: string
  userId?: string
  type?: string
  isDefault?: boolean
  card?: {
    brand?: string
    last4?: string
    expMonth?: number
    expYear?: number
    funding?: string
  }
  crypto?: {
    network?: string
    walletAddress?: string
    label?: string
  }
  wire?: {
    bankName?: string
    accountHolder?: string
    routingNumber?: string
    accountLast4?: string
    swift?: string
    iban?: string
    country?: string
  }
  paypal?: {
    email?: string
  }
  bankAccount?: {
    bankName?: string
    last4?: string
    country?: string
    currency?: string
  }
  billingDetails?: {
    name?: string
    email?: string
  }
  createdAt?: string
}

export type CommerceSpendAlert = {
  id?: string
  userId?: string
  title?: string
  threshold?: number
  currency?: string
  triggeredAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type CommerceUsageRecord = {
  meterId?: string
  label?: string
  current?: number
  limit?: number | null
  unit?: string
  cost?: number
  periodStart?: string
  periodEnd?: string
}

export type CommerceUsageSummary = {
  totalCost?: number
  currency?: string
  period?: { start?: string; end?: string }
  records?: CommerceUsageRecord[]
}

export type CommerceDiscountCode = {
  id?: string
  code?: string
  name?: string | null
  kind?: 'percent' | 'amount'
  value?: number
  currency?: string | null
  duration?: 'forever' | 'once' | 'repeating' | null
  durationInMonths?: number | null
  valid?: boolean
}

export class CommerceApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'CommerceApiError'
    this.status = status
  }
}

export class Commerce {
  private readonly baseUrl: string
  private token: string | undefined

  constructor(config: CommerceClientConfig) {
    this.baseUrl = config.commerceUrl.replace(/\/+$/, '')
    this.token = config.token
  }

  setToken(token: string) {
    this.token = token
  }

  private async request<T>(
    path: string,
    opts?: {
      method?: string
      body?: unknown
      token?: string
      params?: Record<string, string>
    },
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)
    if (opts?.params) {
      for (const [k, v] of Object.entries(opts.params)) {
        url.searchParams.set(k, v)
      }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    const headers: Record<string, string> = { Accept: 'application/json' }
    const authToken = opts?.token ?? this.token
    if (authToken) headers.Authorization = `Bearer ${authToken}`
    if (opts?.body) headers['Content-Type'] = 'application/json'

    try {
      const res = await fetch(url.toString(), {
        method: opts?.method ?? 'GET',
        headers,
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new CommerceApiError(res.status, `${res.statusText}: ${text}`.trim())
      }

      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  // ── Balance ──────────────────────────────────────────────────────────

  async getBalance(user: string, currency = 'usd', token?: string): Promise<Balance> {
    return this.request<Balance>('/api/v1/billing/balance', {
      params: { user, currency }, token,
    })
  }

  async addDeposit(
    params: { user: string; currency?: string; amount: number; notes?: string; tags?: string[]; expiresIn?: string },
    token?: string,
  ): Promise<Transaction> {
    return this.request<Transaction>('/api/v1/billing/deposit', {
      method: 'POST', body: params, token,
    })
  }

  async grantStarterCredit(user: string, token?: string): Promise<Transaction> {
    return this.request<Transaction>('/api/v1/billing/credit', {
      method: 'POST', body: { user }, token,
    })
  }

  // ── Transactions ─────────────────────────────────────────────────────

  async getTransactions(
    user: string,
    params?: { limit?: number; offset?: number; currency?: string },
    token?: string,
  ): Promise<Transaction[]> {
    return this.request<Transaction[]>('/api/v1/billing/transactions', {
      params: {
        user,
        ...(params?.limit ? { limit: String(params.limit) } : {}),
        ...(params?.offset ? { offset: String(params.offset) } : {}),
        ...(params?.currency ? { currency: params.currency } : {}),
      },
      token,
    })
  }

  // ── Subscriptions ────────────────────────────────────────────────────

  async subscribe(params: { planId: string; userId: string; paymentToken?: string }, token?: string): Promise<Subscription> {
    return this.request<Subscription>('/api/v1/subscribe', {
      method: 'POST', body: params, token,
    })
  }

  async getSubscription(subscriptionId: string, token?: string): Promise<Subscription | null> {
    try {
      return await this.request<Subscription>(`/api/v1/subscribe/${subscriptionId}`, { token })
    } catch { return null }
  }

  async getUserSubscriptions(userId: string, token?: string): Promise<Subscription[]> {
    try {
      return await this.request<Subscription[]>('/api/v1/subscribe', {
        params: { userId }, token,
      })
    } catch { return [] }
  }

  async cancelSubscription(subscriptionId: string, token?: string): Promise<void> {
    await this.request<void>(`/api/v1/subscribe/${subscriptionId}`, {
      method: 'DELETE', token,
    })
  }

  async updateSubscription(subscriptionId: string, params: { planId: string }, token?: string): Promise<Subscription> {
    return this.request<Subscription>(`/api/v1/subscribe/${subscriptionId}`, {
      method: 'PATCH', body: params, token,
    })
  }

  async applyDiscount(subscriptionId: string, code: string, token?: string): Promise<CommerceDiscountCode> {
    return this.request<CommerceDiscountCode>(`/api/v1/subscribe/${subscriptionId}/promotion`, {
      method: 'POST', body: { code }, token,
    })
  }

  // ── Plans ────────────────────────────────────────────────────────────

  async getPlans(token?: string): Promise<Plan[]> {
    return this.request<Plan[]>('/api/v1/plan', { token })
  }

  async getPlan(planId: string, token?: string): Promise<Plan | null> {
    try {
      return await this.request<Plan>(`/api/v1/plan/${planId}`, { token })
    } catch { return null }
  }

  // ── Invoices ─────────────────────────────────────────────────────────

  async getInvoices(userId: string, params?: { limit?: number; offset?: number }, token?: string): Promise<CommerceInvoice[]> {
    try {
      return await this.request<CommerceInvoice[]>('/api/v1/billing/invoices', {
        params: {
          user: userId,
          ...(params?.limit ? { limit: String(params.limit) } : {}),
          ...(params?.offset ? { offset: String(params.offset) } : {}),
        },
        token,
      })
    } catch { return [] }
  }

  // ── Payment Methods ──────────────────────────────────────────────────

  async getPaymentMethods(userId: string, token?: string): Promise<CommercePaymentMethod[]> {
    try {
      return await this.request<CommercePaymentMethod[]>('/api/v1/billing/payment-methods', {
        params: { user: userId }, token,
      })
    } catch { return [] }
  }

  async addPaymentMethod(params: CommercePaymentMethod, token?: string): Promise<CommercePaymentMethod> {
    return this.request<CommercePaymentMethod>('/api/v1/billing/payment-methods', {
      method: 'POST', body: params, token,
    })
  }

  async removePaymentMethod(methodId: string, token?: string): Promise<void> {
    await this.request<void>(`/api/v1/billing/payment-methods/${methodId}`, {
      method: 'DELETE', token,
    })
  }

  async setDefaultPaymentMethod(methodId: string, token?: string): Promise<void> {
    await this.request<void>(`/api/v1/billing/payment-methods/${methodId}/default`, {
      method: 'POST', token,
    })
  }

  // ── Usage ────────────────────────────────────────────────────────────

  async getUsage(userId: string, token?: string): Promise<CommerceUsageSummary> {
    try {
      return await this.request<CommerceUsageSummary>('/api/v1/billing/usage', {
        params: { user: userId }, token,
      })
    } catch {
      return { totalCost: 0, currency: 'usd', period: {}, records: [] }
    }
  }

  // ── Spend Alerts ─────────────────────────────────────────────────────

  async getSpendAlerts(userId: string, token?: string): Promise<CommerceSpendAlert[]> {
    try {
      return await this.request<CommerceSpendAlert[]>('/api/v1/billing/spend-alerts', {
        params: { user: userId }, token,
      })
    } catch { return [] }
  }

  async createSpendAlert(params: { userId: string; title: string; threshold: number; currency?: string }, token?: string): Promise<CommerceSpendAlert> {
    return this.request<CommerceSpendAlert>('/api/v1/billing/spend-alerts', {
      method: 'POST', body: params, token,
    })
  }

  async updateSpendAlert(alertId: string, params: { title?: string; threshold?: number }, token?: string): Promise<CommerceSpendAlert> {
    return this.request<CommerceSpendAlert>(`/api/v1/billing/spend-alerts/${alertId}`, {
      method: 'PATCH', body: params, token,
    })
  }

  async deleteSpendAlert(alertId: string, token?: string): Promise<void> {
    await this.request<void>(`/api/v1/billing/spend-alerts/${alertId}`, {
      method: 'DELETE', token,
    })
  }

  // ── Discount Codes ───────────────────────────────────────────────────

  async validateDiscountCode(code: string, token?: string): Promise<CommerceDiscountCode> {
    return this.request<CommerceDiscountCode>('/api/v1/billing/discount/validate', {
      params: { code }, token,
    })
  }
}
