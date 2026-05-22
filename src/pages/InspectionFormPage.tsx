import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FilePlus2, Loader2, RefreshCcw, ShieldCheck, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import {
  FilterResultSummary,
  SeriesRaceFilter,
} from '@/components/SeriesRaceFilter'
import { filterBySeriesRace, getSeriesRaceOptions } from '@/lib/series-race-filter'
import { supabase } from '@/lib/supabase'
import {
  calculateBopWeight,
  calculateSectionProgress,
  createInspectionVersionDiff,
  createDefaultReviews,
  deriveInspectionStatus,
  formatInspectionValue,
  getItemLabel,
  getMissingRequiredItems,
  isAnswerFilled,
  type InspectionAnswers,
  type InspectionItemResultStatus,
  type InspectionItemReview,
  type InspectionTemplateItem,
  type InspectionTemplateSection,
  type InspectionVersionHistoryItem,
  type InspectionVersionSnapshot,
} from './inspectionFormHelpers'

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
  suggested_bop_base_weight_kg: number | null
  suggested_bop_option_weight_kg: number | null
  suggested_bop_total_weight_kg: number | null
  suggested_weight_rule_name: string | null
  engine_size_cc: number | null
  current_version_no: number
  submitted_at: string | null
  is_eligible_to_race: boolean
  vehicle_summary: string | null
  can_create: boolean
  can_update_status: boolean
  can_offsite_inspect: boolean
}

type InspectionDetail = {
  permissions: {
    canEditDraft: boolean
    canSubmitDraft: boolean
    canOfficialReview: boolean
    canOffsiteInspect: boolean
  }
  context: {
    inspectionFormId: string
    entryId: string
    templateId: string
    templateName: string
    templateVersion: number
    status: InspectionStatus
    officialBopWeightKg: number | null
    currentVersionNo: number
    submittedAt: string | null
    eventName: string
    seasonYear: number
    seriesClass: string
    carNumber: string
    competitorName: string
    competitorEmail: string
    isEligibleToRace: boolean
    vehicleSnapshot: Record<string, unknown>
    teamSnapshot: Record<string, unknown>
  }
  template: {
    sections: InspectionTemplateSection[]
  }
  answers: InspectionAnswers
  itemResults: InspectionItemReview[]
}

type InspectionFileAnswer = {
  fileAssetId: string
  path: string
  filename: string
  mimeType: string
  sizeBytes: number
}

type InspectionVersionHistory = {
  context: {
    inspectionFormId: string
    currentVersionNo: number
    carNumber: string
    eventName: string
    seriesClass: string
    competitorName: string
  }
  itemCatalog: InspectionVersionHistoryItem[]
  versions: InspectionVersionSnapshot[]
}

const reviewStatuses: InspectionItemResultStatus[] = ['Unchecked', 'Passed', 'Failed', 'Hold', 'NotApplicable']

