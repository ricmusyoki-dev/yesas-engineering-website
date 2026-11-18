import type { RevisionStatus } from './types'

const statusStyles: Record<RevisionStatus, string> = {
  draft: 'bg-amber-100 text-amber-900',
  published: 'bg-emerald-100 text-emerald-900',
  archived: 'bg-slate-100 text-slate-700',
}

export function RevisionStatusBadge({ status }: { status: RevisionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}
    >
      {status}
    </span>
  )
}
