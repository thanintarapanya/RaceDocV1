import { motion } from 'framer-motion'
import { Bell, CheckCircle2, FileClock, RefreshCcw, Scale, ShieldAlert, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { canSeeAdminNavigation, getPrimaryRoleLabel } from '@/navigation'
import { supabase } from '@/lib/supabase'

type DashboardMetrics = {
  pendingEntryForms: number
  activeEntryForms: number
  rejectedEntryForms: number
  pendingRequests: number
  inspectionPending: number
  inspectionFailed: number
  weightInFailed: number
}

type DashboardAlert = {
  type: string
  severity: 'info' | 'warning' | 'danger'
  title: string
  description: string
  timestamp: string | null
}

type DashboardAction = {
  label: string
  path: string
  count: number
}

type DashboardSummary = {
  scope: 'official' | 'competitor'
  metrics: DashboardMetrics
  alerts: DashboardAlert[]
  next_actions: DashboardAction[]
}

const defaultMetrics: DashboardMetrics = {
  pendingEntryForms: 0,
  activeEntryForms: 0,
  rejectedEntryForms: 0,
  pendingRequests: 0,
  inspectionPending: 0,
  inspectionFailed: 0,
  weightInFailed: 0,
}

export function DashboardPage() {
  const { profile, roles } = useAuth()
  const displayName = getDisplayName(profile)
  const elevated = canSeeAdminNavigation(roles)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_dashboard_summary')

    if (!isActive()) return

    if (error) {
      setSummary(null)
      setError(error.message)
    } else {
      setSummary(normalizeSummary(data?.[0], elevated))
    }

    setLoading(false)
  }, [elevated])

  useEffect(() => {
    let active = true

    async function run() {
      await loadSummary(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadSummary])

  const cards = useMemo(
    () => createCards(summary?.metrics ?? defaultMetrics, elevated),
    [elevated, summary?.metrics],
  )

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-zinc-800"
      >
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">
            {getPrimaryRoleLabel(roles)} dashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome, {displayName}.
          </h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Live race document status, operational alerts, and next actions for your current role.
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadSummary()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      {error ? (
        <div className="mt-6 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? <DashboardSkeleton /> : cards.map((card, index) => <MetricCard key={card.label} card={card} index={index} />)}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <ActivityPanel alerts={summary?.alerts ?? []} loading={loading} />
        <NextActionPanel actions={summary?.next_actions ?? []} loading={loading} />
      </section>
    </div>
  )
}

function MetricCard({
  card,
  index,
}: {
  card: ReturnType<typeof createCards>[number]
  index: number
}) {
  const Icon = card.icon

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, delay: index * 0.03 }}
      className="border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{card.label}</p>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">{card.value}</p>
        </div>
        <Icon className={card.emphasis ? 'text-primary' : 'text-zinc-500'} size={20} />
      </div>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">{card.note}</p>
    </motion.article>
  )
}

function DashboardSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <div key={index} className="min-h-36 animate-pulse border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-5 h-8 w-16 bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-4 w-full bg-zinc-200 dark:bg-zinc-800" />
    </div>
  ))
}

function ActivityPanel({ alerts, loading }: { alerts: DashboardAlert[]; loading: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: 0.12 }}
      className="border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-1 text-primary" size={20} />
        <div>
          <h2 className="text-xl font-semibold">Alert / Notify</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Recent Entry Form status changes and operational items visible to your role.
          </p>
        </div>
      </div>

      <div className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
        {loading ? (
          <div className="h-20 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ) : null}
        {!loading && alerts.length === 0 ? (
          <div className="py-5 text-sm text-zinc-600 dark:text-zinc-400">
            No alerts yet. Entry approvals, rejections, and operational changes will appear here.
          </div>
        ) : null}
        {!loading
          ? alerts.map((alert, index) => (
              <article key={`${alert.type}-${alert.timestamp ?? index}`} className="py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{alert.description}</p>
                  </div>
                  <span className="font-mono text-xs text-zinc-500 tabular-nums">
                    {alert.timestamp ? formatDateTime(alert.timestamp) : '--'}
                  </span>
                </div>
              </article>
            ))
          : null}
      </div>
    </motion.section>
  )
}

function NextActionPanel({ actions, loading }: { actions: DashboardAction[]; loading: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: 0.14 }}
      className="border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-1 text-primary" size={20} />
        <div>
          <h2 className="text-xl font-semibold">Next Actions</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Primary actions for the current workflow state.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? <div className="h-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" /> : null}
        {!loading
          ? actions.map((action) => (
              <Link
                key={action.label}
                to={action.path}
                className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-zinc-200 px-3 text-sm font-semibold transition hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span>{action.label}</span>
                <span className="font-mono text-xs text-zinc-500 tabular-nums">{action.count}</span>
              </Link>
            ))
          : null}
      </div>
    </motion.section>
  )
}

function createCards(metrics: DashboardMetrics, elevated: boolean) {
  if (elevated) {
    return [
      {
        label: 'Pending Entry Forms',
        value: metrics.pendingEntryForms,
        note: 'Awaiting Secretary/Admin review',
        icon: FileClock,
        emphasis: metrics.pendingEntryForms > 0,
      },
      {
        label: 'Inspection Pending',
        value: metrics.inspectionPending,
        note: 'Cars waiting for inspection result',
        icon: ShieldAlert,
        emphasis: metrics.inspectionPending > 0,
      },
      {
        label: 'Weight-In Failed',
        value: metrics.weightInFailed,
        note: 'Failed non-void weigh-in logs',
        icon: Scale,
        emphasis: metrics.weightInFailed > 0,
      },
      {
        label: 'Active Entry Forms',
        value: metrics.activeEntryForms,
        note: 'Approved and locked race entries',
        icon: Trophy,
        emphasis: false,
      },
    ]
  }

  return [
    {
      label: 'Active Entry Forms',
      value: metrics.activeEntryForms,
      note: 'Approved and locked race entries',
      icon: Trophy,
      emphasis: false,
    },
    {
      label: 'Pending Entry Forms',
      value: metrics.pendingEntryForms,
      note: 'Submitted and awaiting review',
      icon: FileClock,
      emphasis: metrics.pendingEntryForms > 0,
    },
    {
      label: 'Pending Requests',
      value: metrics.pendingRequests,
      note: 'Requests awaiting processing',
      icon: Bell,
      emphasis: metrics.pendingRequests > 0,
    },
    {
      label: 'Inspection Issues',
      value: metrics.inspectionFailed,
      note: 'Failed inspections visible to you',
      icon: ShieldAlert,
      emphasis: metrics.inspectionFailed > 0,
    },
  ]
}

function normalizeSummary(raw: unknown, elevated: boolean): DashboardSummary {
  const row = (raw ?? {}) as Partial<DashboardSummary>

  return {
    scope: row.scope ?? (elevated ? 'official' : 'competitor'),
    metrics: { ...defaultMetrics, ...(row.metrics ?? {}) },
    alerts: row.alerts ?? [],
    next_actions: row.next_actions ?? [],
  }
}

function getDisplayName(profile: ReturnType<typeof useAuth>['profile']) {
  const englishName = [profile?.first_name_en, profile?.last_name_en].filter(Boolean).join(' ')
  const thaiName = [profile?.first_name_th, profile?.last_name_th].filter(Boolean).join(' ')
  return englishName || thaiName || 'RaceDoc user'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