export function InspectionFormPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [entries, setEntries] = useState<InspectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedSeries, setSelectedSeries] = useState('all')
  const [creatingEntryId, setCreatingEntryId] = useState<string | null>(null)
  const [entriesLoadKey, setEntriesLoadKey] = useState(0)
  const linkedInspectionFormId = searchParams.get('inspectionFormId')

  const loadEntries = useCallback(async (isActive: () => boolean = () => true) => {
    const { data, error } = await supabase.rpc('get_inspection_form_entries')

    if (!isActive()) return

    if (error) {
      setEntries([])
      setError(error.message)
    } else {
      setEntries(((data ?? []) as InspectionEntry[]).map((entry) => ({ ...entry, status: entry.status ?? 'NotCreated' })))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    const timeoutId = window.setTimeout(() => {
      void loadEntries(() => active)
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [entriesLoadKey, loadEntries])

  function refreshEntries() {
    setLoading(true)
    setError(null)
    setEntriesLoadKey((current) => current + 1)
  }

  function openInspectionForm(formId: string) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('inspectionFormId', formId)
    setSearchParams(nextParams, { replace: true })
  }

  function closeInspectionForm() {
    if (!searchParams.has('inspectionFormId')) return

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('inspectionFormId')
    setSearchParams(nextParams, { replace: true })
  }

  const totals = useMemo(() => calculateTotals(entries), [entries])
  const seriesOptions = useMemo(() => getSeriesRaceOptions(entries), [entries])
  const visibleEntries = useMemo(() => filterBySeriesRace(entries, selectedSeries), [entries, selectedSeries])

  async function createInspectionForm(entry: InspectionEntry) {
    setCreatingEntryId(entry.entry_id)
    setError(null)
    setNotice(null)

    const { data, error } = await supabase.rpc('create_inspection_form_for_entry', {
      p_entry_id: entry.entry_id,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(`Draft Inspection Form created for car #${entry.car_number}.`)
      openInspectionForm(data as string)
      refreshEntries()
    }

    setCreatingEntryId(null)
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
            Competitors prepare a dynamic draft from the active Entry Form. Scrutineers then inspect each configured item and submit the official BOP result.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={refreshEntries}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <SummaryCard label="Active Entries" value={entries.length} />
        <SummaryCard label="Draft" value={totals.draft} />
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
            <FilterResultSummary visible={visibleEntries.length} total={entries.length} onClear={() => setSelectedSeries('all')} />
          </div>
        ) : null}
        {loading ? <InspectionSkeleton /> : null}
        {!loading && entries.length === 0 ? <InspectionEmpty /> : null}
        {!loading && entries.length > 0 && visibleEntries.length === 0 ? <InspectionFilteredEmpty onClear={() => setSelectedSeries('all')} /> : null}
        {!loading && visibleEntries.length > 0 ? (
          <InspectionList
            entries={visibleEntries}
            creatingEntryId={creatingEntryId}
            onCreate={createInspectionForm}
            onOpen={openInspectionForm}
          />
        ) : null}
      </div>

      <AnimatePresence>
        {linkedInspectionFormId ? (
          <InspectionFormDialog
            formId={linkedInspectionFormId}
            onClose={closeInspectionForm}
            onSaved={async (message) => {
              setNotice(message)
              refreshEntries()
            }}
          />
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function InspectionList({
  entries,
  creatingEntryId,
  onCreate,
  onOpen,
}: {
  entries: InspectionEntry[]
  creatingEntryId: string | null
  onCreate: (entry: InspectionEntry) => Promise<void>
  onOpen: (formId: string) => void
}) {
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <motion.article
          key={entry.entry_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.14, delay: index * 0.02 }}
          className={`border p-4 ${getStatusSurface(entry.status)}`}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{entry.event_name} / {entry.season_year}</p>
              <h2 className="mt-2 text-xl font-semibold">#{entry.car_number} / {entry.competitor_name}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{entry.series_class} / {entry.vehicle_summary ?? 'Vehicle summary unavailable'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <InfoCell label="Version" value={String(entry.current_version_no)} />
                <InfoCell label="BOP Weight" value={formatKg(entry.official_bop_weight_kg)} />
                <InfoCell label="Engine CC" value={formatPlainNumber(entry.engine_size_cc)} />
                <InfoCell label="Submitted" value={formatDateTime(entry.submitted_at)} />
              </div>
            </div>
            <div className="flex flex-col gap-3 xl:items-end">
              <StatusBadge status={entry.status} eligible={entry.is_eligible_to_race} />
              {!entry.inspection_form_id ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => onCreate(entry)}
                  disabled={!entry.can_create || creatingEntryId === entry.entry_id}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingEntryId === entry.entry_id ? <Loader2 className="animate-spin" size={17} /> : <FilePlus2 size={17} />}
                  Create Inspection Form
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => onOpen(entry.inspection_form_id!)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-800"
                >
                  <ClipboardCheck size={17} />
                  {entry.can_update_status ? 'Inspect / Review' : entry.status === 'Draft' ? 'Continue Draft' : 'View Form'}
                </motion.button>
              )}
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  )
}

