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

  async cancelSubscription(subscriptionId: string, token?: string): Promise<void> {
    await this.request<void>(`/api/v1/subscribe/${subscriptionId}`, {
      method: 'DELETE', token,
    })
  }

  async getPlans(token?: string): Promise<Plan[]> {
    return this.request<Plan[]>('/api/v1/plan', { token })
  }

  async getPlan(planId: string, token?: string): Promise<Plan | null> {
    try {
      return await this.request<Plan>(`/api/v1/plan/${planId}`, { token })
    } catch { return null }
  }
}
