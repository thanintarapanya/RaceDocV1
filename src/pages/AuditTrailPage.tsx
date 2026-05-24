import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clock3, Database, Download, FileText, History, Loader2, RefreshCcw, Search, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  emptyAuditTrailPayload,
  buildAuditTrailCsv,
  getAuditActionLabel,
  getAuditEntityLabel,
  getAuditPageRange,
  normalizeAuditTrailPayload,
  type AuditTrailItem,
  type AuditTrailPayload,
} from './auditTrailHelpers'

type AuditEntityFilter = 'all' | 'entry_form' | 'competitor_request' | 'scrutineer_report' | 'file_asset' | 'profile' | 'checklist_item' | 'inspection_form' | 'weight_in' | 'race_result'

const pageSize = 50

type AuditTrailQuery = {
  nextPage: number
  entityTypeValue: AuditEntityFilter
  actionValue: string
  searchValue: string
  isActive?: () => boolean
}

const entityOptions: { value: AuditEntityFilter; label: string }[] = [
  { value: 'all', label: 'All entities' },
  { value: 'entry_form', label: 'Entry Forms' },
  { value: 'competitor_request', label: 'Competitor Requests' },
  { value: 'scrutineer_report', label: 'Scrutineer Reports' },
  { value: 'file_asset', label: 'File Assets' },
  { value: 'profile', label: 'Profiles' },
  { value: 'checklist_item', label: 'Checklist Items' },
  { value: 'inspection_form', label: 'Inspection Forms' },
  { value: 'weight_in', label: 'Weight-In' },
  { value: 'race_result', label: 'Race Results' },
]

