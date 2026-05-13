import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Check,
  ClipboardCheck,
  History,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  FilterResultSummary,
  SeriesRaceFilter,
} from '@/components/SeriesRaceFilter'
import { filterBySeriesRace, getSeriesRaceOptions } from '@/lib/series-race-filter'
import { supabase } from '@/lib/supabase'

type ChecklistEventOption = {
  eventId: string
  eventName: string
  seasonYear: number
}

type ChecklistTopic = {
  topicId: string
  eventId: string
  eventName: string
  titleTh: string | null
  titleEn: string | null
  title: string
  shortTitle: string
  sortOrder: number
  isRequired: boolean
}

type ChecklistItem = {
  topicId: string
  isChecked: boolean
  updatedByName: string | null
  updatedAt: string | null
}

type ChecklistEntry = {
  entryId: string
  eventId: string
  eventName: string
  seasonYear: number
  series_class: string
  seriesClass: string
  carNumber: string | null
  competitorUserId: string
  competitorName: string
  competitorEmail: string
  notes: string | null
  items: ChecklistItem[]
}

type ChecklistMatrix = {
  canEdit: boolean
  eventOptions: ChecklistEventOption[]
  topics: ChecklistTopic[]
  entries: ChecklistEntry[]
}

type AuditRow = {
  topic_id: string
  topic_title: string
  action: string
  is_checked: boolean
  actor_name: string
  created_at: string
}

type AuditTarget = {
  entry: ChecklistEntry
}

const emptyMatrix: ChecklistMatrix = {
  canEdit: false,
  eventOptions: [],
  topics: [],
  entries: [],
}

