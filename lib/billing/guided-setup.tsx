'use client'

export interface GuidedSetupProps {
  hasPaymentMethod: boolean
  hasSubscription: boolean
  hasSpendAlert: boolean
  hasCredits: boolean
  onAddPaymentMethod: () => void
  onPickPlan: () => void
  onSetSpendLimit: () => void
  onBuyCredits: () => void
  onDismiss: () => void
}

interface Step {
  label: string
  description: string
  done: boolean
  required: boolean
  action: () => void
  actionLabel: string
}

export function GuidedSetup(props: GuidedSetupProps) {
  const steps: Step[] = [
    {
      label: '$5 free credit ready',
      description: 'Your starter credit is active. Use it to explore all Hanzo AI services — no card needed to get started.',
      done: props.hasCredits,
      required: false,
      action: props.onBuyCredits,
      actionLabel: 'View credits',
    },
    {
      label: 'Add a payment method',
      description: 'Save a card to keep your account running when free credits are used. Verified securely via Square.',
      done: props.hasPaymentMethod,
      required: false,
      action: props.onAddPaymentMethod,
      actionLabel: 'Add card',
    },
    {
      label: 'Choose a plan',
      description: 'Unlock higher rate limits, more models, and team features with a monthly or annual plan.',
      done: props.hasSubscription,
      required: false,
      action: props.onPickPlan,
      actionLabel: 'See plans',
    },
    {
      label: 'Set a spend limit',
      description: 'Prevent surprise charges by setting a monthly budget with automatic email alerts.',
      done: props.hasSpendAlert,
      required: false,
      action: props.onSetSpendLimit,
      actionLabel: 'Set limit',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="rounded-2xl border border-border bg-bg-card p-8">
        <h2 className="text-lg font-semibold text-text mb-1">
          {allDone ? 'You\'re all set 🎉' : 'Get started with Hanzo'}
        </h2>
        <p className="text-sm text-text-muted mb-6">
          {allDone
            ? 'Your billing account is fully configured.'
            : `${completedCount} of ${steps.length} steps complete — no steps are required to use your free credits.`}
        </p>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-bg-elevated mb-8 overflow-hidden">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div
              key={step.label}
              className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                step.done
                  ? 'border-success/20 bg-success/5'
                  : 'border-border bg-bg'
              }`}
            >
              {/* Step indicator */}
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? 'bg-success text-white'
                  : 'bg-bg-elevated text-text-muted border border-border'
              }`}>
                {step.done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-sm font-medium ${step.done ? 'text-success' : 'text-text'}`}>
                    {step.label}
                  </p>
                  {!step.required && !step.done && (
                    <span className="text-[10px] uppercase tracking-wider text-text-dim">Optional</span>
                  )}
                </div>
                <p className="text-xs text-text-muted">{step.description}</p>
              </div>

              {/* Action */}
              {!step.done && (
                <button
                  type="button"
                  onClick={step.action}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text transition hover:bg-bg-elevated"
                >
                  {step.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={props.onDismiss}
            className="text-sm text-text-muted transition hover:text-text"
          >
            Skip setup
          </button>
        </div>
      </div>
    </div>
  )
}