export function AuditTrailPage() {
  const [payload, setPayload] = useState<AuditTrailPayload>(emptyAuditTrailPayload)
  const [entityType, setEntityType] = useState<AuditEntityFilter>('all')
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchAuditTrail({
    nextPage,
    entityTypeValue,
    actionValue,
    searchValue,
    isActive = () => true,
  }: AuditTrailQuery) {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_audit_trail', {
      p_entity_type: entityTypeValue,
      p_action: actionValue.trim() || null,
      p_search: searchValue.trim() || null,
      p_limit: pageSize,
      p_offset: nextPage * pageSize,
    })

    if (!isActive()) return

    if (error) {
      setPayload(emptyAuditTrailPayload)
      setError(error.message)
    } else {
      setPayload(normalizeAuditTrailPayload(data))
    }

    setLoading(false)
  }

  async function loadAuditTrail(nextPage = page, isActive: () => boolean = () => true) {
    await fetchAuditTrail({ nextPage, entityTypeValue: entityType, actionValue: action, searchValue: search, isActive })
  }

  useEffect(() => {
    let active = true

    async function run() {
      await fetchAuditTrail({ nextPage: 0, entityTypeValue: 'all', actionValue: '', searchValue: '', isActive: () => active })
    }

    run()

    return () => {
      active = false
    }
  }, [])

  const range = useMemo(() => getAuditPageRange(payload.total, payload.limit || pageSize, payload.offset), [payload.limit, payload.offset, payload.total])
  const currentPage = Math.floor((payload.offset || 0) / (payload.limit || pageSize))
  const hasPrevious = currentPage > 0
  const hasNext = payload.offset + payload.limit < payload.total

  async function applyFilters() {
    setPage(0)
    await loadAuditTrail(0)
  }

  async function movePage(direction: 'previous' | 'next') {
    const nextPage = direction === 'previous' ? Math.max(page - 1, 0) : page + 1
    setPage(nextPage)
    await loadAuditTrail(nextPage)
  }

  function exportVisibleRows() {
    const csv = buildAuditTrailCsv(payload.items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `racedoc-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-zinc-800"
      >
        <div className="border-l-2 border-primary pl-4">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Admin audit control</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Audit Trail</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Inspect immutable RaceDoc actions across documents, roles, settings, and security events. Access is enforced by the Admin-only database RPC.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadAuditTrail()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Matched" value={payload.total} icon={History} />
        <SummaryCard label="Showing" value={payload.items.length} icon={FileText} />
        <SummaryCard label="Page Size" value={payload.limit || pageSize} icon={Database} />
      </div>

      {error ? <Alert message={error} /> : null}

      <section className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,16rem)_minmax(0,16rem)_minmax(0,1fr)_auto] xl:items-end">
          <label className="block">
            <span className="text-sm font-medium">Entity type</span>
            <select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value as AuditEntityFilter)}
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
            >
              {entityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Action contains</span>
            <input
              type="search"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="approved, updated, restored"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Search audit details</span>
            <span className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 transition focus-within:border-primary dark:border-zinc-800 dark:bg-zinc-950">
              <Search size={16} className="text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-10 w-full bg-transparent text-base outline-none"
                placeholder="Actor, entity ID, status, JSON value"
              />
            </span>
          </label>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
            Apply Filter
          </motion.button>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-3 border border-zinc-200 px-4 py-3 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:text-zinc-400">
          <span className="font-mono tabular-nums">Showing {range.from}-{range.to} of {payload.total}</span>
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={exportVisibleRows}
              disabled={loading || payload.items.length === 0}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-100"
            >
              <Download size={16} />
              Export Visible Rows
            </motion.button>
            <PageButton label="Previous" icon={ChevronLeft} disabled={loading || !hasPrevious} onClick={() => movePage('previous')} />
            <PageButton label="Next" icon={ChevronRight} disabled={loading || !hasNext} onClick={() => movePage('next')} />
          </div>
        </div>

        {loading ? <AuditSkeleton /> : null}
        {!loading && !payload.canView ? <PermissionNotice /> : null}
        {!loading && payload.canView && payload.items.length === 0 ? <EmptyState /> : null}
        {!loading && payload.canView && payload.items.length > 0 ? (
          <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {payload.items.map((item, index) => <AuditRow key={item.id} item={item} index={index} />)}
          </div>
        ) : null}
      </section>
    </section>
  )
}

function AuditRow({ item, index }: { item: AuditTrailItem; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, delay: index * 0.015 }}
      className="grid gap-4 p-4 transition hover:bg-zinc-100 xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] dark:hover:bg-zinc-900"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-sm bg-zinc-950 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950">
            <Database size={13} />
            {getAuditEntityLabel(item.entityType)}
          </span>
          <span className="rounded-sm bg-zinc-200 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {getAuditActionLabel(item.action)}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2 dark:text-zinc-400">
          <InlineMeta icon={Clock3} label="Recorded" value={formatDateTime(item.createdAt)} mono />
          <InlineMeta icon={UserRound} label="Actor" value={item.actorName || item.actionById || 'Unknown actor'} />
          <InlineMeta icon={ShieldCheck} label="Status" value={formatStatusChange(item)} />
          <InlineMeta icon={FileText} label="Entity ID" value={item.entityId} mono />
        </div>
      </div>

      <details className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-100">Change Payload</summary>
        <div className="mt-3 grid gap-3 text-xs xl:grid-cols-2">
          <JsonBlock label="Old Values" value={item.oldValues} />
          <JsonBlock label="New Values" value={item.newValues} />
        </div>
      </details>
    </motion.article>
  )
}

function InlineMeta({ icon: Icon, label, value, mono = false }: { icon: typeof Clock3; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-zinc-500" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
        <p className={`mt-1 break-words ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <p className="mb-2 font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <pre className="max-h-56 overflow-auto border border-zinc-200 bg-zinc-100 p-3 font-mono leading-5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {value ? JSON.stringify(value, null, 2) : 'None'}
      </pre>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof History }) {
  return (
    <div className="border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
        <Icon size={18} className="text-zinc-900 dark:text-zinc-50" />
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function PageButton({ label, icon: Icon, disabled, onClick }: { label: string; icon: typeof ChevronLeft; disabled: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800"
    >
      <Icon size={16} />
      {label}
    </motion.button>
  )
}

function Alert({ message }: { message: string }) {
  return <div className="mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">{message}</div>
}

function PermissionNotice() {
  return (
    <div className="border border-red-200 bg-red-500/10 p-5 text-red-700 dark:border-red-900/60 dark:text-red-400">
      Admin role is required to view Audit Trail records.
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-zinc-200 p-6 dark:border-zinc-800">
      <History size={24} className="text-primary" />
      <h2 className="mt-4 text-xl font-semibold">No audit records match this filter.</h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Try a broader entity type, action keyword, or detail search. New system actions will appear as users work through RaceDoc workflows.
      </p>
    </div>
  )
}

function AuditSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function formatStatusChange(item: AuditTrailItem) {
  if (item.previousStatus || item.newStatus) {
    return `${item.previousStatus ?? '--'} -> ${item.newStatus ?? '--'}`
  }

  return 'No status change'
}

function formatDateTime(value: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