export function ChecklistPage() {
  const [matrix, setMatrix] = useState<ChecklistMatrix>(emptyMatrix)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedSeries, setSelectedSeries] = useState('all')
  const [topicTitleEn, setTopicTitleEn] = useState('')
  const [topicTitleTh, setTopicTitleTh] = useState('')
  const [topicRequired, setTopicRequired] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bulkTopicId, setBulkTopicId] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [auditTarget, setAuditTarget] = useState<AuditTarget | null>(null)
  const [auditRows, setAuditRows] = useState<AuditRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const loadMatrix = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_dynamic_checklist_matrix')

    if (!isActive()) return

    if (error) {
      setMatrix(emptyMatrix)
      setError(error.message)
    } else {
      const nextMatrix = normalizeMatrix((data ?? emptyMatrix) as ChecklistMatrix)
      setMatrix(nextMatrix)
      setNotesDraft(Object.fromEntries(nextMatrix.entries.map((entry) => [entry.entryId, entry.notes ?? ''])))
      setSelectedEventId((current) => current || getDefaultEventId(nextMatrix))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    async function run() {
      await loadMatrix(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadMatrix])

  const selectedEvent = useMemo(
    () => matrix.eventOptions.find((event) => event.eventId === selectedEventId) ?? null,
    [matrix.eventOptions, selectedEventId],
  )
  const eventTopics = useMemo(
    () => matrix.topics.filter((topic) => topic.eventId === selectedEventId).sort((a, b) => a.sortOrder - b.sortOrder),
    [matrix.topics, selectedEventId],
  )
  const eventEntries = useMemo(
    () => matrix.entries.filter((entry) => entry.eventId === selectedEventId),
    [matrix.entries, selectedEventId],
  )
  const seriesOptions = useMemo(() => getSeriesRaceOptions(eventEntries), [eventEntries])
  const visibleEntries = useMemo(
    () => filterChecklistEntries(filterBySeriesRace(eventEntries, selectedSeries), searchQuery),
    [eventEntries, selectedSeries, searchQuery],
  )
  const totals = useMemo(() => calculateTotals(eventEntries, eventTopics), [eventEntries, eventTopics])
  const visibleIncompleteCount = useMemo(
    () => visibleEntries.filter((entry) => getMissingTopics(entry, eventTopics).length > 0).length,
    [eventTopics, visibleEntries],
  )
  const selectedBulkTopicId = eventTopics.some((topic) => topic.topicId === bulkTopicId)
    ? bulkTopicId
    : eventTopics[0]?.topicId || ''

  function handleEventChange(eventId: string) {
    setSelectedEventId(eventId)
    setSelectedSeries('all')
    setSettingsOpen(false)
  }

  async function createTopic() {
    if (!selectedEventId) return
    setUpdatingKey('topic:create')
    setError(null)

    const { error } = await supabase.rpc('create_checklist_topic', {
      p_event_id: selectedEventId,
      p_title_en: topicTitleEn,
      p_title_th: topicTitleTh || null,
      p_is_required: topicRequired,
    })

    if (error) {
      setError(error.message)
      setUpdatingKey(null)
      return
    }

    setTopicTitleEn('')
    setTopicTitleTh('')
    setTopicRequired(true)
    await loadMatrix()
    setUpdatingKey(null)
  }

  async function moveTopic(topic: ChecklistTopic, direction: 'up' | 'down') {
    setUpdatingKey(`topic:${topic.topicId}`)
    setError(null)

    const { error } = await supabase.rpc('move_checklist_topic', {
      p_topic_id: topic.topicId,
      p_direction: direction,
    })

    if (error) {
      setError(error.message)
      setUpdatingKey(null)
      return
    }

    await loadMatrix()
    setUpdatingKey(null)
  }

  async function deleteTopic(topic: ChecklistTopic) {
    const confirmed = window.confirm(`Delete checklist topic "${topic.title}" from this event? Historical audit data will remain stored.`)
    if (!confirmed) return

    setUpdatingKey(`topic:${topic.topicId}`)
    setError(null)

    const { error } = await supabase.rpc('delete_checklist_topic', {
      p_topic_id: topic.topicId,
    })

    if (error) {
      setError(error.message)
      setUpdatingKey(null)
      return
    }

    await loadMatrix()
    setUpdatingKey(null)
  }

  async function updateChecklistItem(entry: ChecklistEntry, topic: ChecklistTopic, checked: boolean) {
    const nextKey = `${entry.entryId}:${topic.topicId}`
    setUpdatingKey(nextKey)
    setError(null)

    const { error } = await supabase.rpc('update_checklist_item', {
      p_entry_id: entry.entryId,
      p_topic_id: topic.topicId,
      p_is_checked: checked,
    })

    if (error) {
      setError(error.message)
      setUpdatingKey(null)
      return
    }

    await loadMatrix()
    setUpdatingKey(null)
  }

  async function bulkUpdateChecklistItems(checked: boolean) {
    if (!selectedBulkTopicId || visibleEntries.length === 0) return

    const topic = eventTopics.find((currentTopic) => currentTopic.topicId === selectedBulkTopicId)
    const confirmed = window.confirm(`${checked ? 'Check' : 'Uncheck'} "${topic?.title ?? 'selected topic'}" for ${visibleEntries.length} visible row(s)?`)
    if (!confirmed) return

    setBulkUpdating(true)
    setError(null)

    const { error } = await supabase.rpc('bulk_update_checklist_item', {
      p_entry_ids: visibleEntries.map((entry) => entry.entryId),
      p_topic_id: selectedBulkTopicId,
      p_is_checked: checked,
    })

    if (error) {
      setError(error.message)
      setBulkUpdating(false)
      return
    }

    await loadMatrix()
    setBulkUpdating(false)
  }

  async function saveNotes(entry: ChecklistEntry) {
    setUpdatingKey(`notes:${entry.entryId}`)
    setError(null)

    const { error } = await supabase.rpc('update_entry_checklist', {
      p_entry_id: entry.entryId,
      p_competitor_checked_in: null,
      p_sticker_issued: null,
      p_payment_verified: null,
      p_documents_verified: null,
      p_wristband_issued: null,
      p_notes: notesDraft[entry.entryId] ?? '',
    })

    if (error) {
      setError(error.message)
      setUpdatingKey(null)
      return
    }

    await loadMatrix()
    setUpdatingKey(null)
  }

  async function openAudit(entry: ChecklistEntry) {
    setAuditTarget({ entry })
    setAuditRows([])
    setAuditLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_checklist_entry_audit', {
      p_entry_id: entry.entryId,
    })

    if (error) {
      setError(error.message)
      setAuditRows([])
    } else {
      setAuditRows((data ?? []) as AuditRow[])
    }

    setAuditLoading(false)
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Candidate control</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Checklist</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Event-specific checklist columns with live check/uncheck audit history for every active Entry Form.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadMatrix()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Active Entries" value={eventEntries.length} />
        <SummaryCard label="Checklist Topics" value={eventTopics.length} />
        <SummaryCard label="Complete" value={totals.complete} />
      </div>

      {error ? (
        <div className="mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 border border-zinc-200 p-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-end dark:border-zinc-800">
        <EventFilter value={selectedEventId} options={matrix.eventOptions} onChange={handleEventChange} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {selectedEvent ? `${selectedEvent.eventName} / ${selectedEvent.seasonYear}` : 'Select an event to load checklist topics.'}
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
              {matrix.canEdit ? 'Admin/Secretary edit mode' : 'Read-only access'}
            </p>
            {matrix.canEdit && selectedEventId ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 dark:border-zinc-800 dark:text-zinc-100"
              >
                <Settings2 size={16} />
                Topic Settings
              </motion.button>
            ) : null}
          </div>
        </div>
      </div>

      {matrix.canEdit && selectedEventId && settingsOpen ? (
        <TopicSettingsPanel
          eventName={selectedEvent ? `${selectedEvent.eventName} / ${selectedEvent.seasonYear}` : 'Selected event'}
          titleEn={topicTitleEn}
          titleTh={topicTitleTh}
          required={topicRequired}
          topics={eventTopics}
          updatingKey={updatingKey}
          onTitleEnChange={setTopicTitleEn}
          onTitleThChange={setTopicTitleTh}
          onRequiredChange={setTopicRequired}
          onCreate={createTopic}
          onMove={moveTopic}
          onDelete={deleteTopic}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      <div className="mt-6">
        {!loading && eventEntries.length > 0 ? (
          <div className="mb-4 grid gap-3 border border-zinc-200 p-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,24rem)_1fr] lg:items-end dark:border-zinc-800">
            <SeriesRaceFilter value={selectedSeries} options={seriesOptions} onChange={setSelectedSeries} />
            <ChecklistSearch value={searchQuery} onChange={setSearchQuery} />
            <FilterResultSummary
              visible={visibleEntries.length}
              total={eventEntries.length}
              onClear={() => {
                setSelectedSeries('all')
                setSearchQuery('')
              }}
            />
          </div>
        ) : null}
        {!loading && matrix.canEdit && visibleEntries.length > 0 && eventTopics.length > 0 ? (
          <BulkActionBar
            topics={eventTopics}
            selectedTopicId={selectedBulkTopicId}
            visibleCount={visibleEntries.length}
            updating={bulkUpdating}
            onTopicChange={setBulkTopicId}
            onBulkUpdate={bulkUpdateChecklistItems}
          />
        ) : null}
        {!loading && visibleEntries.length > 0 && eventTopics.length > 0 ? (
          <CompletionWarning visibleIncompleteCount={visibleIncompleteCount} visibleCount={visibleEntries.length} />
        ) : null}
        {loading ? <ChecklistSkeleton /> : null}
        {!loading && !selectedEventId ? <ChecklistEmpty title="No event is available." description="Create an Event first before configuring Checklist topics." /> : null}
        {!loading && selectedEventId && eventTopics.length === 0 ? <ChecklistEmpty title="No checklist topics configured." description="Admin or Secretary can add the first topic from the topic settings panel." /> : null}
        {!loading && selectedEventId && eventTopics.length > 0 && eventEntries.length === 0 ? <ChecklistEmpty title="No active entries for this event." description="Entries appear here after Secretary/Admin approval changes their status to Active." /> : null}
        {!loading && eventEntries.length > 0 && visibleEntries.length === 0 ? (
          <ChecklistFilteredEmpty onClear={() => {
            setSelectedSeries('all')
            setSearchQuery('')
          }} />
        ) : null}
        {!loading && visibleEntries.length > 0 && eventTopics.length > 0 ? (
          <ChecklistTable
            entries={visibleEntries}
            topics={eventTopics}
            editable={matrix.canEdit}
            updatingKey={updatingKey}
            notesDraft={notesDraft}
            setNotesDraft={setNotesDraft}
            onUpdateItem={updateChecklistItem}
            onOpenAudit={openAudit}
            onSaveNotes={saveNotes}
          />
        ) : null}
      </div>

      {auditTarget ? (
        <AuditPanel
          target={auditTarget}
          rows={auditRows}
          loading={auditLoading}
          onClose={() => setAuditTarget(null)}
        />
      ) : null}
    </section>
  )
}

function EventFilter({
  value,
  options,
  onChange,
}: {
  value: string
  options: ChecklistEventOption[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Event</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      >
        {options.length === 0 ? <option value="">No events available</option> : null}
        {options.map((option) => (
          <option key={option.eventId} value={option.eventId}>
            {option.eventName} / {option.seasonYear}
          </option>
        ))}
      </select>
    </label>
  )
}

function ChecklistSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Search</span>
      <div className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 transition focus-within:border-primary dark:border-zinc-800 dark:bg-zinc-950">
        <Search size={16} className="shrink-0 text-zinc-500" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-500"
          placeholder="Car number, name, email"
          autoComplete="off"
        />
        {value ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onChange('')}
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
            aria-label="Clear checklist search"
          >
            <X size={14} />
          </motion.button>
        ) : null}
      </div>
    </label>
  )
}

