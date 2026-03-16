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

export type CommerceCreditGrant = {
  id?: string
  userId?: string
  name?: string
  amountCents?: number
  remainingCents?: number
  currency?: string
  expiresAt?: string
  priority?: number
  eligibility?: string[]
  tags?: string
  voided?: boolean
  active?: boolean
  createdAt?: string
}

export type CommerceCreditBalance = {
  userId?: string
  balances?: Array<{ currency?: string; available?: number }>
}

export type CommerceMeter = {
  id?: string
  name?: string
  description?: string
  unit?: string
  aggregation?: string
  createdAt?: string
}

export type CommerceMeterEventsSummary = {
  userId?: string
  meters?: Array<{
    meterId?: string
    name?: string
    total?: number
    unit?: string
    dimensions?: Record<string, number>
  }>
  period?: { start?: string; end?: string }
}

export type CommerceBillingAccount = {
  id?: string
  name?: string
  orgId?: string
  orgName?: string
  balance?: number
  currency?: string
  plan?: string
  role?: string
  createdAt?: string
}

export type CommerceBillingAccountMember = {
  id?: string
  userId?: string
  email?: string
  name?: string
  role?: string
  addedAt?: string
}

export type CommercePortalOverview = {
  customerId?: string
  balance?: Balance
  creditBalance?: number
  activeSubscription?: Subscription
  pendingInvoices?: number
  totalSpendThisPeriod?: number
  currency?: string
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
    const url = new URL(`${this.baseUrl}${path}`)
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
    return this.request<Balance>('/v1/billing/balance', {
      params: { user, currency }, token,
    })
  }

  async addDeposit(
    params: { user: string; currency?: string; amount: number; notes?: string; tags?: string[]; expiresIn?: string },
    token?: string,
  ): Promise<Transaction> {
    return this.request<Transaction>('/v1/billing/deposit', {
      method: 'POST', body: params, token,
    })
  }

  async grantStarterCredit(user: string, token?: string): Promise<Transaction> {
    return this.request<Transaction>('/v1/billing/credit', {
      method: 'POST', body: { user }, token,
    })
  }

  // ── Transactions ─────────────────────────────────────────────────────

  async getTransactions(
    user: string,
    params?: { limit?: number; offset?: number; currency?: string },
    token?: string,
  ): Promise<Transaction[]> {
    return this.request<Transaction[]>('/v1/billing/transactions', {
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
    return this.request<Subscription>('/v1/billing/subscriptions', {
      method: 'POST', body: params, token,
    })
  }

  async getSubscription(subscriptionId: string, token?: string): Promise<Subscription | null> {
    try {
      return await this.request<Subscription>(`/v1/billing/subscriptions/${subscriptionId}`, { token })
    } catch { return null }
  }

  async getUserSubscriptions(userId: string, token?: string): Promise<Subscription[]> {
    try {
      return await this.request<Subscription[]>('/v1/billing/subscriptions', {
        params: { userId }, token,
      })
    } catch { return [] }
  }

  async cancelSubscription(subscriptionId: string, token?: string): Promise<void> {
    await this.request<void>(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST', token,
    })
  }

  async updateSubscription(subscriptionId: string, params: { planId: string }, token?: string): Promise<Subscription> {
    return this.request<Subscription>(`/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'PATCH', body: params, token,
    })
  }

  async applyDiscount(subscriptionId: string, code: string, token?: string): Promise<CommerceDiscountCode> {
    return this.request<CommerceDiscountCode>(`/v1/billing/subscriptions/${subscriptionId}/promotion`, {
      method: 'POST', body: { code }, token,
    })
  }

  // ── Plans ────────────────────────────────────────────────────────────

  async getPlans(token?: string): Promise<Plan[]> {
    return this.request<Plan[]>('/v1/billing/plans', { token })
  }

  async getPlan(planId: string, token?: string): Promise<Plan | null> {
    try {
      return await this.request<Plan>(`/v1/billing/plans/${planId}`, { token })
    } catch { return null }
  }

  // ── Invoices ─────────────────────────────────────────────────────────

  async getInvoices(userId: string, params?: { limit?: number; offset?: number }, token?: string): Promise<CommerceInvoice[]> {
    try {
      return await this.request<CommerceInvoice[]>('/v1/billing/invoices', {
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
      return await this.request<CommercePaymentMethod[]>('/v1/billing/payment-methods', {
        params: { user: userId }, token,
      })
    } catch { return [] }
  }

  async addPaymentMethod(params: CommercePaymentMethod, token?: string): Promise<CommercePaymentMethod> {
    return this.request<CommercePaymentMethod>('/v1/billing/payment-methods', {
      method: 'POST', body: params, token,
    })
  }

  async removePaymentMethod(methodId: string, token?: string): Promise<void> {
    await this.request<void>(`/v1/billing/payment-methods/${methodId}`, {
      method: 'DELETE', token,
    })
  }

  async setDefaultPaymentMethod(methodId: string, token?: string): Promise<void> {
    await this.request<void>(`/v1/billing/customers/${methodId}/default-payment-method`, {
      method: 'POST', token,
    })
  }

  // ── Usage ────────────────────────────────────────────────────────────

  async getUsage(userId: string, token?: string): Promise<CommerceUsageSummary> {
    try {
      return await this.request<CommerceUsageSummary>('/v1/billing/usage', {
        params: { user: userId }, token,
      })
    } catch {
      return { totalCost: 0, currency: 'usd', period: {}, records: [] }
    }
  }

  // ── Spend Alerts ─────────────────────────────────────────────────────

  async getSpendAlerts(userId: string, token?: string): Promise<CommerceSpendAlert[]> {
    try {
      return await this.request<CommerceSpendAlert[]>('/v1/billing/spend-alerts', {
        params: { user: userId }, token,
      })
    } catch { return [] }
  }

  async createSpendAlert(params: { userId: string; title: string; threshold: number; currency?: string }, token?: string): Promise<CommerceSpendAlert> {
    return this.request<CommerceSpendAlert>('/v1/billing/spend-alerts', {
      method: 'POST', body: params, token,
    })
  }

  async updateSpendAlert(alertId: string, params: { title?: string; threshold?: number }, token?: string): Promise<CommerceSpendAlert> {
    return this.request<CommerceSpendAlert>(`/v1/billing/spend-alerts/${alertId}`, {
      method: 'PATCH', body: params, token,
    })
  }

  async deleteSpendAlert(alertId: string, token?: string): Promise<void> {
    await this.request<void>(`/v1/billing/spend-alerts/${alertId}`, {
      method: 'DELETE', token,
    })
  }

  // ── Discount Codes ───────────────────────────────────────────────────

  async validateDiscountCode(code: string, token?: string): Promise<CommerceDiscountCode> {
    return this.request<CommerceDiscountCode>('/v1/billing/discount/validate', {
      params: { code }, token,
    })
  }

  // ── Credit Grants ─────────────────────────────────────────────────────

  async getCreditGrants(userId: string, token?: string): Promise<CommerceCreditGrant[]> {
    try {
      return await this.request<CommerceCreditGrant[]>('/v1/billing/credit-grants', {
        params: { userId }, token,
      })
    } catch { return [] }
  }

  async getCreditBalance(userId: string, token?: string): Promise<CommerceCreditBalance> {
    try {
      return await this.request<CommerceCreditBalance>('/v1/billing/credit-balance', {
        params: { userId }, token,
      })
    } catch { return { userId, balances: [] } }
  }

  // ── Payment Processing ──────────────────────────────────────────────

  /** Process a card payment (backend handles PCI-compliant tokenization) */
  async processCardPayment(
    params: { card: { number: string; expMonth: number; expYear: number; cvc: string }; amount: number; userId?: string; currency?: string },
    token?: string,
  ): Promise<Payment> {
    return this.request<Payment>('/v1/billing/payment', {
      method: 'POST', body: { ...params, method: 'card' }, token,
    })
  }

  /** Record a crypto payment (on-chain tx already sent by the client) */
  async recordCryptoPayment(
    params: { txHash: string; network: string; chainId?: number; amount: number; currency: string; userId?: string; fromAddress: string; toAddress: string },
    token?: string,
  ): Promise<Payment> {
    return this.request<Payment>('/v1/billing/payment', {
      method: 'POST', body: { ...params, method: 'crypto' }, token,
    })
  }

  /** Save a Square-tokenized card as a payment method */
  async tokenizeAndAddCard(sourceId: string, userId: string, token?: string): Promise<CommercePaymentMethod> {
    return this.request<CommercePaymentMethod>('/v1/billing/payment-methods', {
      method: 'POST',
      body: { token: sourceId, type: 'card', provider: 'square', userId },
      token,
    })
  }

  /** Record a wire transfer (manual, pending verification) */
  async recordWirePayment(
    params: { userId?: string; amount: number; currency?: string; reference?: string },
    token?: string,
  ): Promise<Payment> {
    return this.request<Payment>('/v1/billing/payment', {
      method: 'POST', body: { ...params, method: 'wire' }, token,
    })
  }

  // ── Portal ────────────────────────────────────────────────────────────

  async getPortalOverview(customerId: string, token?: string): Promise<CommercePortalOverview> {
    return this.request<CommercePortalOverview>('/v1/billing/portal/overview', {
      params: { customerId }, token,
    })
  }

  // ── Meters ────────────────────────────────────────────────────────────

  async getMeters(token?: string): Promise<CommerceMeter[]> {
    try {
      return await this.request<CommerceMeter[]>('/v1/billing/meters', { token })
    } catch { return [] }
  }

  async getMeterEventsSummary(userId: string, token?: string): Promise<CommerceMeterEventsSummary> {
    try {
      return await this.request<CommerceMeterEventsSummary>('/v1/billing/meter-events/summary', {
        params: { userId }, token,
      })
    } catch { return { userId, meters: [], period: {} } }
  }

  // ── Billing Accounts ──────────────────────────────────────────────────

  async listBillingAccounts(token?: string): Promise<CommerceBillingAccount[]> {
    try {
      return await this.request<CommerceBillingAccount[]>('/v1/billing/accounts', { token })
    } catch { return [] }
  }

  async getBillingAccount(id: string, token?: string): Promise<CommerceBillingAccount | null> {
    try {
      return await this.request<CommerceBillingAccount>(`/v1/billing/accounts/${id}`, { token })
    } catch { return null }
  }

  async createBillingAccount(data: { name: string; orgId: string }, token?: string): Promise<CommerceBillingAccount> {
    return this.request<CommerceBillingAccount>('/v1/billing/accounts', {
      method: 'POST', body: data, token,
    })
  }

  async listAccountMembers(accountId: string, token?: string): Promise<CommerceBillingAccountMember[]> {
    try {
      return await this.request<CommerceBillingAccountMember[]>(`/v1/billing/accounts/${accountId}/members`, { token })
    } catch { return [] }
  }

  async addAccountMember(accountId: string, data: { email: string; role: string }, token?: string): Promise<CommerceBillingAccountMember> {
    return this.request<CommerceBillingAccountMember>(`/v1/billing/accounts/${accountId}/members`, {
      method: 'POST', body: data, token,
    })
  }

  async updateMemberRole(accountId: string, memberId: string, role: string, token?: string): Promise<CommerceBillingAccountMember> {
    return this.request<CommerceBillingAccountMember>(`/v1/billing/accounts/${accountId}/members/${memberId}`, {
      method: 'PATCH', body: { role }, token,
    })
  }

  async removeAccountMember(accountId: string, memberId: string, token?: string): Promise<void> {
    await this.request<void>(`/v1/billing/accounts/${accountId}/members/${memberId}`, {
      method: 'DELETE', token,
    })
  }
}
