import { motion } from 'framer-motion'
import { ArchiveRestore, Clock3, FileArchive, FileText, Loader2, RefreshCcw, RotateCcw, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RecentlyDeletedEntityType = 'all' | 'entry_form' | 'competitor_request' | 'scrutineer_report' | 'file_asset'

type RecentlyDeletedItem = {
  entityType: Exclude<RecentlyDeletedEntityType, 'all'>
  entityId: string
  title: string
  subtitle: string | null
  status: string | null
  deletedAt: string
  deletedById: string | null
  deletedByName: string | null
  restoreExpiresAt: string
  isRestorable: boolean
  metadata: Record<string, unknown>
}

type RecentlyDeletedPayload = {
  canManage: boolean
  retentionDays: number
  items: RecentlyDeletedItem[]
}

const entityOptions: { value: RecentlyDeletedEntityType; label: string }[] = [
  { value: 'all', label: 'All deleted records' },
  { value: 'entry_form', label: 'Entry Forms' },
  { value: 'competitor_request', label: 'Competitor Requests' },
  { value: 'scrutineer_report', label: 'Scrutineer Reports' },
  { value: 'file_asset', label: 'File Assets' },
]

const emptyPayload: RecentlyDeletedPayload = {
  canManage: false,
  retentionDays: 30,
  items: [],
}

export function RecentlyDeletedPage() {
  const [payload, setPayload] = useState<RecentlyDeletedPayload>(emptyPayload)
  const [entityType, setEntityType] = useState<RecentlyDeletedEntityType>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_recently_deleted_items', {
      p_entity_type: entityType,
      p_search: search.trim() || null,
      p_limit: 100,
    })

    if (error) {
      setError(error.message)
      setPayload(emptyPayload)
    } else {
      setPayload(normalizePayload(data))
    }

    setLoading(false)
  }, [entityType, search])

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      const { data, error } = await supabase.rpc('get_recently_deleted_items', {
        p_entity_type: 'all',
        p_search: null,
        p_limit: 100,
      })

      if (!active) return

      if (error) {
        setError(error.message)
        setPayload(emptyPayload)
      } else {
        setPayload(normalizePayload(data))
      }

      setLoading(false)
    }

    loadInitialData()

    return () => {
      active = false
    }
  }, [])

  const totals = useMemo(() => {
    const restorable = payload.items.filter((item) => item.isRestorable).length
    const expired = payload.items.length - restorable
    return { total: payload.items.length, restorable, expired }
  }, [payload.items])

  async function restoreItem(item: RecentlyDeletedItem) {
    const confirmed = window.confirm(`Restore ${getEntityLabel(item.entityType)}: ${item.title}?`)
    if (!confirmed) return

    setRestoringId(item.entityId)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('restore_recently_deleted_item', {
      p_entity_type: item.entityType,
      p_entity_id: item.entityId,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(`${item.title} was restored and recorded in Audit Trail.`)
      await loadData()
    }

    setRestoringId(null)
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Admin recovery control</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Recently Delete</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Restore soft-deleted racing records before the 30-day recovery window closes. Permanent deletion is intentionally not available here.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadData()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Deleted" value={totals.total} icon={FileArchive} />
        <SummaryCard label="Restorable" value={totals.restorable} icon={ShieldCheck} tone="pass" />
        <SummaryCard label="Expired" value={totals.expired} icon={ShieldAlert} tone="danger" />
      </div>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}

      <section className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-sm font-medium">Record type</span>
            <select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value as RecentlyDeletedEntityType)}
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
            >
              {entityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Search deleted record</span>
            <span className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 transition focus-within:border-primary dark:border-zinc-800 dark:bg-zinc-950">
              <Search size={16} className="text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-10 w-full bg-transparent text-base outline-none"
                placeholder="Car number, queue number, event, file name"
              />
            </span>
          </label>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
            Apply Filter
          </motion.button>
        </div>
      </section>

      <section className="mt-6">
        {loading ? <DeletedSkeleton /> : null}
        {!loading && !payload.canManage ? <PermissionNotice /> : null}
        {!loading && payload.canManage && payload.items.length === 0 ? <EmptyState retentionDays={payload.retentionDays} /> : null}
        {!loading && payload.canManage && payload.items.length > 0 ? (
          <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {payload.items.map((item, index) => (
              <DeletedItemRow
                key={`${item.entityType}:${item.entityId}`}
                item={item}
                index={index}
                restoring={restoringId === item.entityId}
                onRestore={restoreItem}
              />
            ))}
          </div>
        ) : null}
      </section>
    </section>
  )
}

