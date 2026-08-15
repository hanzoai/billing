'use client'

export interface GuidedSetupProps {
  hasPaymentMethod: boolean
  hasSubscription: boolean
  hasSpendAlert: boolean
  onAddPaymentMethod: () => void
  onPickPlan: () => void
  onSetSpendLimit: () => void
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
      label: 'Add a payment method',
      description: 'Usage is billed to this card. Entered in Square’s own fields — the number never reaches us.',
      done: props.hasPaymentMethod,
      required: true,
      action: props.onAddPaymentMethod,
      actionLabel: 'Add card',
    },
    {
      label: 'Choose a plan',
      description: 'Your plan sets your rate limits, model access and team features.',
      done: props.hasSubscription,
      required: true,
      action: props.onPickPlan,
      actionLabel: 'See plans',
    },
    {
      label: 'Set a spend limit',
      description: 'Cap your monthly spend and get an email before you reach it.',
      done: props.hasSpendAlert,
      required: false,
      action: props.onSetSpendLimit,
      actionLabel: 'Set limit',
    },
  ]

  const required = steps.filter(s => s.required)
  const requiredDone = required.filter(s => s.done).length
  const ready = requiredDone === required.length

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="rounded-2xl border border-border bg-bg-card p-8">
        <h2 className="text-lg font-semibold text-text mb-1">
          {ready ? 'You’re all set' : 'Get started with Hanzo'}
        </h2>
        <p className="text-sm text-text-muted mb-6">
          {ready
            ? 'Your billing account is ready.'
            : `${requiredDone} of ${required.length} required steps complete.`}
        </p>

        {/* Progress bar — required steps only */}
        <div className="h-1.5 rounded-full bg-bg-elevated mb-8 overflow-hidden">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${(requiredDone / required.length) * 100}%` }}
          />
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div
              key={step.label}
              className={`flex flex-wrap items-start gap-4 rounded-xl border p-4 transition ${
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

              {/* Content. The min width is what makes the action wrap below on a
                  narrow screen instead of squeezing the label to a word a line. */}
              <div className="min-w-[160px] flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-sm font-medium ${step.done ? 'text-success' : 'text-text'}`}>
                    {step.label}
                  </p>
                  {/* Required is the default; only the exception is labelled. */}
                  {!step.required && !step.done && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-dim">Optional</span>
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
      </div>
    </div>
  )
}