function BulkActionBar({
  topics,
  selectedTopicId,
  visibleCount,
  updating,
  onTopicChange,
  onBulkUpdate,
}: {
  topics: ChecklistTopic[]
  selectedTopicId: string
  visibleCount: number
  updating: boolean
  onTopicChange: (value: string) => void
  onBulkUpdate: (checked: boolean) => Promise<void>
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="mb-4 border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_auto_auto] lg:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Bulk action</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Applies only to the {visibleCount} visible row(s) after Event, Series Race, and Search filters.
          </p>
        </div>
        <label className="block min-w-0">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Checklist Topic</span>
          <select
            value={selectedTopicId}
            onChange={(event) => onTopicChange(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
          >
            {topics.map((topic) => (
              <option key={topic.topicId} value={topic.topicId}>{topic.title}</option>
            ))}
          </select>
        </label>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          disabled={updating || !selectedTopicId}
          onClick={() => onBulkUpdate(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Check Visible
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          disabled={updating || !selectedTopicId}
          onClick={() => onBulkUpdate(false)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-100"
        >
          <X size={16} />
          Uncheck Visible
        </motion.button>
      </div>
    </motion.section>
  )
}

function CompletionWarning({
  visibleIncompleteCount,
  visibleCount,
}: {
  visibleIncompleteCount: number
  visibleCount: number
}) {
  if (visibleIncompleteCount === 0) {
    return (
      <div className="mb-3 inline-flex border border-emerald-200 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400">
        All {visibleCount} visible row(s) are 100% complete.
      </div>
    )
  }

  return (
    <div className="mb-3 inline-flex items-center gap-2 border border-amber-200 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/60 dark:text-amber-500">
      <AlertTriangle size={14} className="shrink-0" />
      <span>{visibleIncompleteCount}/{visibleCount} incomplete visible row(s)</span>
    </div>
  )
}

function TopicSettingsPanel({
  eventName,
  titleEn,
  titleTh,
  required,
  topics,
  updatingKey,
  onTitleEnChange,
  onTitleThChange,
  onRequiredChange,
  onCreate,
  onMove,
  onDelete,
  onClose,
}: {
  eventName: string
  titleEn: string
  titleTh: string
  required: boolean
  topics: ChecklistTopic[]
  updatingKey: string | null
  onTitleEnChange: (value: string) => void
  onTitleThChange: (value: string) => void
  onRequiredChange: (value: boolean) => void
  onCreate: () => Promise<void>
  onMove: (topic: ChecklistTopic, direction: 'up' | 'down') => Promise<void>
  onDelete: (topic: ChecklistTopic) => Promise<void>
  onClose: () => void
}) {
  const creating = updatingKey === 'topic:create'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-zinc-950/40 p-4 sm:items-center sm:justify-center">
      <motion.aside
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="max-h-[82vh] w-full max-w-3xl overflow-y-auto border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-primary dark:border-zinc-800">
              <Settings2 size={16} />
            </span>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Column configuration</p>
              <h2 className="mt-1 text-lg font-semibold">Topic Settings</h2>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{eventName}</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
            aria-label="Close topic settings"
          >
            <X size={17} />
          </motion.button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end">
        <label className="block">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Topic title English</span>
          <input
            value={titleEn}
            onChange={(event) => onTitleEnChange(event.target.value)}
            className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-zinc-800"
            placeholder="Briefing attended"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Topic title Thai</span>
          <input
            value={titleTh}
            onChange={(event) => onTitleThChange(event.target.value)}
            className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-zinc-800"
            placeholder="เข้าประชุมนักแข่ง"
          />
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-800">
          <input
            type="checkbox"
            checked={required}
            onChange={(event) => onRequiredChange(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Required
        </label>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onCreate}
          disabled={creating || !titleEn.trim()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Add Topic
        </motion.button>
      </div>

      <div className="mt-4 grid gap-2">
        {topics.map((topic, index) => (
          <div key={topic.topicId} className="flex flex-col gap-2 border border-zinc-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium">{topic.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                order {topic.sortOrder}{topic.isRequired ? ' / required' : ''}{topic.titleTh ? ` / ${topic.titleTh}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TopicActionButton label="Move up" disabled={index === 0 || updatingKey === `topic:${topic.topicId}`} onClick={() => onMove(topic, 'up')}>
                <ArrowUp size={15} />
              </TopicActionButton>
              <TopicActionButton label="Move down" disabled={index === topics.length - 1 || updatingKey === `topic:${topic.topicId}`} onClick={() => onMove(topic, 'down')}>
                <ArrowDown size={15} />
              </TopicActionButton>
              <TopicActionButton label="Delete" disabled={updatingKey === `topic:${topic.topicId}`} danger onClick={() => onDelete(topic)}>
                <Trash2 size={15} />
              </TopicActionButton>
            </div>
          </div>
        ))}
      </div>
      </motion.aside>
    </div>
  )
}

function TopicActionButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
        className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border-red-200 text-red-700 dark:border-red-900/60 dark:text-red-400'
          : 'border-zinc-300 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300'
      }`}
    >
      {children}
    </motion.button>
  )
}

function ChecklistTable({
  entries,
  topics,
  editable,
  updatingKey,
  notesDraft,
  setNotesDraft,
  onUpdateItem,
  onOpenAudit,
  onSaveNotes,
}: {
  entries: ChecklistEntry[]
  topics: ChecklistTopic[]
  editable: boolean
  updatingKey: string | null
  notesDraft: Record<string, string>
  setNotesDraft: Dispatch<SetStateAction<Record<string, string>>>
  onUpdateItem: (entry: ChecklistEntry, topic: ChecklistTopic, checked: boolean) => Promise<void>
  onOpenAudit: (entry: ChecklistEntry) => Promise<void>
  onSaveNotes: (entry: ChecklistEntry) => Promise<void>
}) {
  return (
    <div className="overflow-hidden border border-zinc-200 dark:border-zinc-800">
      <div className="hidden xl:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="border-b border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 font-medium dark:bg-zinc-950">Competitor</th>
                <th className="px-4 py-3 font-medium">Series</th>
                <th className="px-4 py-3 font-medium">Car</th>
                  {topics.map((topic) => (
                  <th key={topic.topicId} className="min-w-40 px-3 py-3 text-left font-medium">{topic.shortTitle}</th>
                ))}
                <th className="min-w-80 px-4 py-3 font-medium">Notes & Row Log</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.entryId} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                  <td className="sticky left-0 z-10 bg-zinc-50 px-4 py-4 dark:bg-zinc-950">
                    <p className="font-medium">{entry.competitorName}</p>
                    <p className="mt-1 text-sm text-zinc-500">{entry.competitorEmail}</p>
                    <EntryCompletionStatus entry={entry} topics={topics} />
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">{entry.seriesClass}</td>
                  <td className="px-4 py-4 font-mono tabular-nums">#{entry.carNumber ?? '--'}</td>
                  {topics.map((topic) => {
                    const item = getEntryItem(entry, topic.topicId)
                    const key = `${entry.entryId}:${topic.topicId}`
                    return (
                      <td key={topic.topicId} className="px-3 py-4 align-top">
                        <ChecklistToggle
                          checked={item.isChecked}
                          disabled={!editable || updatingKey === key}
                          label={`${topic.title} for ${entry.competitorName}`}
                          onClick={() => onUpdateItem(entry, topic, !item.isChecked)}
                        />
                        <AuditTimestamp item={item} />
                      </td>
                    )
                  })}
                  <td className="px-4 py-4 align-top">
                    <NotesEditor
                      entry={entry}
                      editable={editable}
                      updating={updatingKey === `notes:${entry.entryId}`}
                      value={notesDraft[entry.entryId] ?? ''}
                      onChange={(value) => setNotesDraft((current) => ({ ...current, [entry.entryId]: value }))}
                      onSave={() => onSaveNotes(entry)}
                      onOpenAudit={() => onOpenAudit(entry)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="divide-y divide-zinc-200 xl:hidden dark:divide-zinc-800">
        {entries.map((entry) => (
          <article key={entry.entryId} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{entry.competitorName}</h2>
                <p className="mt-1 text-sm text-zinc-500">{entry.eventName} / {entry.seriesClass}</p>
                <EntryCompletionStatus entry={entry} topics={topics} />
              </div>
              <span className="font-mono text-sm tabular-nums">#{entry.carNumber ?? '--'}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {topics.map((topic) => {
                const item = getEntryItem(entry, topic.topicId)
                const key = `${entry.entryId}:${topic.topicId}`
                return (
                  <div key={topic.topicId} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                    <motion.button
                      type="button"
                      disabled={!editable || updatingKey === key}
                      onClick={() => onUpdateItem(entry, topic, !item.isChecked)}
                      whileTap={{ scale: 0.98 }}
                      className={`flex min-h-11 w-full items-center justify-between rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                        item.isChecked
                          ? 'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-400'
                          : 'border-zinc-300 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      <span>{topic.title}</span>
                      {item.isChecked ? <Check size={16} /> : <X size={16} />}
                    </motion.button>
                    <AuditTimestamp item={item} />
                  </div>
                )
              })}
            </div>
            <div className="mt-4">
              <NotesEditor
                entry={entry}
                editable={editable}
                updating={updatingKey === `notes:${entry.entryId}`}
                value={notesDraft[entry.entryId] ?? ''}
                onChange={(value) => setNotesDraft((current) => ({ ...current, [entry.entryId]: value }))}
                onSave={() => onSaveNotes(entry)}
                onOpenAudit={() => onOpenAudit(entry)}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function ChecklistToggle({
  checked,
  disabled,
  label,
  onClick,
}: {
  checked: boolean
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? 'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-400'
          : 'border-zinc-300 text-zinc-500 dark:border-zinc-800'
      }`}
    >
      {checked ? <Check size={17} /> : <X size={17} />}
    </motion.button>
  )
}

function EntryCompletionStatus({ entry, topics }: { entry: ChecklistEntry; topics: ChecklistTopic[] }) {
  const missingTopics = getMissingTopics(entry, topics)

  if (missingTopics.length === 0) {
    return (
      <span className="mt-2 inline-flex rounded-sm bg-emerald-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
        Complete
      </span>
    )
  }

  return (
    <div className="mt-2 flex max-w-72 items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <p>
        Missing {missingTopics.length}
      </p>
    </div>
  )
}

function AuditTimestamp({ item }: { item: ChecklistItem }) {
  return (
    <p className="mt-2 min-h-4 text-left text-xs leading-5 text-zinc-500">
      {item.updatedAt ? `${item.updatedByName ?? 'Unknown'} / ${formatDateTime(item.updatedAt)}` : 'No action yet'}
    </p>
  )
}

function RowAuditButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
      aria-label="Open competitor checklist audit"
      title="Open competitor checklist audit"
    >
      <History size={16} />
    </motion.button>
  )
}

function NotesEditor({
  entry,
  editable,
  updating,
  value,
  onChange,
  onSave,
  onOpenAudit,
}: {
  entry: ChecklistEntry
  editable: boolean
  updating: boolean
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onOpenAudit: () => void
}) {
  if (!editable) {
    return (
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{entry.notes || 'No notes recorded.'}</p>
        <RowAuditButton onClick={onOpenAudit} />
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-zinc-800"
        placeholder="Add operational note"
      />
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        disabled={updating}
        onClick={onSave}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        aria-label="Save checklist note"
      >
        {updating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      </motion.button>
      <RowAuditButton onClick={onOpenAudit} />
    </div>
  )
}

function AuditPanel({
  target,
  rows,
  loading,
  onClose,
}: {
  target: AuditTarget
  rows: AuditRow[]
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-zinc-950/40 p-4 sm:items-center sm:justify-center">
      <motion.aside
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="max-h-[82vh] w-full max-w-2xl overflow-y-auto border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Audit trail</p>
            <h2 className="mt-2 text-xl font-semibold">Checklist Row Log</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {target.entry.competitorName} / car #{target.entry.carNumber ?? '--'}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
            aria-label="Close audit panel"
          >
            <X size={17} />
          </motion.button>
        </div>
        {loading ? (
          <div className="mt-5 flex min-h-24 items-center gap-2 text-sm text-zinc-500">
            <Loader2 size={16} className="animate-spin" />
            Loading audit history
          </div>
        ) : null}
        {!loading && rows.length === 0 ? (
          <div className="mt-5 border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            No check/uncheck history has been recorded for this competitor yet.
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="mt-5 divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {rows.map((row) => (
              <div key={`${row.created_at}:${row.topic_id}:${row.action}`} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-semibold">{row.topic_title}</p>
                  <p className="mt-1 text-sm capitalize text-zinc-600 dark:text-zinc-400">{row.action}</p>
                  <p className="mt-1 text-sm text-zinc-500">{row.actor_name}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${row.is_checked ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}>
                    {row.is_checked ? 'Checked' : 'Unchecked'}
                  </span>
                  <p className="mt-2 font-mono text-xs text-zinc-500 tabular-nums">{formatDateTime(row.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </motion.aside>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ChecklistSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function ChecklistEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-zinc-200 p-6 dark:border-zinc-800">
      <ClipboardCheck size={24} className="text-primary" />
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  )
}

function ChecklistFilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="border border-zinc-200 p-6 dark:border-zinc-800">
      <ClipboardCheck size={24} className="text-primary" />
      <h2 className="mt-4 text-xl font-semibold">No checklist entries match this Series Race.</h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Clear the filter to return to the full active-entry checklist.
      </p>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onClear}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-800"
      >
        Clear filter
      </motion.button>
    </div>
  )
}

function normalizeMatrix(matrix: ChecklistMatrix): ChecklistMatrix {
  return {
    canEdit: Boolean(matrix.canEdit),
    eventOptions: matrix.eventOptions ?? [],
    topics: matrix.topics ?? [],
    entries: (matrix.entries ?? []).map((entry) => ({
      ...entry,
      series_class: entry.seriesClass,
      items: entry.items ?? [],
    })),
  }
}

function getDefaultEventId(matrix: ChecklistMatrix) {
  return matrix.entries[0]?.eventId ?? matrix.eventOptions[0]?.eventId ?? ''
}

function getEntryItem(entry: ChecklistEntry, topicId: string): ChecklistItem {
  return entry.items.find((item) => item.topicId === topicId) ?? {
    topicId,
    isChecked: false,
    updatedByName: null,
    updatedAt: null,
  }
}

function getMissingTopics(entry: ChecklistEntry, topics: ChecklistTopic[]) {
  return topics.filter((topic) => !getEntryItem(entry, topic.topicId).isChecked)
}

function filterChecklistEntries(entries: ChecklistEntry[], searchQuery: string) {
  const query = searchQuery.trim().toLowerCase()
  if (!query) return entries

  return entries.filter((entry) => {
    const haystack = [
      entry.carNumber ?? '',
      entry.competitorName,
      entry.competitorEmail,
      entry.seriesClass,
      entry.eventName,
    ].join(' ').toLowerCase()

    return haystack.includes(query)
  })
}

function calculateTotals(entries: ChecklistEntry[], topics: ChecklistTopic[]) {
  return entries.reduce(
    (totals, entry) => {
      const complete = topics.length > 0 && topics.every((topic) => getEntryItem(entry, topic.topicId).isChecked)
      return {
        complete: totals.complete + (complete ? 1 : 0),
      }
    },
    { complete: 0 },
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
