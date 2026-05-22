import { motion } from 'framer-motion'
import { CheckCircle2, Gauge, Loader2, RefreshCcw, Scale, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FilterResultSummary,
  SeriesRaceFilter,
} from '@/components/SeriesRaceFilter'
import { filterBySeriesRace, getSeriesRaceOptions } from '@/lib/series-race-filter'
import { supabase } from '@/lib/supabase'

type WeighInSession = {
  session_id: string
  race_id: string
  event_name: string
  race_name: string
  race_order: number
  session_type: string
  status: string
  scheduled_at: string | null
  opened_at: string | null
  closed_at: string | null
}

type WeighInEntry = {
  entry_id: string
  weigh_in_session_id: string
  latest_log_id: string | null
  event_name: string
  race_name: string
  session_type: string
  season_year: number
  series_class: string
  car_number: string
  competitor_name: string
  competitor_email: string
  vehicle_summary: string | null
  inspection_status: string
  bop_base_weight_kg: number
  bop_option_weight_kg: number
  success_ballast_kg: number
  penalty_weight_kg: number
  join_weight_kg: number
  target_weight_kg: number
  actual_weight_kg: number | null
  status: 'Pending' | 'Passed' | 'Failed' | 'Void'
  missing_weight_kg: number | null
  weighed_at: string | null
  weighed_by_name: string | null
  can_edit: boolean
}

