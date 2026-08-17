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
  tags?: string | string[]
  notes?: string
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

/**
 * Wire shape of GET /v1/billing/plans — commerce's staticPlan, projected from
 * the canonical @hanzo/plans/subscription.json catalog. Prices are CENTS.
 */
export type Plan = {
  slug?: string
  name?: string
  description?: string
  category?: string
  price?: number // monthly price in cents (0 = free)
  priceAnnual?: number // annual price in cents per month
  currency?: string
  interval?: 'monthly' | 'yearly' | string
  intervalCount?: number
  trialPeriodDays?: number
  contactSales?: boolean
  popular?: boolean
  /** The catalog bills this tier per seat — the charge multiplies by quantity. */
  perSeat?: boolean
  /**
   * Percent off the ACTIVE platform promo takes off this plan.
   *
   * It is not decoration. commerce annotates a row here only when a promo is live
   * AND covers that plan (withPromo: `Price > 0 && pr.AppliesTo(slug)`), and the
   * charge path then subtracts exactly this much through engine.DiscountCents. A
   * quote that ignores it quotes a price the card is not charged.
   */
  promoPercent?: number
  /** When the promo ends, RFC3339 — copy for the customer, never math. */
  promoUntil?: string
  features?: string[]
  bundles?: string[]
  includedIn?: string[]
  limits?: Record<string, number | null | undefined>
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

/**
 * The card a money move names: a fresh Square Web Payments nonce (sourceId,
 * single-use, vaulted server-side) OR a payment method the subject already
 * saved (paymentMethodId — its vaulted card is charged directly). Exactly one.
 */
export type CardInput = { sourceId: string } | { paymentMethodId: string }

export type CommercePaymentMethod = {
  id?: string
  userId?: string
  type?: string
  isDefault?: boolean
  /**
   * The vaulted card behind this method — what a charge actually names. Commerce
   * omits it when the method has none and refuses to charge such a method (422),
   * so a chooser that offers cards must read it: an option without a
   * providerRef is an option that cannot pay.
   */
  providerRef?: string
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

/**
 * The org's PUBLIC Square config (commerce's `payment.SquarePublicConfig`).
 * Every field is public — Square hands them to the browser — and the THREE of
 * them are one answer: `environment` picks which Square the SDK loads from, and
 * the application/location belong to that environment's account. Mixing halves
 * from two sources is what makes Square reject a nonce as cross-environment.
 */
export type PaymentConfig = {
  provider?: string
  applicationId?: string
  locationId?: string
  environment?: string // "sandbox" | "production"
  live?: boolean
}

/**
 * The assets the crypto deposit rail accepts, as commerce spells them — the set
 * something is WATCHING, so every pair it offers is one a deposit can be
 * credited from. Two lists rather than pairs, which is the endpoint's shape.
 */
export type CryptoOptions = { chains: string[]; tokens: string[] }

/** A per-payer MPC custody deposit intent (commerce mints, the chain credits). */
export type CryptoDeposit = {
  id: string
  status: string
  chain: string
  token: string
  depositAddress: string
  /**
   * The routing tag a payer MUST send WITH the payment on a chain whose address
   * is shared (XRPL's destination tag). Absent wherever the address is the whole
   * destination. Present, it is half the destination: a payment without it
   * arrives at an address commerce owns and is credited to nobody.
   */
  addressTag?: string
  expiresAt?: string
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
      headers?: Record<string, string>
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
    if (opts?.headers) Object.assign(headers, opts.headers)

    try {
      const res = await fetch(url.toString(), {
        method: opts?.method ?? 'GET',
        headers,
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        // Try to extract a human-readable message from JSON error responses
        let message = `${res.statusText}: ${text}`.trim()
        try {
          const parsed = JSON.parse(text)
          const apiMsg = parsed?.error?.message ?? parsed?.message ?? parsed?.error
          if (typeof apiMsg === 'string') message = apiMsg
        } catch {
          // Not JSON — use raw text
        }
        throw new CommerceApiError(res.status, message)
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

  // ── Settings ─────────────────────────────────────────────────────────

  /**
   * The Square application the CALLER's org tokenizes against. Commerce resolves
   * sandbox-vs-production from the org record alone (`organization.TestMode()`),
   * the same authority that picks the access token it will charge with, so the
   * browser and the charge can never end up on different Square accounts.
   */
  async getPaymentConfig(token?: string): Promise<PaymentConfig> {
    return this.request<PaymentConfig>('/v1/billing/settings', { token })
  }

  // ── Billing status ───────────────────────────────────────────────────

  async getBillingStatus(user: string, token?: string): Promise<{ hasPaymentMethod: boolean; creditBalance: number }> {
    return this.request<{ hasPaymentMethod: boolean; creditBalance: number }>(
      `/v1/billing/status?user=${encodeURIComponent(user)}`,
      { token },
    )
  }

  // ── Transactions ─────────────────────────────────────────────────────

  async getTransactions(
    user: string,
    params?: { limit?: number; offset?: number; currency?: string },
    token?: string,
  ): Promise<Transaction[]> {
    // API returns { transactions: [...], count: N, user: "..." }
    const result = await this.request<{ transactions?: Transaction[]; count?: number } | Transaction[]>('/v1/billing/transactions', {
      params: {
        user,
        ...(params?.limit ? { limit: String(params.limit) } : {}),
        ...(params?.offset ? { offset: String(params.offset) } : {}),
        ...(params?.currency ? { currency: params.currency } : {}),
      },
      token,
    })
    // Unwrap envelope if present
    if (result && !Array.isArray(result) && Array.isArray((result as Record<string, unknown>).transactions)) {
      return (result as { transactions: Transaction[] }).transactions
    }
    if (Array.isArray(result)) return result
    return []
  }

  // ── Subscriptions ────────────────────────────────────────────────────

  async subscribe(params: { planId: string; userId: string; paymentToken?: string }, token?: string): Promise<Subscription> {
    return this.request<Subscription>('/v1/billing/subscriptions', {
      method: 'POST', body: params, token,
    })
  }

  /**
   * Self-serve paid-plan checkout: charge a Square Web Payments nonce and start
   * the subscription in one call. Server-authoritative — the price is the plan's
   * price × max(1, quantity); NO client amount is sent and minSeats is enforced
   * server-side. Pass a stable `idempotencyKey` per checkout attempt so a replay
   * returns the first result (200) instead of double-charging.
   *
   * Errors surface as CommerceApiError with the HTTP status the UI branches on:
   *   400 bad args / $0 plan (use subscribe())   401 unauthenticated
   *   402 card declined                           409 checkout already in progress
   *   422 org has no payment processor            500 charged but activation failed
   */
  async subscribeWithCard(
    params: CardInput & { planId: string; userId?: string; quantity?: number; currency?: string },
    opts?: { idempotencyKey?: string; token?: string },
  ): Promise<{ subscriptionId: string; invoiceId: string; planId: string; amountCents: number; currency: string; status: string }> {
    return this.request<{ subscriptionId: string; invoiceId: string; planId: string; amountCents: number; currency: string; status: string }>(
      '/v1/billing/subscribe/card',
      {
        method: 'POST',
        body: params,
        token: opts?.token,
        headers: opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : undefined,
      },
    )
  }

  async getSubscription(subscriptionId: string, token?: string): Promise<Subscription | null> {
    return this.request<Subscription>(`/v1/billing/subscriptions/${subscriptionId}`, { token })
  }

  async getUserSubscriptions(userId: string, token?: string): Promise<Subscription[]> {
    return this.request<Subscription[]>('/v1/billing/subscriptions', {
      params: { userId }, token,
    })
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

  // ── Plans ────────────────────────────────────────────────────────────

  async getPlans(token?: string): Promise<Plan[]> {
    return this.request<Plan[]>('/v1/billing/plans', { token })
  }

  async getPlan(planId: string, token?: string): Promise<Plan | null> {
    return this.request<Plan>(`/v1/billing/plans/${planId}`, { token })
  }

  // ── Invoices ─────────────────────────────────────────────────────────

  async getInvoices(userId: string, params?: { limit?: number; offset?: number }, token?: string): Promise<CommerceInvoice[]> {
    return this.request<CommerceInvoice[]>('/v1/billing/invoices', {
      params: {
        user: userId,
        ...(params?.limit ? { limit: String(params.limit) } : {}),
        ...(params?.offset ? { offset: String(params.offset) } : {}),
      },
      token,
    })
  }

  // ── Payment Methods ──────────────────────────────────────────────────

  async getPaymentMethods(userId: string, token?: string): Promise<CommercePaymentMethod[]> {
    return this.request<CommercePaymentMethod[]>('/v1/billing/methods', {
      params: { customerId: userId }, token,
    })
  }

  async addPaymentMethod(params: CommercePaymentMethod & { customerId?: string }, token?: string): Promise<CommercePaymentMethod> {
    // Commerce API expects customerId, map userId → customerId if needed
    const body = { ...params } as Record<string, unknown>
    if (!body.customerId && params.userId) {
      body.customerId = params.userId
    }
    return this.request<CommercePaymentMethod>('/v1/billing/methods', {
      method: 'POST', body, token,
    })
  }

  async removePaymentMethod(methodId: string, token?: string): Promise<void> {
    await this.request<void>(`/v1/billing/methods/${methodId}`, {
      method: 'DELETE', token,
    })
  }

  async setDefaultPaymentMethod(methodId: string, token?: string, customerId?: string): Promise<void> {
    const custId = customerId || 'default'
    await this.request<void>(`/v1/billing/customers/${custId}/default-payment-method`, {
      method: 'POST', body: { paymentMethodId: methodId }, token,
    })
  }

  // ── Usage ────────────────────────────────────────────────────────────

  async getUsage(userId: string, token?: string): Promise<CommerceUsageSummary> {
    // Live wire shape: { user, count, usage: [{ transactionId, amount (cents),
    // currency, notes, metadata, createdAt }] } — each item an api-usage
    // withdraw transaction. Fold into the UsageSummary the panels render.
    const raw = await this.request<{
      user?: string
      count?: number
      currency?: string
      usage?: Array<{ transactionId?: string; amount?: number; currency?: string; notes?: string; createdAt?: string }>
    }>('/v1/billing/usage', {
      params: { user: userId }, token,
    })
    const items = raw.usage ?? []
    if (items.length === 0) return { totalCost: 0, currency: 'usd', period: {}, records: [] }
    const totalCents = items.reduce((sum, it) => sum + (it.amount ?? 0), 0)
    const dates = items.map((it) => it.createdAt).filter((d): d is string => !!d).sort()
    const period = { start: dates[0], end: dates[dates.length - 1] }
    return {
      totalCost: totalCents / 100,
      currency: items[0]?.currency ?? 'usd',
      period,
      records: [{
        meterId: 'api_calls',
        label: 'API usage',
        current: items.length,
        limit: null,
        unit: 'requests',
        cost: totalCents / 100,
        periodStart: period.start ?? '',
        periodEnd: period.end ?? '',
      }],
    }
  }

  // ── Spend Alerts ─────────────────────────────────────────────────────

  async getSpendAlerts(userId: string, token?: string): Promise<CommerceSpendAlert[]> {
    return this.request<CommerceSpendAlert[]>('/v1/billing/alerts', {
      params: { user: userId }, token,
    })
  }

  async createSpendAlert(params: { userId: string; title: string; threshold: number; currency?: string }, token?: string): Promise<CommerceSpendAlert> {
    return this.request<CommerceSpendAlert>('/v1/billing/alerts', {
      method: 'POST', body: params, token,
    })
  }

  async updateSpendAlert(alertId: string, params: { title?: string; threshold?: number }, token?: string): Promise<CommerceSpendAlert> {
    return this.request<CommerceSpendAlert>(`/v1/billing/alerts/${alertId}`, {
      method: 'PATCH', body: params, token,
    })
  }

  async deleteSpendAlert(alertId: string, token?: string): Promise<void> {
    await this.request<void>(`/v1/billing/alerts/${alertId}`, {
      method: 'DELETE', token,
    })
  }

  // ── Credit Grants ─────────────────────────────────────────────────────

  async getCreditGrants(userId: string, token?: string): Promise<CommerceCreditGrant[]> {
    const result = await this.request<{ grants?: CommerceCreditGrant[]; count?: number } | CommerceCreditGrant[]>('/v1/billing/credits', {
      params: { userId }, token,
    })
    // Unwrap envelope: Go API returns { grants: [...], count: N }
    if (result && !Array.isArray(result) && Array.isArray((result as Record<string, unknown>).grants)) {
      return (result as { grants: CommerceCreditGrant[] }).grants
    }
    if (Array.isArray(result)) return result
    return []
  }

  async getCreditBalance(userId: string, token?: string): Promise<CommerceCreditBalance> {
    return this.request<CommerceCreditBalance>('/v1/billing/credit-balance', {
      params: { userId }, token,
    })
  }

  // ── Crypto deposits ──────────────────────────────────────────────────
  //
  // The rail that can actually credit a coin: commerce asks its MPC custody
  // signer for an address the payer alone deposits to, and a chain watcher
  // credits the balance on confirmations. The client's whole part is to ask
  // what is on offer and to ask for the address — there is no call here that
  // can move money, which is the property that makes offering it honest.

  /** The chain/token set the deposit watcher can credit right now. */
  async getCryptoOptions(token?: string): Promise<CryptoOptions> {
    return this.request<CryptoOptions>('/v1/billing/crypto/options', { token })
  }

  /**
   * Mint (or re-read) the caller's deposit address for one asset.
   *
   * The payer is resolved server-side from the credential — no subject crosses
   * this call — and an open intent for the same asset is returned rather than a
   * second address, so asking twice strands nothing. `amountCents` is what the
   * payer intends to send; the credit is whatever the chain delivers.
   *
   * 503 is the rail saying it cannot credit that asset (nothing watching it, or
   * custody unavailable). Its message is written for the customer — show it.
   */
  async createCryptoDeposit(
    params: { chain: string; token: string; amountCents?: number },
    token?: string,
  ): Promise<CryptoDeposit> {
    return this.request<CryptoDeposit>('/v1/billing/crypto/deposit', {
      method: 'POST', body: params, token,
    })
  }

  // ── Payment Processing ──────────────────────────────────────────────
  //
  // Taking money is POST /v1/payments (cloud apps/commerce payments.go), NOT
  // /v1/billing/payment. Neither these nor the reads above swallow a failure, so
  // the retired address surfaced to the customer as a raw "Not Found" on every
  // crypto and wire top-up.

  /**
   * Record a crypto payment the client has already verified on-chain (HUSD).
   *
   * It writes a Payment row through the generic REST resource and returns it —
   * it does not credit a balance, so a caller must not read a returned row as
   * money landing. The credited rail is `createCryptoDeposit` above.
   */
  async recordCryptoPayment(
    params: { txHash: string; network: string; chainId?: number; amount: number; currency: string; userId?: string; fromAddress: string; toAddress: string },
    token?: string,
  ): Promise<Payment> {
    return this.request<Payment>('/v1/payments', {
      method: 'POST', body: { ...params, method: 'crypto' }, token,
    })
  }

  /** Save a Square-tokenized card as a payment method */
  async tokenizeAndAddCard(sourceId: string, userId: string, token?: string): Promise<CommercePaymentMethod> {
    return this.request<CommercePaymentMethod>('/v1/billing/methods', {
      method: 'POST',
      body: { providerRef: sourceId, type: 'card', providerType: 'square', customerId: userId },
      token,
    })
  }

  /** Charge a Square Web Payments SDK nonce and credit user balance (one-time top-up) */
  async topupWithSquareToken(
    params: { sourceId: string; amountCents: number; userId?: string; currency?: string },
    token?: string,
  ): Promise<{ transactionId: string; balanceCents: number; status: string }> {
    return this.request<{ transactionId: string; balanceCents: number; status: string }>(
      '/v1/billing/topup/token',
      { method: 'POST', body: params, token },
    )
  }

  /**
   * Charge a card the subject already saved (card-on-file) and credit balance.
   *
   * The card is named by its commerce payment-method id, NOT by the vaulted
   * card id: the server reads the method's providerRef and its Square customer
   * from the method row, and refuses a method that is not the paying subject's
   * own. Nothing about the card crosses this call.
   *
   * Pass a stable `idempotencyKey` per attempt. Without one the server falls
   * back to a 15-minute window over (card, amount, currency), which replays the
   * first receipt for a deliberate second top-up of the same amount.
   *
   * Errors surface as CommerceApiError with the status the UI branches on:
   *   400 amount out of bounds   401 unauthenticated       402 declined
   *   404 no such card for you   409 top-up in progress    422 not chargeable
   *   500 charged but not credited                         503 guard unavailable
   */
  async topupWithMethod(
    params: { paymentMethodId: string; amountCents: number; userId?: string; currency?: string },
    opts?: { idempotencyKey?: string; token?: string },
  ): Promise<{ transactionId: string; balanceCents: number; status: string }> {
    return this.request<{ transactionId: string; balanceCents: number; status: string }>(
      '/v1/billing/topup',
      {
        method: 'POST',
        body: params,
        token: opts?.token,
        headers: opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : undefined,
      },
    )
  }

  /** Record a wire transfer (manual, pending verification) */
  async recordWirePayment(
    params: { userId?: string; amount: number; currency?: string; reference?: string },
    token?: string,
  ): Promise<Payment> {
    return this.request<Payment>('/v1/payments', {
      method: 'POST', body: { ...params, method: 'wire' }, token,
    })
  }

  // ── Portal ────────────────────────────────────────────────────────────



  // ── Billing Accounts ──────────────────────────────────────────────────

  async listBillingAccounts(token?: string): Promise<CommerceBillingAccount[]> {
    return this.request<CommerceBillingAccount[]>('/v1/billing/accounts', { token })
  }

  async getBillingAccount(id: string, token?: string): Promise<CommerceBillingAccount | null> {
    return this.request<CommerceBillingAccount>(`/v1/billing/accounts/${id}`, { token })
  }

  async createBillingAccount(data: { name: string; orgId: string }, token?: string): Promise<CommerceBillingAccount> {
    return this.request<CommerceBillingAccount>('/v1/billing/accounts', {
      method: 'POST', body: data, token,
    })
  }

  async listAccountMembers(accountId: string, token?: string): Promise<CommerceBillingAccountMember[]> {
    return this.request<CommerceBillingAccountMember[]>(`/v1/billing/accounts/${accountId}/members`, { token })
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
