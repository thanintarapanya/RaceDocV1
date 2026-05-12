import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, ClipboardCheck, FilePlus2, Loader2, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  FilterResultSummary,
  SeriesRaceFilter,
} from '@/components/SeriesRaceFilter'
import { filterBySeriesRace, getSeriesRaceOptions } from '@/lib/series-race-filter'
import { supabase } from '@/lib/supabase'

type InspectionStatus = 'NotCreated' | 'Draft' | 'Pending' | 'Passed' | 'Hold' | 'Failed'

type InspectionEntry = {
  entry_id: string
  inspection_form_id: string | null
  template_id: string | null
  event_name: string
  season_year: number
  series_class: string
  car_number: string
  competitor_name: string
  competitor_email: string
  status: InspectionStatus
  official_bop_weight_kg: number | null
  current_version_no: number
  submitted_at: string | null
  is_eligible_to_race: boolean
  vehicle_summary: string | null
  can_create: boolean
  can_update_status: boolean
  can_offsite_inspect: boolean
}

type StatusDraft = {
  status: 'Pending' | 'Passed' | 'Hold' | 'Failed'
  issueNote: string
  baseWeight: string
  optionWeight: string
}

const statusOptions: StatusDraft['status'][] = ['Pending', 'Passed', 'Hold', 'Failed']

export function InspectionFormPage() {
  const [entries, setEntries] = useState<InspectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedSeries, setSelectedSeries] = useState('all')
  const [creatingEntryId, setCreatingEntryId] = useState<string | null>(null)
  const [updatingFormId, setUpdatingFormId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, StatusDraft>>({})

  const loadEntries = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_inspection_form_entries')

    if (!isActive()) return

    if (error) {
      setEntries([])
      setError(error.message)
    } else {
      const nextEntries = ((data ?? []) as InspectionEntry[]).map((entry) => ({
        ...entry,
        status: entry.status ?? 'NotCreated',
      }))
      setEntries(nextEntries)
      setDrafts(Object.fromEntries(nextEntries.map((entry) => [entry.entry_id, createDraft(entry)])))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    async function run() {
      await loadEntries(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadEntries])

  const totals = useMemo(() => calculateTotals(entries), [entries])
  const seriesOptions = useMemo(() => getSeriesRaceOptions(entries), [entries])
  const visibleEntries = useMemo(() => filterBySeriesRace(entries, selectedSeries), [entries, selectedSeries])

  async function createInspectionForm(entry: InspectionEntry) {
    setCreatingEntryId(entry.entry_id)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('create_inspection_form_for_entry', {
      p_entry_id: entry.entry_id,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(`Inspection Form created for car #${entry.car_number}.`)
      await loadEntries()
    }

    setCreatingEntryId(null)
  }

  async function submitStatus(entry: InspectionEntry, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!entry.inspection_form_id) return

    const draft = drafts[entry.entry_id] ?? createDraft(entry)
    setUpdatingFormId(entry.inspection_form_id)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('update_inspection_form_status', {
      p_inspection_form_id: entry.inspection_form_id,
      p_status: draft.status,
      p_issue_note: draft.issueNote.trim() || null,
      p_bop_base_weight_kg: draft.baseWeight.trim() ? Number(draft.baseWeight) : null,
      p_bop_option_weight_kg: draft.optionWeight.trim() ? Number(draft.optionWeight) : null,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(`Inspection Form updated to ${draft.status} for car #${entry.car_number}.`)
      await loadEntries()
    }

    setUpdatingFormId(null)
  }

  function updateDraft(entryId: string, changes: Partial<StatusDraft>) {
    setDrafts((current) => ({
      ...current,
      [entryId]: {
        ...(current[entryId] ?? { status: 'Pending', issueNote: '', baseWeight: '', optionWeight: '' }),
        ...changes,
      },
    }))
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Scrutineering control</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Inspection Form</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Active Entry Forms appear here for trackside inspection. Passing a form updates race eligibility from the database trigger.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadEntries()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Active Entries" value={entries.length} />
        <SummaryCard label="Pending" value={totals.pending} />
        <SummaryCard label="Passed" value={totals.passed} />
        <SummaryCard label="Eligible" value={totals.eligible} />
      </div>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}

      <div className="mt-6">
        {!loading && entries.length > 0 ? (
          <div className="mb-4 grid gap-3 border border-zinc-200 p-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end dark:border-zinc-800">
            <SeriesRaceFilter value={selectedSeries} options={seriesOptions} onChange={setSelectedSeries} />
            <FilterResultSummary
              visible={visibleEntries.length}
              total={entries.length}
              onClear={() => setSelectedSeries('all')}
            />
          </div>
        ) : null}
        {loading ? <InspectionSkeleton /> : null}
        {!loading && entries.length === 0 ? <InspectionEmpty /> : null}
        {!loading && entries.length > 0 && visibleEntries.length === 0 ? (
          <InspectionFilteredEmpty onClear={() => setSelectedSeries('all')} />
        ) : null}
        {!loading && visibleEntries.length > 0 ? (
          <InspectionList
            entries={visibleEntries}
            drafts={drafts}
            creatingEntryId={creatingEntryId}
            updatingFormId={updatingFormId}
            onCreate={createInspectionForm}
            onDraftChange={updateDraft}
            onSubmitStatus={submitStatus}
          />
        ) : null}
      </div>
    </section>
  )
}

function InspectionList({
  entries,
  drafts,
  creatingEntryId,
  updatingFormId,
  onCreate,
  onDraftChange,
  onSubmitStatus,
}: {
  entries: InspectionEntry[]
  drafts: Record<string, StatusDraft>
  creatingEntryId: string | null
  updatingFormId: string | null
  onCreate: (entry: InspectionEntry) => Promise<void>
  onDraftChange: (entryId: string, changes: Partial<StatusDraft>) => void
  onSubmitStatus: (entry: InspectionEntry, event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        const draft = drafts[entry.entry_id] ?? createDraft(entry)
        const updating = updatingFormId === entry.inspection_form_id
        return (
          <motion.article
            key={entry.entry_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, delay: index * 0.02 }}
            className={`border p-4 ${getStatusSurface(entry.status)}`}
          >
            <div className="grid gap-4 xl:grid-cols-[1fr_28rem] xl:items-start">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {entry.event_name} / {entry.season_year}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      #{entry.car_number} / {entry.competitor_name}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.series_class} / {entry.vehicle_summary ?? 'Vehicle summary unavailable'}
                    </p>
                  </div>
                  <StatusBadge status={entry.status} eligible={entry.is_eligible_to_race} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <InfoCell label="Version" value={String(entry.current_version_no)} />
                  <InfoCell label="BOP Weight" value={entry.official_bop_weight_kg ? `${entry.official_bop_weight_kg} kg` : '--'} />
                  <InfoCell label="Submitted" value={formatDateTime(entry.submitted_at)} />
                </div>

                {!entry.inspection_form_id ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => onCreate(entry)}
                    disabled={!entry.can_create || creatingEntryId === entry.entry_id}
                    className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingEntryId === entry.entry_id ? <Loader2 className="animate-spin" size={17} /> : <FilePlus2 size={17} />}
                    Create Inspection Form
                  </motion.button>
                ) : null}
              </div>

              {entry.inspection_form_id && entry.can_update_status ? (
                <form className="border border-zinc-200 p-4 dark:border-zinc-800" onSubmit={(event) => onSubmitStatus(entry, event)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium">Status</span>
                      <select
                        value={draft.status}
                        onChange={(event) => onDraftChange(entry.entry_id, { status: event.target.value as StatusDraft['status'] })}
                        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Base BOP kg</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.baseWeight}
                        onChange={(event) => onDraftChange(entry.entry_id, { baseWeight: event.target.value })}
                        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Option kg</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.optionWeight}
                        onChange={(event) => onDraftChange(entry.entry_id, { optionWeight: event.target.value })}
                        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-medium">Issue note</span>
                      <textarea
                        value={draft.issueNote}
                        onChange={(event) => onDraftChange(entry.entry_id, { issueNote: event.target.value })}
                        rows={3}
                        className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                        placeholder="Required when status is Hold or Failed"
                      />
                    </label>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={updating}
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updating ? <Loader2 className="animate-spin" size={17} /> : <ClipboardCheck size={17} />}
                    Save Status Version
                  </motion.button>
                </form>
              ) : null}
            </div>
          </motion.article>
        )
      })}
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

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-sm tabular-nums">{value}</p>
    </div>
  )
}