function InspectionFormDialog({
  formId,
  onClose,
  onSaved,
}: {
  formId: string
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const { user } = useAuth()
  const [detail, setDetail] = useState<InspectionDetail | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [answers, setAnswers] = useState<InspectionAnswers>({})
  const [reviews, setReviews] = useState<Record<string, InspectionItemReview>>({})
  const [issueNote, setIssueNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [detailLoadKey, setDetailLoadKey] = useState(0)
  const [history, setHistory] = useState<InspectionVersionHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [compareBeforeVersionNo, setCompareBeforeVersionNo] = useState<number | null>(null)
  const [compareAfterVersionNo, setCompareAfterVersionNo] = useState<number | null>(null)

  const loadDetail = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_inspection_form_detail', {
      p_inspection_form_id: formId,
    })

    if (error) {
      setLocalError(error.message)
      setDetail(null)
    } else {
      const nextDetail = data as InspectionDetail
      const sections = nextDetail.template.sections ?? []
      const nextAnswers = prefillInspectionAnswers(sections, nextDetail.answers ?? {}, nextDetail)
      setDetail(nextDetail)
      setAnswers(nextAnswers)
      setReviews(createDefaultReviews(sections, nextDetail.itemResults ?? []))
      setIssueNote(String((nextDetail as { answersSnapshot?: Record<string, unknown> }).answersSnapshot?.issueNote ?? ''))
    }

    setLoading(false)
  }, [formId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDetail()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [detailLoadKey, loadDetail])

  function refreshDetail() {
    setLoading(true)
    setLocalError(null)
    setDetailLoadKey((current) => current + 1)
  }

  const sections = useMemo(() => detail?.template.sections ?? [], [detail])
  const currentSection = sections[activeStep]
  const canEditAnswers = Boolean(detail?.permissions.canEditDraft || detail?.permissions.canOfficialReview)
  const canOfficialReview = Boolean(detail?.permissions.canOfficialReview)
  const canSubmitDraft = Boolean(detail?.permissions.canSubmitDraft)
  const missingRequired = useMemo(() => getMissingRequiredItems(sections, answers), [answers, sections])
  const derivedStatus = useMemo(() => deriveInspectionStatus(sections, reviews), [reviews, sections])
  const calculatedBop = useMemo(() => calculateBopWeight(sections, answers), [answers, sections])
  const beforeVersion = useMemo(() => history?.versions.find((version) => version.versionNo === compareBeforeVersionNo) ?? null, [compareBeforeVersionNo, history])
  const afterVersion = useMemo(() => history?.versions.find((version) => version.versionNo === compareAfterVersionNo) ?? null, [compareAfterVersionNo, history])
  const versionDiff = useMemo(() => createInspectionVersionDiff(history?.itemCatalog ?? [], beforeVersion, afterVersion), [afterVersion, beforeVersion, history])

  async function loadVersionHistory() {
    setHistoryLoading(true)
    setLocalError(null)

    const { data, error } = await supabase.rpc('get_inspection_form_version_history', {
      p_inspection_form_id: formId,
    })

    if (error) {
      setLocalError(error.message)
    } else {
      const nextHistory = data as InspectionVersionHistory
      setHistory(nextHistory)
      const newest = nextHistory.versions[0]?.versionNo ?? null
      const previous = nextHistory.versions[1]?.versionNo ?? newest
      setCompareAfterVersionNo(newest)
      setCompareBeforeVersionNo(previous)
      setShowHistory(true)
    }

    setHistoryLoading(false)
  }

  function updateAnswer(itemId: string, value: unknown) {
    setAnswers((current) => ({ ...current, [itemId]: value }))
    setReviews((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { itemId, resultStatus: 'Unchecked' as InspectionItemResultStatus }),
        answerValue: value,
      },
    }))
  }

  function updateReview(itemId: string, changes: Partial<InspectionItemReview>) {
    setReviews((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { itemId, resultStatus: 'Unchecked' as InspectionItemResultStatus }),
        ...changes,
      },
    }))
  }

  async function uploadInspectionFile(itemId: string, file: File) {
    if (!user?.id) {
      setLocalError('Authentication required before uploading files.')
      return
    }

    setUploadingItemId(itemId)
    setLocalError(null)

    try {
      const path = createInspectionFilePath(user.id, formId, file.name)
      const { error: uploadError } = await supabase.storage
        .from('competitor_assets')
        .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' })

      if (uploadError) throw uploadError

      const { data, error: assetError } = await supabase.rpc('create_file_asset', {
        p_path: path,
        p_filename: file.name,
        p_mime_type: file.type || 'application/octet-stream',
        p_size_bytes: file.size,
      })

      if (assetError) throw assetError

      updateAnswer(itemId, {
        fileAssetId: data as string,
        path,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      } satisfies InspectionFileAnswer)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Inspection file upload failed.')
    } finally {
      setUploadingItemId(null)
    }
  }

  async function saveDraft() {
    if (!detail) return
    setSaving(true)
    setLocalError(null)

    const { error } = await supabase.rpc('save_inspection_form_draft', {
      p_entry_id: detail.context.entryId,
      p_answers: answers,
    })

    if (error) {
      setLocalError(error.message)
    } else {
      await onSaved(`Inspection draft saved for car #${detail.context.carNumber}.`)
      refreshDetail()
    }

    setSaving(false)
  }

  async function submitDraft() {
    if (!detail) return
    if (missingRequired.length > 0) {
      setLocalError('Required inspection fields must be completed before submitting for inspection.')
      return
    }

    const confirmed = window.confirm('Submit for inspection? Competitor/team manager editing will be locked after this step.')
    if (!confirmed) return

    await saveDraft()
    setSaving(true)
    setLocalError(null)

    const { error } = await supabase.rpc('submit_inspection_form_for_inspection', {
      p_inspection_form_id: detail.context.inspectionFormId,
    })

    if (error) {
      setLocalError(error.message)
    } else {
      await onSaved(`Inspection Form submitted for car #${detail.context.carNumber}.`)
      refreshDetail()
    }

    setSaving(false)
  }

  async function submitOfficialReview() {
    if (!detail) return
    const needsIssue = derivedStatus === 'Failed' || derivedStatus === 'Hold'
    const hasItemComment = Object.values(reviews).some((review) => review.comment?.trim())
    if (needsIssue && !issueNote.trim() && !hasItemComment) {
      setLocalError('Issue note or item comment is required for Failed/Hold inspection.')
      return
    }

    setSaving(true)
    setLocalError(null)

    const itemResults = sections.flatMap((section) => section.items).map((item) => ({
      itemId: item.itemId,
      resultStatus: reviews[item.itemId]?.resultStatus ?? 'Unchecked',
      answerValue: answers[item.itemId] ?? null,
      comment: reviews[item.itemId]?.comment?.trim() || null,
    }))

    const { error } = await supabase.rpc('save_inspection_official_review', {
      p_inspection_form_id: detail.context.inspectionFormId,
      p_answers: answers,
      p_item_results: itemResults,
      p_issue_note: issueNote.trim() || null,
    })

    if (error) {
      setLocalError(error.message)
    } else {
      await onSaved(`Official inspection review saved as ${derivedStatus} for car #${detail.context.carNumber}.`)
      refreshDetail()
    }

    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="fixed inset-0 z-50 bg-zinc-950/45 px-3 py-4 sm:px-5"
      onClick={onClose}
    >
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 14 }}
        transition={{ duration: 0.16 }}
        className="mx-auto flex max-h-[calc(100svh-2rem)] max-w-6xl flex-col overflow-hidden border border-zinc-200 bg-zinc-50 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspection-form-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:p-5 dark:border-zinc-800">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Dynamic progressive form</p>
            <h2 id="inspection-form-title" className="mt-2 text-2xl font-semibold tracking-tight">Inspection Form</h2>
          </div>
          <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800" aria-label="Close inspection form">
            <X size={20} />
          </motion.button>
        </header>

        {loading ? (
          <div className="p-5"><InspectionSkeleton /></div>
        ) : detail && currentSection ? (
          <>
            <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">#{detail.context.carNumber} / {detail.context.eventName} / {detail.context.seasonYear}</p>
                  <h3 className="mt-1 text-xl font-semibold">{detail.context.competitorName}</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{detail.context.seriesClass} / {formatVehicle(detail.context.vehicleSnapshot)} / {formatTeam(detail.context.teamSnapshot)}</p>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => showHistory ? setShowHistory(false) : (history ? setShowHistory(true) : loadVersionHistory())}
                    disabled={historyLoading}
                    className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
                  >
                    {historyLoading ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
                    {showHistory ? 'Hide History' : 'History / Compare'}
                  </motion.button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[30rem]">
                  <MiniMetric label="Status" value={detail.context.status} />
                  <MiniMetric label="Version" value={String(detail.context.currentVersionNo)} />
                  <MiniMetric label="Calc BOP" value={formatKg(calculatedBop)} />
                  <MiniMetric label="Official BOP" value={formatKg(detail.context.officialBopWeightKg)} />
                </div>
              </div>
              {localError ? <Alert tone="danger" message={localError} /> : null}
              {showHistory && history ? (
                <VersionHistoryPanel
                  history={history}
                  beforeVersionNo={compareBeforeVersionNo}
                  afterVersionNo={compareAfterVersionNo}
                  diff={versionDiff}
                  onBeforeChange={setCompareBeforeVersionNo}
                  onAfterChange={setCompareAfterVersionNo}
                />
              ) : null}
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_1fr]">
              <aside className="border-b border-zinc-200 p-4 lg:border-r lg:border-b-0 dark:border-zinc-800">
                <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {sections.map((section, index) => {
                    const progress = calculateSectionProgress(section, answers, reviews)
                    return (
                      <li key={section.sectionId}>
                        <button
                          type="button"
                          onClick={() => setActiveStep(index)}
                          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm font-medium ${activeStep === index ? 'border-primary text-zinc-950 dark:text-zinc-50' : 'border-zinc-200 text-zinc-500 dark:border-zinc-800'}`}
                        >
                          <span><span className="font-mono text-xs tabular-nums">{String(index + 1).padStart(2, '0')}</span> {section.title}</span>
                          <span className="font-mono text-xs tabular-nums">{canOfficialReview ? `${progress.reviewed}/${progress.total}` : `${progress.answered}/${progress.total}`}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </aside>

              <main className="min-h-0 overflow-y-auto p-4 sm:p-5">
                <div className="mb-5 flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Section {activeStep + 1} of {sections.length}</p>
                  <h3 className="text-2xl font-semibold tracking-tight">{currentSection.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Fill the configured inputs, then officials check every item during inspection.</p>
                </div>

                <div className="space-y-4">
                  {currentSection.items.map((item) => (
                    <InspectionItemCard
                      key={item.itemId}
                      item={item}
                      answer={answers[item.itemId]}
                      review={reviews[item.itemId]}
                      canEditAnswer={canEditAnswers}
                      canOfficialReview={canOfficialReview}
                      canOffsiteInspect={detail.permissions.canOffsiteInspect}
                      uploading={uploadingItemId === item.itemId}
                      onAnswerChange={(value) => updateAnswer(item.itemId, value)}
                      onFileUpload={(file) => uploadInspectionFile(item.itemId, file)}
                      onReviewChange={(changes) => updateReview(item.itemId, changes)}
                    />
                  ))}
                </div>

                {activeStep === sections.length - 1 ? (
                  <section className="mt-5 border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Review</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <MiniMetric label="Missing Required" value={String(missingRequired.length)} />
                      <MiniMetric label="Official Status" value={derivedStatus} />
                      <MiniMetric label="BOP Total" value={formatKg(calculatedBop)} />
                    </div>
                    {canOfficialReview ? (
                      <label className="mt-4 block">
                        <span className="text-sm font-medium">Issue note</span>
                        <textarea value={issueNote} onChange={(event) => setIssueNote(event.target.value)} rows={3} className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950" placeholder="Required when any item is Failed or Hold unless item comments explain the issue." />
                      </label>
                    ) : null}
                  </section>
                ) : null}
              </main>
            </div>

            <footer className="flex flex-col gap-3 border-t border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <p className="text-sm text-zinc-500">{canOfficialReview ? 'Official review mode' : canSubmitDraft ? 'Competitor/team draft mode' : 'Read-only mode'}</p>
              <div className="flex flex-wrap gap-2">
                <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={() => setActiveStep((current) => Math.max(0, current - 1))} disabled={activeStep === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-800"><ChevronLeft size={17} />Back</motion.button>
                <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={() => setActiveStep((current) => Math.min(sections.length - 1, current + 1))} disabled={activeStep === sections.length - 1} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-800">Next<ChevronRight size={17} /></motion.button>
                {detail.permissions.canEditDraft ? <ActionButton label="Save Draft" loading={saving} onClick={saveDraft} /> : null}
                {canSubmitDraft ? <ActionButton label="Submit For Inspection" loading={saving} onClick={submitDraft} primary /> : null}
                {canOfficialReview ? <ActionButton label="Submit Official Review" loading={saving} onClick={submitOfficialReview} primary /> : null}
              </div>
            </footer>
          </>
        ) : (
          <div className="p-5"><Alert tone="danger" message={localError ?? 'Inspection Form could not be loaded.'} /></div>
        )}
      </motion.section>
    </motion.div>
  )
}

function InspectionItemCard({
  item,
  answer,
  review,
  canEditAnswer,
  canOfficialReview,
  canOffsiteInspect,
  uploading,
  onAnswerChange,
  onFileUpload,
  onReviewChange,
}: {
  item: InspectionTemplateItem
  answer: unknown
  review: InspectionItemReview | undefined
  canEditAnswer: boolean
  canOfficialReview: boolean
  canOffsiteInspect: boolean
  uploading: boolean
  onAnswerChange: (value: unknown) => void
  onFileUpload: (file: File) => void
  onReviewChange: (changes: Partial<InspectionItemReview>) => void
}) {
  const isOffsiteItem = /off[- ]?site/i.test(`${item.labelEn ?? ''} ${item.labelTh}`)
  const answerDisabled = !canEditAnswer || (isOffsiteItem && !canOffsiteInspect && canOfficialReview)
  const status = review?.resultStatus ?? 'Unchecked'

  return (
    <article className={`border p-4 ${status === 'Failed' ? 'border-red-200 bg-red-500/5 dark:border-red-900/60' : status === 'Hold' ? 'border-amber-200 bg-amber-500/5 dark:border-amber-900/60' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-base font-semibold">{getItemLabel(item)}{item.isRequired ? <span className="text-primary"> *</span> : null}</p>
              <p className="mt-1 text-sm text-zinc-500">{item.inputType} / Weight: {item.weightEffectType}{item.fixedWeightKg ? ` ${item.fixedWeightKg} kg` : ''}</p>
            </div>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">{formatKg(calculateBopWeight([{ sectionId: item.sectionId, title: '', code: '', sortOrder: 0, isFixed: false, items: [item] }], { [item.itemId]: answer }))}</span>
          </div>
          <div className="mt-3">
            <DynamicInput item={item} value={answer} disabled={answerDisabled} uploading={uploading} onChange={onAnswerChange} onFileUpload={onFileUpload} />
          </div>
          {item.isRequired && !isAnswerFilled(answer) ? <p className="mt-2 text-sm text-amber-600">Required before submitting for inspection.</p> : null}
        </div>
        {canOfficialReview ? (
          <div className="border border-zinc-200 p-3 dark:border-zinc-800">
            <label className="block">
              <span className="text-sm font-medium">Scrutineer check</span>
              <select value={status} onChange={(event) => onReviewChange({ resultStatus: event.target.value as InspectionItemResultStatus })} className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950">
                {reviewStatuses.map((reviewStatus) => <option key={reviewStatus} value={reviewStatus}>{reviewStatus}</option>)}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Item comment</span>
              <textarea value={review?.comment ?? ''} onChange={(event) => onReviewChange({ comment: event.target.value })} rows={3} className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950" placeholder="Explain failure, hold, or override." />
            </label>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function VersionHistoryPanel({
  history,
  beforeVersionNo,
  afterVersionNo,
  diff,
  onBeforeChange,
  onAfterChange,
}: {
  history: InspectionVersionHistory
  beforeVersionNo: number | null
  afterVersionNo: number | null
  diff: ReturnType<typeof createInspectionVersionDiff>
  onBeforeChange: (versionNo: number | null) => void
  onAfterChange: (versionNo: number | null) => void
}) {
  const beforeVersion = history.versions.find((version) => version.versionNo === beforeVersionNo) ?? null
  const afterVersion = history.versions.find((version) => version.versionNo === afterVersionNo) ?? null
  const changedRows = diff.filter((row) => row.changed)

  return (
    <section className="mt-4 border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Version history</p>
          <h3 className="mt-1 text-lg font-semibold">Visual Compare</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Compare dynamic answers, item status, comments, and BOP changes across saved Inspection versions.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[26rem]">
          <VersionSelect label="Before" value={beforeVersionNo} versions={history.versions} onChange={onBeforeChange} />
          <VersionSelect label="After" value={afterVersionNo} versions={history.versions} onChange={onAfterChange} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MiniMetric label="Versions" value={String(history.versions.length)} />
        <MiniMetric label="Changed Items" value={String(changedRows.length)} />
        <MiniMetric label="Before BOP" value={formatKg(beforeVersion?.bopTotalWeightKg ?? null)} />
        <MiniMetric label="After BOP" value={formatKg(afterVersion?.bopTotalWeightKg ?? null)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <VersionSummary title="Before" version={beforeVersion} />
        <VersionSummary title="After" version={afterVersion} />
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto border border-zinc-200 dark:border-zinc-800">
        {changedRows.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No item-level changes between the selected versions.</p>
        ) : changedRows.map((row) => (
          <div key={row.itemId} className="grid gap-3 border-b border-zinc-200 p-3 last:border-b-0 lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)] dark:border-zinc-800">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{row.sectionTitle}</p>
              <p className="mt-1 text-sm font-semibold">{row.label}</p>
            </div>
            <DiffCell title={`v${beforeVersionNo ?? '--'}`} answer={row.beforeAnswer} status={row.beforeStatus} comment={row.beforeComment} />
            <DiffCell title={`v${afterVersionNo ?? '--'}`} answer={row.afterAnswer} status={row.afterStatus} comment={row.afterComment} highlight />
          </div>
        ))}
      </div>
    </section>
  )
}

function VersionSelect({ label, value, versions, onChange }: { label: string; value: number | null; versions: InspectionVersionSnapshot[]; onChange: (versionNo: number | null) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950">
        <option value="">Select version</option>
        {versions.map((version) => <option key={version.versionNo} value={version.versionNo}>v{version.versionNo} / {version.status}</option>)}
      </select>
    </label>
  )
}

function VersionSummary({ title, version }: { title: string; version: InspectionVersionSnapshot | null }) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      {version ? (
        <div className="mt-2 grid gap-2 text-sm">
          <p><span className="text-zinc-500">Version:</span> v{version.versionNo} / {version.status}</p>
          <p><span className="text-zinc-500">Issue:</span> {version.issueNote || '--'}</p>
          <p className="font-mono tabular-nums"><span className="font-sans text-zinc-500">BOP:</span> {formatKg(version.bopTotalWeightKg)}</p>
        </div>
      ) : <p className="mt-2 text-sm text-zinc-500">No version selected.</p>}
    </div>
  )
}

function DiffCell({ title, answer, status, comment, highlight = false }: { title: string; answer: unknown; status: string; comment: string; highlight?: boolean }) {
  return (
    <div className={`border p-3 text-sm ${highlight ? 'border-primary/50 bg-orange-500/5' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <p className="mt-2"><span className="text-zinc-500">Answer:</span> {formatInspectionValue(answer)}</p>
      <p className="mt-1"><span className="text-zinc-500">Status:</span> {status}</p>
      {comment ? <p className="mt-1"><span className="text-zinc-500">Comment:</span> {comment}</p> : null}
    </div>
  )
}

function DynamicInput({ item, value, disabled, uploading, onChange, onFileUpload }: { item: InspectionTemplateItem; value: unknown; disabled: boolean; uploading: boolean; onChange: (value: unknown) => void; onFileUpload: (file: File) => void }) {
  const commonClass = 'min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950'
  const options = item.options ?? []

  if (item.inputType === 'Checkbox') {
    if (options.length > 0) {
      const selected = Array.isArray(value) ? value.map(String) : []
      return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => {
        const optionValue = getOptionValue(option)
        return <label key={optionValue} className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-200 px-3 dark:border-zinc-800"><input type="checkbox" checked={selected.includes(optionValue)} disabled={disabled} onChange={(event) => onChange(event.target.checked ? [...selected, optionValue] : selected.filter((current) => current !== optionValue))} /> <span>{getOptionLabel(option)}</span></label>
      })}</div>
    }

    return <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-200 px-3 dark:border-zinc-800"><input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /> <span>Checked</span></label>
  }

  if (item.inputType === 'Dropdown') {
    return <select value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={commonClass}><option value="">Select value</option>{options.map((option) => <option key={getOptionValue(option)} value={getOptionValue(option)}>{getOptionLabel(option)}</option>)}</select>
  }

  if (item.inputType === 'Number') return <input type="number" min="0" step="0.1" value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${commonClass} font-mono tabular-nums`} />
  if (item.inputType === 'Date') return <input type="date" value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={commonClass} />
  if (item.inputType === 'File') {
    const fileAnswer = isInspectionFileAnswer(value) ? value : null
    return (
      <div className="space-y-2">
        <input
          type="file"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFileUpload(file)
          }}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:file:bg-zinc-100 dark:file:text-zinc-950"
        />
        {uploading ? <p className="inline-flex items-center gap-2 text-sm text-zinc-500"><Loader2 size={14} className="animate-spin" /> Uploading file</p> : null}
        {fileAnswer ? <p className="font-mono text-xs text-zinc-500">Uploaded: {fileAnswer.filename}</p> : null}
      </div>
    )
  }
  return <input type="text" value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={commonClass} />
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="border border-zinc-200 p-4 dark:border-zinc-800"><p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p><p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</p></div>
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="border border-zinc-200 p-3 dark:border-zinc-800"><p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p><p className="mt-2 font-mono text-sm tabular-nums">{value}</p></div>
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-mono text-sm tabular-nums">{value}</p></div>
}

function ActionButton({ label, loading, primary = false, onClick }: { label: string; loading: boolean; primary?: boolean; onClick: () => void }) {
  return <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={onClick} disabled={loading} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${primary ? 'bg-primary text-white' : 'border border-zinc-300 dark:border-zinc-800'}`}>{loading ? <Loader2 size={17} className="animate-spin" /> : <ClipboardCheck size={17} />}{label}</motion.button>
}

function StatusBadge({ status, eligible }: { status: InspectionStatus; eligible: boolean }) {
  const Icon = status === 'Passed' ? CheckCircle2 : status === 'Failed' ? XCircle : status === 'Hold' ? AlertTriangle : ShieldCheck
  return <div className="flex flex-wrap gap-2"><span className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${getStatusBadgeClass(status)}`}><Icon size={14} />{status}</span><span className={`inline-flex min-h-8 items-center rounded-md border px-3 text-xs font-semibold ${eligible ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400' : 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'}`}>{eligible ? 'Race eligible' : 'Not eligible'}</span></div>
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className = tone === 'success' ? 'mt-5 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400' : 'mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400'
  return <div className={className}>{message}</div>
}

function InspectionSkeleton() {
  return <div className="space-y-4">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-48 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />)}</div>
}

function InspectionEmpty() {
  return <div className="border border-zinc-200 p-8 dark:border-zinc-800"><ShieldCheck className="text-zinc-500" size={24} /><h2 className="mt-4 text-xl font-semibold">No active entries ready for inspection.</h2><p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Inspection Forms are created from Active Entry Forms. Approve Entry Forms first, then return here.</p></div>
}

function InspectionFilteredEmpty({ onClear }: { onClear: () => void }) {
  return <div className="border border-zinc-200 p-6 dark:border-zinc-800"><p className="font-medium">No Inspection Forms match this Series Race filter.</p><motion.button whileTap={{ scale: 0.98 }} type="button" onClick={onClear} className="mt-4 inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-800">Clear filter</motion.button></div>
}

function calculateTotals(entries: InspectionEntry[]) {
  return {
    draft: entries.filter((entry) => entry.status === 'Draft').length,
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

function getOptionValue(option: string | { label?: string; value?: string }) {
  return typeof option === 'string' ? option : option.value ?? option.label ?? ''
}

function getOptionLabel(option: string | { label?: string; value?: string; weightKg?: number }) {
  if (typeof option === 'string') return option
  return `${option.label ?? option.value ?? 'Option'}${option.weightKg ? ` / +${option.weightKg} kg` : ''}`
}

function isInspectionFileAnswer(value: unknown): value is InspectionFileAnswer {
  return typeof value === 'object' && value !== null && typeof (value as InspectionFileAnswer).filename === 'string'
}

function createInspectionFilePath(userId: string, formId: string, fileName: string) {
  const safeName = sanitizeFileName(fileName)
  return `${userId}/inspection-forms/${formId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function prefillInspectionAnswers(sections: InspectionTemplateSection[], answers: InspectionAnswers, detail: InspectionDetail) {
  const nextAnswers = { ...answers }
  const source = {
    ...flattenSnapshot(detail.context.vehicleSnapshot, 'vehicle'),
    ...flattenSnapshot(detail.context.teamSnapshot, 'team'),
    carnumber: detail.context.carNumber,
    car_number: detail.context.carNumber,
    competitor: detail.context.competitorName,
    driver: detail.context.competitorName,
    team: String(detail.context.teamSnapshot.teamName ?? ''),
  }

  for (const item of sections.flatMap((section) => section.items)) {
    if (isAnswerFilled(nextAnswers[item.itemId])) continue
    const key = normalizeLabel(`${item.labelEn ?? ''} ${item.labelTh}`)
    const matched = Object.entries(source).find(([sourceKey]) => key.includes(sourceKey) || sourceKey.includes(key))
    if (matched?.[1]) nextAnswers[item.itemId] = matched[1]
  }

  return nextAnswers
}

function flattenSnapshot(snapshot: Record<string, unknown>, prefix: string) {
  return Object.fromEntries(Object.entries(snapshot).flatMap(([key, value]) => {
    const normalizedKey = normalizeLabel(key)
    const normalizedValue = typeof value === 'string' || typeof value === 'number' ? value : ''
    return [[normalizedKey, normalizedValue], [`${prefix}${normalizedKey}`, normalizedValue]]
  }))
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function formatDateTime(value: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatKg(value: number | null) {
  if (value === null) return '--'
  return `${value} kg`
}

function formatPlainNumber(value: number | null) {
  if (value === null) return '--'
  return String(value)
}

function formatVehicle(snapshot: Record<string, unknown>) {
  return [snapshot.manufacturer, snapshot.model].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ') || 'Vehicle summary unavailable'
}

function formatTeam(snapshot: Record<string, unknown>) {
  return String(snapshot.teamName ?? '').trim() || 'No team'
}
