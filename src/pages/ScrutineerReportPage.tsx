import { motion } from 'framer-motion'
import {
  CheckCircle2,
  FilePlus2,
  Loader2,
  LockOpen,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ReportCar = {
  entryId: string
  carNumber: string | null
  competitorName: string
  competitorEmail: string
  inspectionStatus: string | null
  weighInStatus: string | null
  targetWeightKg: number | null
  actualWeightKg: number | null
  issueReason?: string | null
}

type ReportSnapshot = {
  context?: {
    raceId: string
    raceName: string
    eventName: string
    seasonYear: number
    seriesName: string
    gradeName: string
  }
  summary?: {
    totalCars: number
    passedCars: number
    failedCars: number
  }
  passedCars?: ReportCar[]
  failedCars?: ReportCar[]
  generatedAt?: string
}

type ScrutineerReport = {
  report_id: string
  race_id: string
  race_name: string
  event_name: string
  season_year: number
  series_class: string
  status: 'Draft' | 'Official' | string
  total_cars: number
  passed_cars: number
  failed_cars: number
  remarks: string | null
  signed_by_name: string | null
  signed_at: string | null
  results_import_unlocked: boolean
  report_snapshot: ReportSnapshot
  can_manage: boolean
}

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

type ReportOptions = {
  canManage: boolean
  races: RaceOption[]
  classes: ClassOption[]
}

const emptyOptions: ReportOptions = {
  canManage: false,
  races: [],
  classes: [],
}

export function ScrutineerReportPage() {
  const [reports, setReports] = useState<ScrutineerReport[]>([])
  const [options, setOptions] = useState<ReportOptions>(emptyOptions)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [raceId, setRaceId] = useState('')
  const [classKey, setClassKey] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const [optionsResult, reportsResult] = await Promise.all([
      supabase.rpc('get_scrutineer_report_options'),
      supabase.rpc('get_scrutineer_reports'),
    ])

    if (!isActive()) return

    if (optionsResult.error) {
      setError(optionsResult.error.message)
      setOptions(emptyOptions)
    } else {
      const nextOptions = normalizeOptions((optionsResult.data ?? emptyOptions) as ReportOptions)
      setOptions(nextOptions)
      setRaceId((current) => current || nextOptions.races[0]?.raceId || '')
      setClassKey((current) => current || getClassKey(nextOptions.classes[0]))
    }

    if (reportsResult.error) {
      setError(reportsResult.error.message)
      setReports([])
    } else {
      setReports((reportsResult.data ?? []) as ScrutineerReport[])
    }

    setLoading(false)
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

  const selectedClass = useMemo(
    () => options.classes.find((classOption) => getClassKey(classOption) === classKey) ?? null,
    [classKey, options.classes],
  )
  const selectedReport = useMemo(
    () => reports.find((report) => report.report_id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  )

  async function generateReport() {
    if (!raceId || !selectedClass) return
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.rpc('generate_scrutineer_report', {
      p_race_id: raceId,
      p_series_race_id: selectedClass.seriesRaceId,
      p_grade_id: selectedClass.gradeId,
      p_remarks: remarks || null,
    })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    setRemarks('')
    await loadData()
    setSubmitting(false)
  }

  async function publishReport(report: ScrutineerReport) {
    const confirmed = window.confirm('Publish this Scrutineer Report as Official and unlock Race Result import for this race?')
    if (!confirmed) return

    setSubmitting(true)
    setError(null)

    const { error } = await supabase.rpc('publish_scrutineer_report', {
      p_report_id: report.report_id,
      p_remarks: report.remarks || null,
    })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    await loadData()
    setSubmitting(false)
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Technical interlock</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Scrutineer Report</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Generate official race technical summaries from Inspection and Weight-In records before Race Result import is unlocked.
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

      {options.canManage ? (
        <section className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <FilePlus2 size={20} className="mt-1 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Generate Report</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Choose Race and Series/Class scope. Existing Draft reports for the same scope are refreshed.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SelectField label="Race" value={raceId} onChange={setRaceId} options={options.races.map((race) => ({ value: race.raceId, label: `${race.eventName} / ${race.raceName}` }))} />
            <SelectField label="Series / Class" value={classKey} onChange={setClassKey} options={options.classes.map((classOption) => ({ value: getClassKey(classOption), label: classOption.label }))} />
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Special inspection remarks</span>
            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
              placeholder="Record special checks, teardown notes, or steward/clerk instructions."
            />
          </label>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={generateReport}
            disabled={submitting || !raceId || !classKey}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <ScrollText size={17} />}
            Generate Report
          </motion.button>
        </section>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <ReportList
          loading={loading}
          reports={reports}
          selectedReportId={selectedReport?.report_id ?? null}
          onSelect={setSelectedReportId}
        />
        <ReportPreview report={selectedReport} submitting={submitting} onPublish={publishReport} />
      </div>
    </section>
  )
}

function ReportList({
  loading,
  reports,
  selectedReportId,
  onSelect,
}: {
  loading: boolean
  reports: ScrutineerReport[]
  selectedReportId: string | null
  onSelect: (reportId: string) => void
}) {
  if (loading) return <ReportSkeleton />

  if (reports.length === 0) {
    return (
      <div className="border border-zinc-200 p-6 dark:border-zinc-800">
        <ScrollText size={24} className="text-primary" />
        <h2 className="mt-4 text-xl font-semibold">No Scrutineer Reports yet.</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Generate the first report after Inspection and Weight-In data is ready.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {reports.map((report) => (
        <button
          key={report.report_id}
          type="button"
          onClick={() => onSelect(report.report_id)}
          className={`block w-full p-4 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${selectedReportId === report.report_id ? 'border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{report.event_name} / {report.race_name}</p>
              <p className="mt-1 text-sm text-zinc-500">{report.series_class}</p>
            </div>
            <StatusBadge status={report.status} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <Metric label="Cars" value={report.total_cars} />
            <Metric label="Pass" value={report.passed_cars} tone="pass" />
            <Metric label="Fail" value={report.failed_cars} tone="fail" />
          </div>
        </button>
      ))}
    </div>
  )
}

function ReportPreview({
  report,
  submitting,
  onPublish,
}: {
  report: ScrutineerReport | null
  submitting: boolean
  onPublish: (report: ScrutineerReport) => Promise<void>
}) {
  if (!report) {
    return (
      <div className="border border-zinc-200 p-6 dark:border-zinc-800">
        <ShieldCheck size={24} className="text-primary" />
        <h2 className="mt-4 text-xl font-semibold">Select a report to preview.</h2>
      </div>
    )
  }

  const snapshot = normalizeSnapshot(report.report_snapshot)

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Official technical report</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{report.event_name} / {report.race_name}</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{report.series_class} / Season {report.season_year}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={report.status} />
          {report.results_import_unlocked ? <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400"><LockOpen size={13} />Race Result Unlocked</span> : null}
        </div>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total Cars" value={snapshot.summary.totalCars} />
        <MetricCard label="Passed Cars" value={snapshot.summary.passedCars} tone="pass" />
        <MetricCard label="Failed / DQ" value={snapshot.summary.failedCars} tone="fail" />
      </div>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Passed Cars</h3>
        <CarList cars={snapshot.passedCars} empty="No fully passed cars in this report." passed />
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Failed / Disqualified Cars</h3>
        <CarList cars={snapshot.failedCars} empty="No failed cars in this report." />
      </section>

      <section className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-lg font-semibold">Special Remarks</h3>
        <p className="mt-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{report.remarks || 'No special technical remarks recorded.'}</p>
      </section>

      <footer className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div className="text-sm text-zinc-500">
          {report.status === 'Official' ? `Signed by ${report.signed_by_name ?? 'Official'} at ${formatDateTime(report.signed_at)}` : 'Draft report. Publish to unlock Race Result import.'}
        </div>
        {report.can_manage && report.status !== 'Official' ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onPublish(report)}
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
            Publish Official Report
          </motion.button>
        ) : null}
      </footer>
    </motion.article>
  )
}

function CarList({ cars, empty, passed = false }: { cars: ReportCar[]; empty: string; passed?: boolean }) {
  if (cars.length === 0) {
    return <p className="mt-3 border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">{empty}</p>
  }

  return (
    <div className="mt-3 divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {cars.map((car) => (
        <div key={car.entryId} className="grid gap-3 p-4 md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,18rem)] md:items-start">
          <p className="font-mono text-lg font-semibold tabular-nums">#{car.carNumber ?? '--'}</p>
          <div>
            <p className="font-medium">{car.competitorName}</p>
            <p className="mt-1 text-sm text-zinc-500">{car.competitorEmail || 'No email'}</p>
          </div>
          <div className="text-sm">
            <p className={passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
              {passed ? 'Inspection and weight passed' : car.issueReason || 'Technical issue recorded'}
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-500 tabular-nums">
              Target {formatKg(car.targetWeightKg)} / Actual {formatKg(car.actualWeightKg)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      >
        {options.length === 0 ? <option value="">No options available</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  const official = status === 'Official'
  return (
    <span className={`inline-flex rounded-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${official ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-500'}`}>
      {status}
    </span>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'pass' | 'fail' }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${tone === 'pass' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'fail' ? 'text-red-700 dark:text-red-400' : ''}`}>{value}</p>
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: 'pass' | 'fail' }) {
  return (
    <div className="border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${tone === 'pass' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'fail' ? 'text-red-700 dark:text-red-400' : ''}`}>{value}</p>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function normalizeOptions(options: ReportOptions): ReportOptions {
  return {
    canManage: Boolean(options.canManage),
    races: options.races ?? [],
    classes: options.classes ?? [],
  }
}

function normalizeSnapshot(snapshot: ReportSnapshot | null | undefined): Required<Pick<ReportSnapshot, 'summary' | 'passedCars' | 'failedCars'>> {
  return {
    summary: {
      totalCars: snapshot?.summary?.totalCars ?? 0,
      passedCars: snapshot?.summary?.passedCars ?? 0,
      failedCars: snapshot?.summary?.failedCars ?? 0,
    },
    passedCars: snapshot?.passedCars ?? [],
    failedCars: snapshot?.failedCars ?? [],
  }
}

function getClassKey(classOption?: ClassOption) {
  if (!classOption) return ''
  return `${classOption.seriesRaceId}:${classOption.gradeId}`
}

function formatKg(value: number | null | undefined) {
  if (value === null || value === undefined) return '-- kg'
  return `${value} kg`
}

function formatDateTime(value: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