function DeletedItemRow({
  item,
  index,
  restoring,
  onRestore,
}: {
  item: RecentlyDeletedItem
  index: number
  restoring: boolean
  onRestore: (item: RecentlyDeletedItem) => Promise<void>
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, delay: index * 0.015 }}
      className="grid gap-4 p-4 transition hover:bg-zinc-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)_auto] lg:items-center dark:hover:bg-zinc-900"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <EntityBadge entityType={item.entityType} />
          {item.status ? <span className="rounded-sm bg-zinc-200 px-2 py-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{item.status}</span> : null}
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.title}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.subtitle || 'No context recorded'}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
          <span>Deleted by {item.deletedByName || 'Unknown user'}</span>
          <span className="font-mono tabular-nums">{formatDateTime(item.deletedAt)}</span>
        </div>
      </div>

      <div className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-800">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
          <Clock3 size={14} /> Restore window
        </p>
        <p className={`mt-2 text-sm font-semibold ${item.isRestorable ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {item.isRestorable ? `Until ${formatDateTime(item.restoreExpiresAt)}` : 'Expired'}
        </p>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => onRestore(item)}
        disabled={!item.isRestorable || restoring}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800"
      >
        {restoring ? <Loader2 size={17} className="animate-spin" /> : <RotateCcw size={17} />}
        Restore
      </motion.button>
    </motion.article>
  )
}

function EntityBadge({ entityType }: { entityType: RecentlyDeletedItem['entityType'] }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-sm bg-zinc-950 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950">
      {entityType === 'file_asset' ? <FileArchive size={13} /> : <FileText size={13} />}
      {getEntityLabel(entityType)}
    </span>
  )
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ArchiveRestore; tone?: 'pass' | 'danger' }) {
  const toneClass = tone === 'pass' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'danger' ? 'text-red-700 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-50'
  return (
    <div className="border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
        <Icon size={18} className={toneClass} />
      </div>
      <p className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className = tone === 'success'
    ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
    : 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-400'

  return <div className={`mt-5 border px-4 py-3 text-sm ${className}`}>{message}</div>
}

function PermissionNotice() {
  return (
    <div className="border border-red-200 bg-red-500/10 p-5 text-red-700 dark:border-red-900/60 dark:text-red-400">
      Admin role is required to view or restore recently deleted records.
    </div>
  )
}

function EmptyState({ retentionDays }: { retentionDays: number }) {
  return (
    <div className="border border-zinc-200 p-6 dark:border-zinc-800">
      <ArchiveRestore size={24} className="text-primary" />
      <h2 className="mt-4 text-xl font-semibold">No deleted records in this filter.</h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Soft-deleted Entry Forms, Competitor Requests, Scrutineer Reports, and File Assets will appear here for {retentionDays} days.
      </p>
    </div>
  )
}

function DeletedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function normalizePayload(data: unknown): RecentlyDeletedPayload {
  if (!data || typeof data !== 'object') return emptyPayload
  const candidate = data as Partial<RecentlyDeletedPayload>
  return {
    canManage: Boolean(candidate.canManage),
    retentionDays: typeof candidate.retentionDays === 'number' ? candidate.retentionDays : 30,
    items: Array.isArray(candidate.items) ? candidate.items as RecentlyDeletedItem[] : [],
  }
}

function getEntityLabel(entityType: RecentlyDeletedItem['entityType']) {
  if (entityType === 'entry_form') return 'Entry Form'
  if (entityType === 'competitor_request') return 'Competitor Request'
  if (entityType === 'scrutineer_report') return 'Scrutineer Report'
  return 'File Asset'
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