export function WeightInPage() {
  const [searchParams] = useSearchParams()
  const linkedSessionId = searchParams.get('weighInSessionId')?.trim() || null
  const [sessions, setSessions] = useState<WeighInSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [entries, setEntries] = useState<WeighInEntry[]>([])
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>({})
  const [selectedSeries, setSelectedSeries] = useState('all')
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedSession = sessions.find((session) => session.session_id === selectedSessionId) ?? null

  const loadSessions = useCallback(async (isActive: () => boolean = () => true) => {
    setLoadingSessions(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_weight_in_sessions')

    if (!isActive()) return

    if (error) {
      setSessions([])
      setError(error.message)
    } else {
      const nextSessions = (data ?? []) as WeighInSession[]
      setSessions(nextSessions)
      setSelectedSessionId((current) => {
        if (current) return current
        if (linkedSessionId && nextSessions.some((session) => session.session_id === linkedSessionId)) return linkedSessionId
        return nextSessions[0]?.session_id || ''
      })
    }

    setLoadingSessions(false)
  }, [linkedSessionId])

  const loadEntries = useCallback(async (sessionId: string, isActive: () => boolean = () => true) => {
    if (!sessionId) {
      setEntries([])
      return
    }

    setLoadingEntries(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_weight_in_entries', {
      p_session_id: sessionId,
    })

    if (!isActive()) return
    if (error) {
      setEntries([])
      setError(error.message)
    } else {
      const nextEntries = (data ?? []) as WeighInEntry[]
      setEntries(nextEntries)
      setDraftWeights(Object.fromEntries(nextEntries.map((entry) => [entry.entry_id, entry.actual_weight_kg?.toString() ?? ''])))
    }

    setLoadingEntries(false)
  }, [])

  useEffect(() => {
    let active = true

    async function run() {
      await loadSessions(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadSessions])

  useEffect(() => {
    let active = true

    async function run() {
      await loadEntries(selectedSessionId, () => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadEntries, selectedSessionId])

  const totals = useMemo(() => calculateTotals(entries), [entries])
  const seriesOptions = useMemo(() => getSeriesRaceOptions(entries), [entries])
  const visibleEntries = useMemo(() => filterBySeriesRace(entries, selectedSeries), [entries, selectedSeries])
  const linkedSessionExists = useMemo(
    () => Boolean(linkedSessionId && sessions.some((session) => session.session_id === linkedSessionId)),
    [linkedSessionId, sessions],
  )

  async function saveWeight(entry: WeighInEntry, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const actualWeight = draftWeights[entry.entry_id]?.trim()
    if (!actualWeight) {
      setError('Actual weight is required.')
      return
    }

    setSavingEntryId(entry.entry_id)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_weigh_in_log', {
      p_session_id: selectedSessionId,
      p_entry_id: entry.entry_id,
      p_actual_weight_kg: Number(actualWeight),
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(`Saved actual weight for car #${entry.car_number}.`)
      await loadEntries(selectedSessionId)
    }

    setSavingEntryId(null)
  }

  function refreshAll() {
    loadSessions()
    if (selectedSessionId) loadEntries(selectedSessionId)
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Scale station</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Weight-In</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Log actual weights against database-calculated target weights. Each save appends a new official weigh record.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={refreshAll}
          disabled={loadingSessions || loadingEntries}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Cars" value={entries.length} />
        <SummaryCard label="Passed" value={totals.passed} />
        <SummaryCard label="Failed" value={totals.failed} />
        <SummaryCard label="Pending" value={totals.pending} />
      </div>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}
      {!loadingSessions && linkedSessionId && !linkedSessionExists ? (
        <LinkedWeightNotice message="The linked Weight-In session is not visible to your account." />
      ) : null}

      <div className="mt-6 grid gap-3 border border-zinc-200 p-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,22rem)_1fr] xl:items-end dark:border-zinc-800">
        <label className="block min-w-0">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Race Session</span>
          <select
            value={selectedSessionId}
            onChange={(event) => setSelectedSessionId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
            disabled={loadingSessions}
          >
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {session.event_name} / {session.race_name} / {session.session_type}
              </option>
            ))}
          </select>
        </label>
        <SeriesRaceFilter value={selectedSeries} options={seriesOptions} onChange={setSelectedSeries} />
        <FilterResultSummary visible={visibleEntries.length} total={entries.length} onClear={() => setSelectedSeries('all')} />
      </div>

      {selectedSession ? (
        <div className="mt-4 border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Active race context</p>
          <p className="mt-2 font-semibold">{selectedSession.event_name} / {selectedSession.race_name} / {selectedSession.session_type}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Status {selectedSession.status} / scheduled {formatDateTime(selectedSession.scheduled_at)}
          </p>
          {linkedSessionId === selectedSession.session_id ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-primary">Linked notification context</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        {loadingSessions || loadingEntries ? <WeightSkeleton /> : null}
        {!loadingSessions && !loadingEntries && entries.length === 0 ? <WeightEmpty /> : null}
        {!loadingEntries && entries.length > 0 && visibleEntries.length === 0 ? (
          <WeightFilteredEmpty onClear={() => setSelectedSeries('all')} />
        ) : null}
        {!loadingEntries && visibleEntries.length > 0 ? (
          <div className="space-y-4">
            {visibleEntries.map((entry, index) => (
              <WeightRow
                key={entry.entry_id}
                entry={entry}
                index={index}
                draftWeight={draftWeights[entry.entry_id] ?? ''}
                saving={savingEntryId === entry.entry_id}
                onDraftChange={(value) => setDraftWeights((current) => ({ ...current, [entry.entry_id]: value }))}
                onSave={saveWeight}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function WeightRow({
  entry,
  index,
  draftWeight,
  saving,
  onDraftChange,
  onSave,
}: {
  entry: WeighInEntry
  index: number
  draftWeight: string
  saving: boolean
  onDraftChange: (value: string) => void
  onSave: (entry: WeighInEntry, event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, delay: index * 0.02 }}
      className={`border p-4 ${getStatusSurface(entry.status)}`}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_23rem] xl:items-start">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                {entry.event_name} / {entry.race_name} / {entry.series_class}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">#{entry.car_number} / {entry.competitor_name}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {entry.vehicle_summary ?? 'Vehicle summary unavailable'} / Inspection {entry.inspection_status}
              </p>
            </div>
            <StatusBadge entry={entry} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <WeightPart label="BOP Base" value={entry.bop_base_weight_kg} />
            <WeightPart label="Option" value={entry.bop_option_weight_kg} />
            <WeightPart label="Success" value={entry.success_ballast_kg} />
            <WeightPart label="Penalty" value={entry.penalty_weight_kg} />
            <WeightPart label="Join" value={entry.join_weight_kg} />
          </div>

          <div className="mt-5 border-l-2 border-primary pl-4">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Final Target Weight</p>
            <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">{formatKg(entry.target_weight_kg)}</p>
          </div>
        </div>

        <form className="border border-zinc-200 p-4 dark:border-zinc-800" onSubmit={(event) => onSave(entry, event)}>
          <label className="block">
            <span className="text-sm font-medium">Actual weight kg</span>
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={draftWeight}
              onChange={(event) => onDraftChange(event.target.value)}
              disabled={!entry.can_edit || saving}
              className="mt-2 min-h-14 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-2xl font-semibold tabular-nums outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </label>
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Latest: {entry.actual_weight_kg ? formatKg(entry.actual_weight_kg) : '--'} / {formatDateTime(entry.weighed_at)}
          </div>
          {entry.missing_weight_kg && entry.missing_weight_kg > 0 ? (
            <p className="mt-3 text-sm font-semibold text-red-700 dark:text-red-400">Under target by {formatKg(entry.missing_weight_kg)}</p>
          ) : null}
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={!entry.can_edit || saving}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={17} /> : <Scale size={17} />}
            Save Weight
          </motion.button>
        </form>
      </div>
    </motion.article>
  )
}

function StatusBadge({ entry }: { entry: WeighInEntry }) {
  const passed = entry.status === 'Passed'
  const failed = entry.status === 'Failed'
  return (
    <span className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${getStatusBadgeClass(entry.status)}`}>
      {passed ? <CheckCircle2 size={15} /> : failed ? <XCircle size={15} /> : <Gauge size={15} />}
      {entry.status}
    </span>
  )
}

function WeightPart({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold tabular-nums">{formatKg(value)}</p>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className =
    tone === 'success'
      ? 'mt-5 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
      : 'mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400'
  return <div className={className}>{message}</div>
}

function WeightSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-56 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function WeightEmpty() {
  return (
    <div className="border border-zinc-200 p-8 dark:border-zinc-800">
      <Scale className="text-zinc-500" size={24} />
      <h2 className="mt-4 text-xl font-semibold">No cars ready for this Weight-In session.</h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Weight-In uses Active Entry Forms for the selected race event. Approve Entry Forms first, then return here.
      </p>
    </div>
  )
}

function WeightFilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="border border-zinc-200 p-6 dark:border-zinc-800">
      <p className="font-medium">No Weight-In rows match this Series Race filter.</p>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-800"
      >
        Clear filter
      </motion.button>
    </div>
  )
}

function LinkedWeightNotice({ message }: { message: string }) {
  return (
    <div className="mt-5 border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:text-amber-400">
      {message}
    </div>
  )
}

function calculateTotals(entries: WeighInEntry[]) {
  return {
    passed: entries.filter((entry) => entry.status === 'Passed').length,
    failed: entries.filter((entry) => entry.status === 'Failed').length,
    pending: entries.filter((entry) => entry.status === 'Pending').length,
  }
}

function getStatusSurface(status: WeighInEntry['status']) {
  if (status === 'Passed') return 'border-emerald-200 bg-emerald-500/5 dark:border-emerald-900/60'
  if (status === 'Failed') return 'border-red-200 bg-red-500/5 dark:border-red-900/60'
  return 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950'
}

function getStatusBadgeClass(status: WeighInEntry['status']) {
  if (status === 'Passed') return 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
  if (status === 'Failed') return 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-400'
  return 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'
}

function formatKg(value: number) {
  return `${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })} kg`
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
