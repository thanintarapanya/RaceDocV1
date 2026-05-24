import { motion } from 'framer-motion'
import { Bell, CheckCircle2, RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { getPrimaryRoleLabel } from '@/navigation'
import { supabase } from '@/lib/supabase'
import {
  createDashboardCards,
  defaultMetrics,
  getFallbackScope,
  getScopeDescription,
  getScopeLabel,
  normalizeDashboardSummary,
  type DashboardAction,
  type DashboardAlert,
  type DashboardCard,
  type DashboardSummary,
} from './dashboardHelpers'

export function DashboardPage() {
  const { profile, roles } = useAuth()
  const displayName = getDisplayName(profile)
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
      setSummary(normalizeDashboardSummary(data?.[0], roles))
    }

    setLoading(false)
  }, [roles])

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
    () => createDashboardCards(summary?.metrics ?? defaultMetrics, summary?.scope ?? getFallbackScope(roles)),
    [roles, summary?.metrics, summary?.scope],
  )
  const scopeLabel = getScopeLabel(summary?.scope ?? getFallbackScope(roles))

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
            {getScopeDescription(summary?.scope ?? getFallbackScope(roles))}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <span className="inline-flex rounded-sm border border-zinc-300 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {scopeLabel}
          </span>

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
        </div>
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
  card: DashboardCard
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
        {!loading && actions.length === 0 ? (
          <div className="border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            No immediate actions. Refresh after new Entry Forms, technical checks, or requests are submitted.
          </div>
        ) : null}
      </div>
    </motion.section>
  )
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
