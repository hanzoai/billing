'use client'

import * as React from 'react'

export interface OrgViewSelectorProps {
  orgs: string[]
  value: string
  onChange: (org: string) => void
}

/**
 * Global-admin billing-view selector. Renders ONLY when more than one org is
 * viewable (i.e. for global admins); a normal user has a single org and sees
 * nothing here. The chosen org drives `?org=` on the commerce billing calls,
 * which EdgeAuth honors only for verified global admins.
 */
export function OrgViewSelector({ orgs, value, onChange }: OrgViewSelectorProps) {
  if (orgs.length <= 1) return null
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
        Admin
      </span>
      <label htmlFor="org-view" className="text-[13px] text-white/50">
        Viewing billing for organization
      </label>
      <select
        id="org-view"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0d0d10] px-3 py-1.5 text-[13px] font-medium text-white outline-none transition focus:border-amber-500/40"
      >
        {orgs.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}