function StatusBadge({ status, eligible }: { status: InspectionStatus; eligible: boolean }) {
  const Icon = status === 'Passed' ? CheckCircle2 : status === 'Failed' ? XCircle : status === 'Hold' ? AlertTriangle : ShieldCheck
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${getStatusBadgeClass(status)}`}>
        <Icon size={14} />
        {status}
      </span>
      <span className={`inline-flex min-h-8 items-center rounded-md border px-3 text-xs font-semibold ${eligible ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400' : 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'}`}>
        {eligible ? 'Race eligible' : 'Not eligible'}
      </span>
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

function InspectionSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-48 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function InspectionEmpty() {
  return (
    <div className="border border-zinc-200 p-8 dark:border-zinc-800">
      <ShieldCheck className="text-zinc-500" size={24} />
      <h2 className="mt-4 text-xl font-semibold">No active entries ready for inspection.</h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Inspection Forms are created from Active Entry Forms. Approve Entry Forms first, then return here.
      </p>
    </div>
  )
}

function InspectionFilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="border border-zinc-200 p-6 dark:border-zinc-800">
      <p className="font-medium">No Inspection Forms match this Series Race filter.</p>
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

function createDraft(entry: InspectionEntry): StatusDraft {
  return {
    status: entry.status === 'NotCreated' || entry.status === 'Draft' ? 'Pending' : entry.status,
    issueNote: '',
    baseWeight: entry.official_bop_weight_kg ? String(entry.official_bop_weight_kg) : '',
    optionWeight: '',
  }
}

function calculateTotals(entries: InspectionEntry[]) {
  return {
    pending: entries.filter((entry) => entry.status === 'Pending').length,
    passed: entries.filter((entry) => entry.status === 'Passed').length,
    eligible: entries.filter((entry) => entry.is_eligible_to_race).length,
  }
}

function getStatusSurface(status: InspectionStatus) {
  if (status === 'Passed') return 'border-emerald-200 bg-emerald-500/5 dark:border-emerald-900/60'
  if (status === 'Failed') return 'border-red-200 bg-red-500/5 dark:border-red-900/60'
  if (status === 'Hold') return 'border-amber-200 bg-amber-500/5 dark:border-amber-900/60'
  return 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950'
}

function getStatusBadgeClass(status: InspectionStatus) {
  if (status === 'Passed') return 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
  if (status === 'Failed') return 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-400'
  if (status === 'Hold') return 'border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-900/60 dark:text-amber-400'
  return 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'
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
