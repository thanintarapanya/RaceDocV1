import { motion } from 'framer-motion'
import { CheckCircle2, FilePlus2, Loader2, Lock, RefreshCcw, Save, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RaceOption = {
  raceId: string
  raceName: string
  raceOrder: number
  eventId: string
  eventName: string
  seasonYear: number
  resultsImportUnlocked: boolean
}

type ClassOption = {
  seriesRaceId: string
  seriesName: string
  gradeId: string
  gradeName: string
  label: string
}

type RaceResultOptions = {
  canEdit: boolean
  races: RaceOption[]
  classes: ClassOption[]
}

type RaceResult = {
  race_result_id: string
  race_id: string
  race_name: string
  event_name: string
  season_year: number
  series_class: string
  status: string
  is_official: boolean
  results_import_unlocked: boolean
  entry_count: number
  signed_off_by_name: string | null
  signed_off_at: string | null
  can_edit: boolean
}

type RaceResultEntry = {
  race_result_id: string
  race_result_status: string
  is_official: boolean
  race_name: string
  event_name: string
  season_year: number
  series_class: string
  results_import_unlocked: boolean
  entry_id: string
  race_result_entry_id: string | null
  car_number: string
  competitor_name: string
  competitor_email: string
  starting_position: number | null
  finish_position: number | null
  result_code: string
  points: number
  success_ballast_delta_kg: number
  pole_position: boolean
  fastest_lap: boolean
  can_edit: boolean
}

type EntryDraft = {
  startingPosition: string
  finishPosition: string
  resultCode: string
  polePosition: boolean
  fastestLap: boolean
}

const emptyOptions: RaceResultOptions = {
  canEdit: false,
  races: [],
  classes: [],
}

const resultCodes = ['Classified', 'DNF', 'DNS', 'DQ', 'DSQ']

export function RaceResultPage() {
  const [options, setOptions] = useState<RaceResultOptions>(emptyOptions)
  const [results, setResults] = useState<RaceResult[]>([])
  const [entries, setEntries] = useState<RaceResultEntry[]>([])
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [raceId, setRaceId] = useState('')
  const [classKey, setClassKey] = useState('')
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({})
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const [optionsResult, resultsResult] = await Promise.all([
      supabase.rpc('get_race_result_options'),
      supabase.rpc('get_race_results'),
    ])

    if (!isActive()) return

    if (optionsResult.error) {
      setOptions(emptyOptions)
      setError(optionsResult.error.message)
    } else {
      const nextOptions = normalizeOptions((optionsResult.data ?? emptyOptions) as RaceResultOptions)
      setOptions(nextOptions)
      setRaceId((current) => current || nextOptions.races[0]?.raceId || '')
      setClassKey((current) => current || getClassKey(nextOptions.classes[0]))
    }

    if (resultsResult.error) {
      setResults([])
      setError(resultsResult.error.message)
    } else {
      const nextResults = (resultsResult.data ?? []) as RaceResult[]
      setResults(nextResults)
      setSelectedResultId((current) => current || nextResults[0]?.race_result_id || null)
    }

    setLoading(false)
  }, [])

  const loadEntries = useCallback(async (raceResultId: string | null, isActive: () => boolean = () => true) => {
    if (!raceResultId) {
      setEntries([])
      setDrafts({})
      return
    }

    setEntriesLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('get_race_result_entries', { p_race_result_id: raceResultId })

    if (!isActive()) return

    if (error) {
      setEntries([])
      setDrafts({})
      setError(error.message)
    } else {
      const nextEntries = (data ?? []) as RaceResultEntry[]
      setEntries(nextEntries)
      setDrafts(Object.fromEntries(nextEntries.map((entry) => [entry.entry_id, createEntryDraft(entry)])))
    }
    setEntriesLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    async function run() {
      await loadData(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadData])

  useEffect(() => {
    let active = true

    async function run() {
      await loadEntries(selectedResultId, () => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadEntries, selectedResultId])

  const selectedClass = useMemo(
    () => options.classes.find((classOption) => getClassKey(classOption) === classKey) ?? null,
    [classKey, options.classes],
  )
  const selectedRace = useMemo(
    () => options.races.find((race) => race.raceId === raceId) ?? null,
    [options.races, raceId],
  )
  const selectedResult = useMemo(
    () => results.find((result) => result.race_result_id === selectedResultId) ?? null,
    [results, selectedResultId],
  )

  async function createRaceResult() {
    if (!raceId || !selectedClass) return
    setSubmitting(true)
    setError(null)

    const { data, error } = await supabase.rpc('create_race_result', {
      p_race_id: raceId,
      p_series_race_id: selectedClass.seriesRaceId,
      p_grade_id: selectedClass.gradeId,
    })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    await loadData()
    setSelectedResultId(data as string)
    setSubmitting(false)
  }

  async function saveEntry(entry: RaceResultEntry) {
    const draft = drafts[entry.entry_id]
    if (!draft) return

    setSavingEntryId(entry.entry_id)
    setError(null)

    const { error } = await supabase.rpc('save_race_result_entry', {
      p_race_result_id: entry.race_result_id,
      p_entry_form_id: entry.entry_id,
      p_starting_position: parseNullableInteger(draft.startingPosition),
      p_position: parseNullableInteger(draft.finishPosition),
      p_result_code: draft.resultCode,
      p_pole_position: draft.polePosition,
      p_fastest_lap: draft.fastestLap,
    })

    if (error) {
      setError(error.message)
      setSavingEntryId(null)
      return
    }

    await loadData()
    await loadEntries(entry.race_result_id)
    setSavingEntryId(null)
  }

  async function publishResult() {
    if (!selectedResult) return
    const confirmed = window.confirm('Publish this Race Result as Official? It will be locked and standings will be updated.')
    if (!confirmed) return

    setSubmitting(true)
    setError(null)

    const { error } = await supabase.rpc('publish_race_result', {
      p_race_result_id: selectedResult.race_result_id,
    })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    await loadData()
    await loadEntries(selectedResult.race_result_id)
    setSubmitting(false)
  }

  function updateDraft(entryId: string, patch: Partial<EntryDraft>) {
    setDrafts((current) => ({
      ...current,
      [entryId]: {
        ...current[entryId],
        ...patch,
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Official classification</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Race Result</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Manual first-slice result entry with Scrutineer Report interlock and database-owned championship standings updates.
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

      {error ? (
        <div className="mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {options.canEdit ? (
        <section className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <FilePlus2 size={20} className="mt-1 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Create / Import Manual Result</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Race must be unlocked by an Official Scrutineer Report before result entry is allowed.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <SelectField label="Race" value={raceId} onChange={setRaceId} options={options.races.map((race) => ({ value: race.raceId, label: `${race.eventName} / ${race.raceName}${race.resultsImportUnlocked ? '' : ' (locked)'}` }))} />
            <SelectField label="Series / Class" value={classKey} onChange={setClassKey} options={options.classes.map((classOption) => ({ value: getClassKey(classOption), label: classOption.label }))} />
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={createRaceResult}
              disabled={submitting || !raceId || !classKey || !selectedRace?.resultsImportUnlocked}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <Trophy size={17} />}
              Create Result
            </motion.button>
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <ResultList loading={loading} results={results} selectedResultId={selectedResultId} onSelect={setSelectedResultId} />
        <ResultEditor
          result={selectedResult}
          entries={entries}
          drafts={drafts}
          loading={entriesLoading}
          submitting={submitting}
          savingEntryId={savingEntryId}
          onDraftChange={updateDraft}
          onSaveEntry={saveEntry}
          onPublish={publishResult}
        />
      </div>
    </section>
  )
}

function ResultList({
  loading,
  results,
  selectedResultId,
  onSelect,
}: {
  loading: boolean
  results: RaceResult[]
  selectedResultId: string | null
  onSelect: (id: string) => void
}) {
  if (loading) return <ResultSkeleton />

  if (results.length === 0) {
    return (
      <div className="border border-zinc-200 p-6 dark:border-zinc-800">
        <Trophy size={24} className="text-primary" />
        <h2 className="mt-4 text-xl font-semibold">No Race Results yet.</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Create a result after Scrutineer Report unlocks the race.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {results.map((result) => (
        <button
          key={result.race_result_id}
          type="button"
          onClick={() => onSelect(result.race_result_id)}
          className={`block w-full p-4 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${selectedResultId === result.race_result_id ? 'border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{result.event_name} / {result.race_name}</p>
              <p className="mt-1 text-sm text-zinc-500">{result.series_class}</p>
            </div>
            <StatusBadge status={result.status} official={result.is_official} />
          </div>
          <p className="mt-4 font-mono text-sm text-zinc-500 tabular-nums">{result.entry_count} result row(s)</p>
        </button>
      ))}
    </div>
  )
}

function ResultEditor({
  result,
  entries,
  drafts,
  loading,
  submitting,
  savingEntryId,
  onDraftChange,
  onSaveEntry,
  onPublish,
}: {
  result: RaceResult | null
  entries: RaceResultEntry[]
  drafts: Record<string, EntryDraft>
  loading: boolean
  submitting: boolean
  savingEntryId: string | null
  onDraftChange: (entryId: string, patch: Partial<EntryDraft>) => void
  onSaveEntry: (entry: RaceResultEntry) => Promise<void>
  onPublish: () => Promise<void>
}) {
  if (!result) {
    return (
      <div className="border border-zinc-200 p-6 dark:border-zinc-800">
        <Trophy size={24} className="text-primary" />
        <h2 className="mt-4 text-xl font-semibold">Select a result to edit or view.</h2>
      </div>
    )
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="flex flex-col gap-4 border-b border-zinc-200 p-5 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Manual result sheet</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{result.event_name} / {result.race_name}</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{result.series_class} / Season {result.season_year}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={result.status} official={result.is_official} />
          {result.is_official ? <span className="inline-flex items-center gap-1 rounded-sm bg-zinc-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"><Lock size={13} />Locked</span> : null}
        </div>
      </header>

      {loading ? <ResultSkeleton /> : null}
      {!loading && entries.length === 0 ? (
        <div className="p-5 text-zinc-600 dark:text-zinc-400">No active entries are available for this result scope.</div>
      ) : null}
      {!loading && entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] border-collapse text-left">
            <thead className="border-b border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Car</th>
                <th className="px-4 py-3 font-medium">Competitor</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Finish</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Bonus</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Next Ballast</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const draft = drafts[entry.entry_id] ?? createEntryDraft(entry)
                return (
                  <tr key={entry.entry_id} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-4 font-mono text-lg font-semibold tabular-nums">#{entry.car_number}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{entry.competitor_name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{entry.competitor_email || 'No email'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <NumberInput value={draft.startingPosition} disabled={!entry.can_edit} onChange={(value) => onDraftChange(entry.entry_id, { startingPosition: value })} />
                    </td>
                    <td className="px-4 py-4">
                      <NumberInput value={draft.finishPosition} disabled={!entry.can_edit} onChange={(value) => onDraftChange(entry.entry_id, { finishPosition: value })} />
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={draft.resultCode}
                        disabled={!entry.can_edit}
                        onChange={(event) => onDraftChange(entry.entry_id, { resultCode: event.target.value })}
                        className="min-h-10 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        {resultCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <input type="checkbox" checked={draft.polePosition} disabled={!entry.can_edit} onChange={(event) => onDraftChange(entry.entry_id, { polePosition: event.target.checked })} className="h-4 w-4 accent-primary" />
                        Pole
                      </label>
                      <label className="mt-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <input type="checkbox" checked={draft.fastestLap} disabled={!entry.can_edit} onChange={(event) => onDraftChange(entry.entry_id, { fastestLap: event.target.checked })} className="h-4 w-4 accent-primary" />
                        Fastest
                      </label>
                    </td>
                    <td className="px-4 py-4 font-mono text-lg font-semibold tabular-nums">{entry.points}</td>
                    <td className="px-4 py-4 font-mono text-lg font-semibold tabular-nums">{formatKg(entry.success_ballast_delta_kg)}</td>
                    <td className="px-4 py-4">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        disabled={!entry.can_edit || savingEntryId === entry.entry_id}
                        onClick={() => onSaveEntry(entry)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
                      >
                        {savingEntryId === entry.entry_id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save
                      </motion.button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <footer className="flex flex-col gap-3 border-t border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <p className="text-sm text-zinc-500">
          {result.is_official ? `Signed by ${result.signed_off_by_name ?? 'Official'} at ${formatDateTime(result.signed_off_at)}` : 'Draft/Provisional result. Publish to lock and update standings.'}
        </p>
        {result.can_edit && !result.is_official ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={submitting || entries.length === 0}
            onClick={onPublish}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
            Publish Official Result
          </motion.button>
        ) : null}
      </footer>
    </motion.article>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950">
        {options.length === 0 ? <option value="">No options available</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function NumberInput({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      inputMode="numeric"
      className="min-h-10 w-20 rounded-md border border-zinc-300 bg-transparent px-3 font-mono text-sm tabular-nums outline-none transition focus:border-primary disabled:opacity-60 dark:border-zinc-800"
    />
  )
}

function StatusBadge({ status, official }: { status: string; official: boolean }) {
  return (
    <span className={`inline-flex rounded-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${official ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-500'}`}>
      {status}
    </span>
  )
}

function ResultSkeleton() {
  return (
    <div className="grid gap-3 p-0">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function normalizeOptions(options: RaceResultOptions): RaceResultOptions {
  return {
    canEdit: Boolean(options.canEdit),
    races: options.races ?? [],
    classes: options.classes ?? [],
  }
}

function createEntryDraft(entry: RaceResultEntry): EntryDraft {
  return {
    startingPosition: entry.starting_position?.toString() ?? '',
    finishPosition: entry.finish_position?.toString() ?? '',
    resultCode: entry.result_code ?? 'Classified',
    polePosition: entry.pole_position,
    fastestLap: entry.fastest_lap,
  }
}

function getClassKey(classOption?: ClassOption) {
  if (!classOption) return ''
  return `${classOption.seriesRaceId}:${classOption.gradeId}`
}

function parseNullableInteger(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDateTime(value: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatKg(value: number) {
  return `${Number(value || 0).toFixed(1)} kg`
}
