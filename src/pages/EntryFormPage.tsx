import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  FolderCheck,
  Import,
  Loader2,
  PenLine,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import {
  FilterResultSummary,
  SeriesRaceFilter,
} from '@/components/SeriesRaceFilter'
import { filterBySeriesRace, getSeriesRaceOptions } from '@/lib/series-race-filter'
import { supabase } from '@/lib/supabase'
import { createEmptyEntryListFilters, filterEntryList, getEntryListFilterOptions, getEntryStatusDisplay, getPaperEntryReadiness, hasActiveEntryListFilters, type EntryListFilters, type EntryListRow } from './entryFormListHelpers'

type EntryStatus = 'draft' | 'pending' | 'active' | 'inactive' | 'rejected'

type EntryFormRow = EntryListRow & {
  id: string
}

type ApprovalDocument = {
  documentType: string
  isRequired: boolean
  uploadedAt: string
  fileAssetId: string
  bucket: string
  path: string
  filename: string
  mimeType: string | null
  sizeBytes: number | null
}

type PendingEntryApproval = {
  id: string
  batch_id: string
  event_name: string
  season_year: number
  series_class: string
  car_number: string | null
  status: EntryStatus
  submitted_at: string | null
  created_at: string
  competitor_user_id: string
  competitor_name: string
  competitor_email: string
  personal_snapshot: PersonalSnapshotState
  driver_license_snapshot: DriverLicenseState
  vehicle_snapshot: VehicleState
  team_snapshot: TeamSnapshotState
  signature_path: string | null
  documents: ApprovalDocument[]
}

type Step1Option = {
  season_id: string
  season_name: string
  season_year: number
  event_id: string
  event_name: string
  event_order: number
  event_status: string
  config_id: string
  series_class: string
  series_name: string
  grade_name: string
}

type Step1State = {
  seasonId: string
  eventIds: string[]
  seriesName: string
  gradeName: string
  carNumber: string
}

type PersonalSnapshotState = {
  firstNameTh: string
  lastNameTh: string
  firstNameEn: string
  lastNameEn: string
  dateOfBirth: string
  bloodType: string
  nationality: string
  identityNo: string
  passportNo: string
  address: string
  postcode: string
  email: string
  mobileNo: string
  lineId: string
  facebook: string
  instagram: string
  youtube: string
  tiktok: string
}

type DriverLicenseState = {
  licenseNo: string
  categorizationGrade: string
  issuedBy: string
  issuedDate: string
  expiryDate: string
}

type VehicleState = {
  manufacturer: string
  model: string
  color: string
  year: string
  engineSizeCc: string
  engineCode: string
}

type TeamSnapshotState = {
  teamId: string
  teamName: string
  managerName: string
  managerPhone: string
  pitShareRequest: string
  documentAddress: string
  postcode: string
}

type FileAssetState = {
  fileAssetId: string
  path: string
  filename: string
  mimeType: string
  sizeBytes: number
}

type DocumentKey =
  | 'drivers_photo'
  | 'id_or_passport_copy'
  | 'medical_certificate'
  | 'driver_license_copy'
  | 'payment_slip'
  | 'book_bank_copy'

type DocumentUploadsState = Partial<Record<DocumentKey, FileAssetState>>

type ConsentState = {
  accepted: boolean
  signedAt: string
  signatureAsset: FileAssetState | null
}

type EntryFormState = {
  step1: Step1State
  personalSnapshot: PersonalSnapshotState
  driverLicense: DriverLicenseState
  vehicle: VehicleState
  teamSnapshot: TeamSnapshotState
  documents: DocumentUploadsState
  consent: ConsentState
}

type TeamPrefill = {
  team_id: string
  team_name: string | null
  manager_name: string | null
  manager_phone: string | null
  pit_share_request: string | null
  document_address: string | null
  postcode: string | null
}

const steps = [
  'Event & Class',
  'Personal & Team',
  'Vehicle',
  'Documents',
  'Consent',
]

const initialStep1: Step1State = {
  seasonId: '',
  eventIds: [],
  seriesName: '',
  gradeName: '',
  carNumber: '',
}

const emptyPersonalSnapshot: PersonalSnapshotState = {
  firstNameTh: '',
  lastNameTh: '',
  firstNameEn: '',
  lastNameEn: '',
  dateOfBirth: '',
  bloodType: '',
  nationality: '',
  identityNo: '',
  passportNo: '',
  address: '',
  postcode: '',
  email: '',
  mobileNo: '',
  lineId: '',
  facebook: '',
  instagram: '',
  youtube: '',
  tiktok: '',
}

const emptyDriverLicense: DriverLicenseState = {
  licenseNo: '',
  categorizationGrade: '',
  issuedBy: '',
  issuedDate: '',
  expiryDate: '',
}

const emptyVehicle: VehicleState = {
  manufacturer: '',
  model: '',
  color: '',
  year: '',
  engineSizeCc: '',
  engineCode: '',
}

const emptyTeamSnapshot: TeamSnapshotState = {
  teamId: '',
  teamName: '',
  managerName: '',
  managerPhone: '',
  pitShareRequest: '',
  documentAddress: '',
  postcode: '',
}

const emptyConsent: ConsentState = {
  accepted: false,
  signedAt: '',
  signatureAsset: null,
}

const requiredDocuments: Array<{
  key: DocumentKey
  title: string
  description: string
  accept: string
}> = [
  {
    key: 'drivers_photo',
    title: "Driver's Photo",
    description: "รูปถ่ายนักแข่งสวมชุดแข่ง / Wear a racing suit. Minimum practical target: 1 MB.",
    accept: 'image/*',
  },
  {
    key: 'id_or_passport_copy',
    title: 'Copy of ID / Passport',
    description: 'สำเนาบัตรประชาชนหรือพาสปอร์ต / PDF or image accepted.',
    accept: 'image/*,application/pdf',
  },
  {
    key: 'medical_certificate',
    title: 'Medical Certificate',
    description: 'ใบรับรองแพทย์ / PDF or image accepted.',
    accept: 'image/*,application/pdf',
  },
  {
    key: 'driver_license_copy',
    title: "Copy of Driver's License",
    description: 'สำเนาใบอนุญาตขับแข่ง / PDF or image accepted.',
    accept: 'image/*,application/pdf',
  },
  {
    key: 'payment_slip',
    title: 'Payment Slip',
    description: 'หลักฐานการชำระค่าสมัคร / PDF or image accepted.',
    accept: 'image/*,application/pdf',
  },
  {
    key: 'book_bank_copy',
    title: 'Copy of Book Bank',
    description: 'สำเนาสมุดบัญชีสำหรับเงินรางวัล / PDF or image accepted.',
    accept: 'image/*,application/pdf',
  },
]

const legalConsentThai =
  'ข้าพเจ้าจะไม่เรียกร้องค่าเสียหายอันเกิดจากอุบัติเหตุในการแข่งขัน และยินยอมเป็นผู้รับผิดชอบเองในความเสียหายแทนผู้จัดการแข่งขัน คณะกรรมการ เจ้าของสนาม ผู้สนับสนุน เจ้าหน้าที่ ผู้แทน และตัวแทนนิติบุคคลที่เกี่ยวข้อง รวมถึงยินยอมให้บริษัทฯ เก็บรวบรวม ใช้ และ/หรือเปิดเผยข้อมูลส่วนบุคคลเพื่อวัตถุประสงค์ในการสมัครแข่งขันรถยนต์ทางเรียบ รายการ PT MAXNITRON RACING SERIES ตามกฎหมายที่เกี่ยวข้อง ข้าพเจ้าจึงลงลายมือชื่อเพื่อรับทราบและยินยอมตามข้อความดังกล่าว.'

const legalConsentEnglish =
  'I hereby agree not to claim damages resulting from accidents during the competition and agree to be fully responsible for any damages on behalf of the organizer, all officials, venue owner, sponsors, representatives, and related parties. I consent to the collection, use, and disclosure of my personal data for the purpose of registering for the PT MAXNITRON RACING SERIES road racing competition in accordance with applicable laws. I sign to acknowledge and consent to the above terms.'

export function EntryFormPage() {
  const { roles } = useAuth()
  const [searchParams] = useSearchParams()
  const [entries, setEntries] = useState<EntryFormRow[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [entriesError, setEntriesError] = useState<string | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [filters, setFilters] = useState<EntryListFilters>(() => createEmptyEntryListFilters())
  const isApprovalRole = roles.includes('ADMIN') || roles.includes('SECRETARY')
  const canSoftDelete = roles.includes('ADMIN')
  const paperEntryReadiness = useMemo(() => getPaperEntryReadiness(roles), [roles])
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const linkedEntryFormId = searchParams.get('entryFormId')
  const filterOptions = useMemo(() => getEntryListFilterOptions(entries), [entries])
  const visibleEntries = useMemo(() => filterEntryList(entries, filters), [entries, filters])
  const linkedEntry = useMemo(
    () => entries.find((entry) => entry.id === linkedEntryFormId) ?? null,
    [entries, linkedEntryFormId],
  )

  const loadEntries = useCallback(async (isActive: () => boolean = () => true) => {
    setEntriesLoading(true)
    setEntriesError(null)

    const { data, error } = await supabase.rpc('get_my_entry_forms')

    if (!isActive()) return

    if (error) {
      setEntries([])
      setEntriesError(error.message)
    } else {
      setEntries((data ?? []) as EntryFormRow[])
    }

    setEntriesLoading(false)
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

  async function deleteEntry(entry: EntryFormRow) {
    const confirmed = window.confirm(`Delete Entry Form #${entry.car_number || '--'} for ${entry.event_name}? You can restore it from Recently Delete within 30 days.`)
    if (!confirmed) return

    setDeletingEntryId(entry.id)
    setEntriesError(null)

    const { error } = await supabase.rpc('soft_delete_entry_form', { p_entry_id: entry.id })

    if (error) {
      setEntriesError(error.message)
    } else {
      await loadEntries()
    }

    setDeletingEntryId(null)
  }

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="border-b border-zinc-200 pb-6 dark:border-zinc-800"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">
              Digital passport
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Entry Form</h1>
            <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
              Create and track race entry documents for the current season. Approved entries become
              locked source data for inspection and weight-in workflows.
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus size={18} />
            Create Entry Form
          </motion.button>
        </div>
      </motion.header>

      {paperEntryReadiness.canPreparePaperEntry ? <PaperEntryOperationsPanel readiness={paperEntryReadiness} /> : null}

      <section className="mt-6">
        {!entriesLoading && !entriesError && entries.length > 0 ? (
          <EntryListFilterBoard filters={filters} options={filterOptions} visible={visibleEntries.length} total={entries.length} onChange={setFilters} onClear={() => setFilters(createEmptyEntryListFilters())} />
        ) : null}
        {entriesLoading ? <EntryTableSkeleton /> : null}
        {!entriesLoading && entriesError ? <ErrorPanel message={entriesError} /> : null}
        {!entriesLoading && !entriesError && linkedEntryFormId && !linkedEntry ? (
          <div className="mb-4 border border-amber-300 bg-amber-500/10 p-4 text-sm text-amber-800 dark:border-amber-900/70 dark:text-amber-500">
            This Entry Form notification points to a document that is no longer visible to your account.
          </div>
        ) : null}
        {!entriesLoading && !entriesError && entries.length === 0 ? (
          <EmptyState onCreate={() => setCreatorOpen(true)} />
        ) : null}
        {!entriesLoading && !entriesError && entries.length > 0 && visibleEntries.length === 0 ? (
          <FilteredEmptyState onClear={() => setFilters(createEmptyEntryListFilters())} />
        ) : null}
        {!entriesLoading && !entriesError && visibleEntries.length > 0 ? (
          <EntryTable
            entries={visibleEntries}
            highlightedEntryId={linkedEntryFormId}
            canSoftDelete={canSoftDelete}
            deletingEntryId={deletingEntryId}
            onDelete={deleteEntry}
          />
        ) : null}
      </section>

      {isApprovalRole ? (
        <SecretaryApprovalPanel onChanged={() => loadEntries()} />
      ) : null}

      <AnimatePresence>
        {creatorOpen ? <EntryFormCreator onClose={() => setCreatorOpen(false)} /> : null}
      </AnimatePresence>
    </div>
  )
}

function SecretaryApprovalPanel({ onChanged }: { onChanged: () => void }) {
  const [pendingEntries, setPendingEntries] = useState<PendingEntryApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<PendingEntryApproval | null>(null)
  const [selectedSeries, setSelectedSeries] = useState('all')
  const seriesOptions = useMemo(() => getSeriesRaceOptions(pendingEntries), [pendingEntries])
  const visibleEntries = useMemo(
    () => filterBySeriesRace(pendingEntries, selectedSeries),
    [pendingEntries, selectedSeries],
  )

  const loadPending = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_secretary_pending_entries')

    if (!isActive()) return

    if (error) {
      setPendingEntries([])
      setError(error.message)
    } else {
      setPendingEntries((data ?? []) as PendingEntryApproval[])
    }

    setLoading(false)
  }, [])

  async function refreshAfterAction() {
    await loadPending()
    onChanged()
  }

  useEffect(() => {
    let active = true

    async function run() {
      await loadPending(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadPending])

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Secretary control</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Pending Approvals</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Review submitted entry snapshots and required documents before activating locked race data.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadPending()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-800"
        >
          Refresh
        </motion.button>
      </div>

      <div className="mt-5">
        {!loading && !error && pendingEntries.length > 0 ? (
          <div className="mb-4 grid gap-3 border border-zinc-200 p-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end dark:border-zinc-800">
            <SeriesRaceFilter value={selectedSeries} options={seriesOptions} onChange={setSelectedSeries} />
            <FilterResultSummary
              visible={visibleEntries.length}
              total={pendingEntries.length}
              onClear={() => setSelectedSeries('all')}
            />
          </div>
        ) : null}
        {loading ? <EntryTableSkeleton /> : null}
        {!loading && error ? <ErrorPanel message={error} /> : null}
        {!loading && !error && pendingEntries.length === 0 ? (
          <div className="border border-zinc-200 p-5 dark:border-zinc-800">
            <FolderCheck size={24} className="text-primary" />
            <h3 className="mt-4 text-xl font-semibold">No pending entry forms.</h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Submitted entries that need Secretary/Admin review will appear here.
            </p>
          </div>
        ) : null}
        {!loading && !error && pendingEntries.length > 0 && visibleEntries.length === 0 ? (
          <FilteredEmptyState onClear={() => setSelectedSeries('all')} />
        ) : null}
        {!loading && !error && visibleEntries.length > 0 ? (
          <PendingApprovalTable entries={visibleEntries} onReview={setSelectedEntry} />
        ) : null}
      </div>

      <AnimatePresence>
        {selectedEntry ? (
          <ApprovalReviewModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onChanged={async () => {
              setSelectedEntry(null)
              await refreshAfterAction()
            }}
          />
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function PendingApprovalTable({
  entries,
  onReview,
}: {
  entries: PendingEntryApproval[]
  onReview: (entry: PendingEntryApproval) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="overflow-hidden border border-zinc-200 dark:border-zinc-800"
    >
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Competitor</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Series / Grade</th>
              <th className="px-4 py-3 font-medium">Car No.</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-zinc-200 last:border-0 hover:bg-zinc-100/70 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-4">
                  <p className="font-medium">{entry.competitor_name}</p>
                  <p className="mt-1 text-sm text-zinc-500">{entry.competitor_email}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium">{entry.event_name}</p>
                  <p className="mt-1 font-mono text-sm text-zinc-500 tabular-nums">
                    Season {entry.season_year}
                  </p>
                </td>
                <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{entry.series_class}</td>
                <td className="px-4 py-4 font-mono tabular-nums">{entry.car_number || '--'}</td>
                <td className="px-4 py-4 font-mono text-sm text-zinc-500 tabular-nums">
                  {formatDateTime(entry.submitted_at ?? entry.created_at)}
                </td>
                <td className="px-4 py-4">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => onReview(entry)}
                    className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-800"
                  >
                    Review
                  </motion.button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-zinc-200 lg:hidden dark:divide-zinc-800">
        {entries.map((entry) => (
          <article key={entry.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{entry.competitor_name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{entry.event_name}</p>
              </div>
              <span className="font-mono text-sm tabular-nums">#{entry.car_number || '--'}</span>
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{entry.series_class}</p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => onReview(entry)}
              className="mt-4 inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-800"
            >
              Review
            </motion.button>
          </article>
        ))}
      </div>
    </motion.div>
  )
}

function ApprovalReviewModal({
  entry,
  onClose,
  onChanged,
}: {
  entry: PendingEntryApproval
  onClose: () => void
  onChanged: () => void
}) {
  const [rejectReason, setRejectReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)

  async function approveEntry() {
    setActionLoading('approve')
    setActionError(null)

    try {
      const { error } = await supabase.rpc('approve_entry_form', { p_entry_id: entry.id })
      if (error) throw error
      onChanged()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Approval failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function rejectEntry() {
    if (!rejectReason.trim()) {
      setActionError('Rejection reason is required.')
      return
    }

    setActionLoading('reject')
    setActionError(null)

    try {
      const { error } = await supabase.rpc('reject_entry_form', {
        p_entry_id: entry.id,
        p_reason: rejectReason,
      })
      if (error) throw error
      onChanged()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Rejection failed')
    } finally {
      setActionLoading(null)
    }
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
        aria-labelledby="entry-approval-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:p-5 dark:border-zinc-800">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Pending review</p>
            <h2 id="entry-approval-title" className="mt-2 text-2xl font-semibold tracking-tight">
              {entry.competitor_name}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {entry.event_name} / {entry.series_class} / Car #{entry.car_number || '--'}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
            aria-label="Close entry approval review"
          >
            <X size={20} />
          </motion.button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <SnapshotCard title="Personal Snapshot" data={entry.personal_snapshot} />
            <SnapshotCard title="Driver License" data={entry.driver_license_snapshot} />
            <SnapshotCard title="Vehicle Snapshot" data={entry.vehicle_snapshot} />
            <SnapshotCard title="Team Snapshot" data={entry.team_snapshot} />
          </div>

          <SubsectionHeader title="Uploaded Documents" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {entry.documents.map((document) => (
              <DocumentReviewLink key={`${document.documentType}-${document.fileAssetId}`} document={document} />
            ))}
            {entry.documents.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-500">No documents returned for this entry.</p>
            ) : null}
          </div>

          <div className="mt-6">
            <TextAreaField
              label="Reject reason / เหตุผลการปฏิเสธ"
              value={rejectReason}
              onChange={setRejectReason}
            />
          </div>

          {actionError ? <div className="mt-5"><ErrorPanel message={actionError} /></div> : null}
        </div>

        <footer className="flex flex-col gap-3 border-t border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-end dark:border-zinc-800">
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={rejectEntry}
            disabled={Boolean(actionLoading)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-900/70 dark:text-red-400"
          >
            {actionLoading === 'reject' ? <Loader2 size={17} className="animate-spin" /> : <X size={17} />}
            Reject
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={approveEntry}
            disabled={Boolean(actionLoading)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {actionLoading === 'approve' ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
            Approve Active & Locked
          </motion.button>
        </footer>
      </motion.section>
    </motion.div>
  )
}

function SnapshotCard({ title, data }: { title: string; data: Record<string, unknown> }) {
  const rows = Object.entries(data ?? {}).filter(([, value]) => value !== null && value !== undefined && `${value}`.trim() !== '')

  return (
    <section className="border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-4 grid gap-3 text-sm">
        {rows.map(([key, value]) => (
          <div key={key} className="grid gap-1 sm:grid-cols-[11rem_1fr]">
            <dt className="text-zinc-500">{humanizeKey(key)}</dt>
            <dd className="break-words text-zinc-800 dark:text-zinc-200">{String(value)}</dd>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-zinc-500">No data recorded.</p> : null}
      </dl>
    </section>
  )
}

function DocumentReviewLink({ document }: { document: ApprovalDocument }) {
  const publicUrl = supabase.storage.from(document.bucket || 'competitor_assets').getPublicUrl(document.path).data.publicUrl

  return (
    <a
      href={publicUrl}
      target="_blank"
      rel="noreferrer"
      className="block rounded-md border border-zinc-200 p-4 hover:bg-zinc-100/70 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{humanizeKey(document.documentType)}</p>
          <p className="mt-1 truncate text-sm text-zinc-500">{document.filename}</p>
        </div>
        {document.isRequired ? (
          <span className="rounded-sm bg-amber-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-500">
            Required
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-mono text-xs text-zinc-500 tabular-nums">
        {document.sizeBytes ? formatBytes(document.sizeBytes) : '--'} / {document.mimeType ?? 'file'}
      </p>
    </a>
  )
}

function EntryTable({
  entries,
  highlightedEntryId,
  canSoftDelete,
  deletingEntryId,
  onDelete,
}: {
  entries: EntryFormRow[]
  highlightedEntryId: string | null
  canSoftDelete: boolean
  deletingEntryId: string | null
  onDelete: (entry: EntryFormRow) => Promise<void>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="overflow-hidden border border-zinc-200 dark:border-zinc-800"
    >
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Series / Grade</th>
              <th className="px-4 py-3 font-medium">Car No.</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              {canSoftDelete ? <th className="px-4 py-3 font-medium">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-zinc-200 last:border-0 hover:bg-zinc-100/70 dark:border-zinc-800 dark:hover:bg-zinc-900 ${
                  entry.id === highlightedEntryId ? 'border-l-2 border-l-primary bg-orange-500/5' : ''
                }`}
              >
                <td className="px-4 py-4">
                  <p className="font-medium">{entry.event_name}</p>
                  <p className="mt-1 font-mono text-sm text-zinc-500 tabular-nums">
                    Season {entry.season_year}
                  </p>
                </td>
                <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{entry.series_class}</td>
                <td className="px-4 py-4 font-mono tabular-nums">{entry.car_number || '--'}</td>
                <td className="px-4 py-4">
                  <EntryStatusBadge status={entry.status} />
                </td>
                <td className="px-4 py-4 font-mono text-sm text-zinc-500 tabular-nums">
                  {formatDate(entry.created_at)}
                </td>
                {canSoftDelete ? (
                  <td className="px-4 py-4">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => onDelete(entry)}
                      disabled={deletingEntryId === entry.id}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300 px-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:text-red-400"
                    >
                      {deletingEntryId === entry.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      Delete
                    </motion.button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-zinc-200 md:hidden dark:divide-zinc-800">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={`p-4 ${entry.id === highlightedEntryId ? 'border-l-2 border-l-primary bg-orange-500/5' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{entry.event_name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{entry.series_class}</p>
              </div>
              <EntryStatusBadge status={entry.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-zinc-500">Car No.</p>
                <p className="mt-1 font-mono tabular-nums">{entry.car_number || '--'}</p>
              </div>
              <div>
                <p className="text-zinc-500">Created</p>
                <p className="mt-1 font-mono tabular-nums">{formatDate(entry.created_at)}</p>
              </div>
            </div>
            {canSoftDelete ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onDelete(entry)}
                disabled={deletingEntryId === entry.id}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300 px-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:text-red-400"
              >
                {deletingEntryId === entry.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Delete
              </motion.button>
            ) : null}
          </article>
        ))}
      </div>
    </motion.div>
  )
}

function PaperEntryOperationsPanel({ readiness }: { readiness: ReturnType<typeof getPaperEntryReadiness> }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: 0.03 }}
      className="mt-6 border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Import className="mt-1 text-primary" size={22} />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Race office intake</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Paper Entry Operations</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Prepare paper registrations here. Manual admin fill-in and Excel import require profile matching plus import-batch audit trail before they can safely create Entry Forms for another racer.
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-8 items-center rounded-md border border-amber-300 bg-amber-500/10 px-3 font-mono text-xs uppercase tracking-[0.12em] text-amber-700 dark:border-amber-900/70 dark:text-amber-400">
          Backend required
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <PaperEntryActionCard
          title="Manual Paper Fill-In"
          description="Admin or Secretary selects the racer profile, enters the paper form data, then submits as official intake with actor audit trail."
          ready={readiness.manualEntryReady}
        />
        <PaperEntryActionCard
          title="Excel Bulk Import"
          description="Upload the race-office spreadsheet, preview row validation, match profiles, resolve conflicts, then confirm a batch import."
          ready={readiness.excelImportReady}
        />
      </div>

      <p className="mt-4 border-t border-zinc-200 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Next backend step: {readiness.nextBackendStep}
      </p>
    </motion.section>
  )
}

function PaperEntryActionCard({ title, description, ready }: { title: string; description: string; ready: boolean }) {
  return (
    <article className="border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <span className={`rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-[0.12em] ${ready ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'}`}>
          {ready ? 'Ready' : 'Staged'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      <button
        type="button"
        disabled
        className="mt-4 inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-400 dark:border-zinc-800"
      >
        {ready ? 'Open' : 'Waiting for backend'}
      </button>
    </article>
  )
}

function EntryListFilterBoard({ filters, options, visible, total, onChange, onClear }: { filters: EntryListFilters; options: ReturnType<typeof getEntryListFilterOptions>; visible: number; total: number; onChange: (filters: EntryListFilters) => void; onClear: () => void }) {
  const active = hasActiveEntryListFilters(filters)

  function updateFilter(field: keyof EntryListFilters, value: string) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <div className="mb-4 border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FilterTextField label="Search" value={filters.query} placeholder="Event, class, car no..." onChange={(value) => updateFilter('query', value)} />
        <FilterSelect label="Year" value={filters.year} allLabel="All Years" options={options.years} onChange={(value) => updateFilter('year', value)} />
        <FilterSelect label="Event" value={filters.event} allLabel="All Events" options={options.events} onChange={(value) => updateFilter('event', value)} />
        <FilterSelect label="Series / Grade" value={filters.series} allLabel="All Series / Grades" options={options.series} onChange={(value) => updateFilter('series', value)} />
        <FilterSelect label="Status" value={filters.status} allLabel="All Statuses" options={options.statuses} getLabel={(status) => getEntryStatusDisplay(status as EntryStatus).label} onChange={(value) => updateFilter('status', value)} />
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Showing {visible} / {total}</p>
          {active ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Filtered view. Clear filters to return to every visible Entry Form.</p> : <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">All Entry Forms visible to your role.</p>}
        </div>
        {active ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClear}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-800"
          >
            Clear filters
          </motion.button>
        ) : null}
      </div>
    </div>
  )
}

function FilterTextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      />
    </label>
  )
}

function FilterSelect({ label, value, allLabel, options, getLabel = (option) => option, onChange }: { label: string; value: string; allLabel: string; options: string[]; getLabel?: (option: string) => string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const style = statusStyles[status]
  const display = getEntryStatusDisplay(status)
  return (
    <span title={display.description} className={`inline-flex rounded-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${style}`}>
      {display.label}
    </span>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <FilePlus2 size={26} className="text-primary" />
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">No entry forms found.</h2>
      <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
        Click Create to start. Step 1 will pull the current season, event, series, and grade options
        from Supabase.
      </p>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        <Plus size={18} />
        Create Entry Form
      </motion.button>
    </motion.div>
  )
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <FileText size={26} className="text-primary" />
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">No entries match these filters.</h2>
      <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
        Clear the filters to return to the full Entry Form list.
      </p>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onClear}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-800"
      >
        Clear filters
      </motion.button>
    </motion.div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="border border-red-200 bg-red-500/10 p-4 text-red-700 dark:border-red-900/60 dark:text-red-400">
      <div className="flex gap-3">
        <AlertCircle className="mt-1 shrink-0" size={20} />
        <div>
          <h2 className="font-semibold">Could not load entry forms</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </div>
    </div>
  )
}

function EntryTableSkeleton() {
  return (
    <div className="border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="h-5 w-40 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </div>
  )
}

function EntryFormCreator({ onClose }: { onClose: () => void }) {
  const { profile, user } = useAuth()
  const [activeStep, setActiveStep] = useState(0)
  const [options, setOptions] = useState<Step1Option[]>([])
  const [entryFormState, setEntryFormState] = useState<EntryFormState>(() =>
    createInitialEntryFormState(profile, user?.email ?? ''),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teamLoading, setTeamLoading] = useState(true)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [uploadingDocuments, setUploadingDocuments] = useState<Partial<Record<DocumentKey, boolean>>>({})
  const [documentErrors, setDocumentErrors] = useState<Partial<Record<DocumentKey, string>>>({})
  const [signatureUploading, setSignatureUploading] = useState(false)
  const [signatureError, setSignatureError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const step1 = entryFormState.step1

  useEffect(() => {
    let active = true

    async function loadOptions() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.rpc('get_entry_form_step1_options')

      if (!active) return
      if (error) {
        setOptions([])
        updateStep1(initialStep1)
        setError(error.message)
      } else {
        const nextOptions = (data ?? []) as Step1Option[]
        const defaultSeasonId = nextOptions[0]?.season_id ?? ''
        const seasonOptions = nextOptions.filter((option) => option.season_id === defaultSeasonId)

        setOptions(nextOptions)
        updateStep1({
          seasonId: defaultSeasonId,
          eventIds: uniqueValues(seasonOptions.map((option) => option.event_id)),
          seriesName: uniqueValues(seasonOptions.map((option) => option.series_name))[0] ?? '',
          gradeName: uniqueValues(seasonOptions.map((option) => option.grade_name))[0] ?? '',
          carNumber: '',
        })
      }

      setLoading(false)
    }

    loadOptions()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadTeamPrefill() {
      setTeamLoading(true)
      setTeamError(null)

      const { data, error } = await supabase.rpc('get_current_user_team_prefill')

      if (!active) return
      if (error) {
        setTeamError(error.message)
      } else {
        const team = ((data ?? []) as TeamPrefill[])[0]
        if (team) {
          setEntryFormState((current) => ({
            ...current,
            teamSnapshot: createTeamSnapshot(team),
          }))
        }
      }

      setTeamLoading(false)
    }

    loadTeamPrefill()

    return () => {
      active = false
    }
  }, [])

  const seasonOptions = useMemo(() => {
    return uniqueBy(options, (option) => option.season_id)
  }, [options])

  const scopedOptions = useMemo(() => {
    return options.filter((option) => option.season_id === step1.seasonId)
  }, [options, step1.seasonId])

  const events = useMemo(() => {
    return uniqueBy(scopedOptions, (option) => option.event_id).sort(
      (first, second) => first.event_order - second.event_order,
    )
  }, [scopedOptions])

  const seriesNames = useMemo(() => {
    return uniqueValues(scopedOptions.map((option) => option.series_name))
  }, [scopedOptions])

  const gradeNames = useMemo(() => {
    return uniqueValues(
      scopedOptions
        .filter((option) => !step1.seriesName || option.series_name === step1.seriesName)
        .map((option) => option.grade_name),
    )
  }, [scopedOptions, step1.seriesName])

  const selectedConfigs = useMemo(() => {
    return scopedOptions.filter(
      (option) =>
        step1.eventIds.includes(option.event_id) &&
        option.series_name === step1.seriesName &&
        option.grade_name === step1.gradeName,
    )
  }, [scopedOptions, step1.eventIds, step1.gradeName, step1.seriesName])

  const canProceedFromStep1 =
    step1.seasonId.length > 0 &&
    step1.eventIds.length > 0 &&
    step1.seriesName.length > 0 &&
    step1.gradeName.length > 0 &&
    step1.carNumber.trim().length > 0 &&
    selectedConfigs.length === step1.eventIds.length
  const canProceedFromStep2 = isStep2Complete(entryFormState.personalSnapshot)
  const canProceedFromStep3 = isStep3Complete(entryFormState.driverLicense, entryFormState.vehicle)
  const canProceedFromStep4 = isStep4Complete(entryFormState.documents)
  const canSubmit = isStep5Complete(entryFormState.consent)
  const canProceedFromCurrentStep =
    activeStep === 0
      ? canProceedFromStep1
      : activeStep === 1
        ? canProceedFromStep2
        : activeStep === 2
          ? canProceedFromStep3
          : activeStep === 3
            ? canProceedFromStep4
            : canSubmit

  function updateStep1(nextStep1: Step1State) {
    setEntryFormState((current) => ({ ...current, step1: nextStep1 }))
  }

  function updateStep1Field<Key extends keyof Step1State>(key: Key, value: Step1State[Key]) {
    setEntryFormState((current) => ({
      ...current,
      step1: { ...current.step1, [key]: value },
    }))
  }

  function updatePersonalField<Key extends keyof PersonalSnapshotState>(
    key: Key,
    value: PersonalSnapshotState[Key],
  ) {
    setEntryFormState((current) => ({
      ...current,
      personalSnapshot: { ...current.personalSnapshot, [key]: value },
    }))
  }

  function updateDriverLicenseField<Key extends keyof DriverLicenseState>(
    key: Key,
    value: DriverLicenseState[Key],
  ) {
    setEntryFormState((current) => ({
      ...current,
      driverLicense: { ...current.driverLicense, [key]: value },
    }))
  }

  function updateVehicleField<Key extends keyof VehicleState>(key: Key, value: VehicleState[Key]) {
    setEntryFormState((current) => ({
      ...current,
      vehicle: { ...current.vehicle, [key]: value },
    }))
  }

  function updateTeamField<Key extends keyof TeamSnapshotState>(key: Key, value: TeamSnapshotState[Key]) {
    setEntryFormState((current) => ({
      ...current,
      teamSnapshot: { ...current.teamSnapshot, [key]: value },
    }))
  }

  function updateDocumentAsset(key: DocumentKey, asset: FileAssetState | null) {
    setEntryFormState((current) => {
      const nextDocuments = { ...current.documents }
      if (asset) {
        nextDocuments[key] = asset
      } else {
        delete nextDocuments[key]
      }

      return { ...current, documents: nextDocuments }
    })
  }

  function updateConsent(nextConsent: ConsentState) {
    setEntryFormState((current) => ({ ...current, consent: nextConsent }))
  }

  async function uploadEntryAsset(file: File, folder: string) {
    if (!user?.id) {
      throw new Error('Authentication required')
    }

    const safeName = sanitizeFileName(file.name)
    const path = `${user.id}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
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

    return {
      fileAssetId: data as string,
      path,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }
  }

  async function handleDocumentUpload(key: DocumentKey, file: File) {
    setUploadingDocuments((current) => ({ ...current, [key]: true }))
    setDocumentErrors((current) => ({ ...current, [key]: undefined }))

    try {
      const asset = await uploadEntryAsset(file, `entry-documents/${key}`)
      updateDocumentAsset(key, asset)
    } catch (error) {
      setDocumentErrors((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : 'Upload failed',
      }))
    } finally {
      setUploadingDocuments((current) => ({ ...current, [key]: false }))
    }
  }

  async function handleSignatureUpload(blob: Blob) {
    setSignatureUploading(true)
    setSignatureError(null)

    try {
      const signatureFile = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' })
      const asset = await uploadEntryAsset(signatureFile, 'signatures')
      updateConsent({
        ...entryFormState.consent,
        signatureAsset: asset,
        signedAt: new Date().toISOString(),
      })
    } catch (error) {
      setSignatureError(error instanceof Error ? error.message : 'Signature upload failed')
    } finally {
      setSignatureUploading(false)
    }
  }

  async function handleSubmitBatch() {
    if (!canSubmit || submitting) return

    const confirmed = window.confirm('If submitted, you cannot edit this yourself. Confirm?')
    if (!confirmed) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const { data, error } = await supabase.rpc('submit_entry_form_batch', {
        p_payload: entryFormState,
      })

      if (error) throw error

      const submitted = ((data ?? []) as Array<{ entry_ids: string[] }>)[0]
      setSuccessMessage(`Entry form submitted for ${submitted?.entry_ids?.length ?? 0} event(s).`)
      setEntryFormState(createInitialEntryFormState(profile, user?.email ?? ''))
      setActiveStep(0)
      setTimeout(() => onClose(), 900)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  function updateSeason(seasonId: string) {
    const nextScopedOptions = options.filter((option) => option.season_id === seasonId)
    updateStep1({
      seasonId,
      eventIds: uniqueValues(nextScopedOptions.map((option) => option.event_id)),
      seriesName: uniqueValues(nextScopedOptions.map((option) => option.series_name))[0] ?? '',
      gradeName: uniqueValues(nextScopedOptions.map((option) => option.grade_name))[0] ?? '',
      carNumber: step1.carNumber,
    })
  }

  function updateSeries(seriesName: string) {
    const nextGradeName =
      uniqueValues(
        scopedOptions
          .filter((option) => option.series_name === seriesName)
          .map((option) => option.grade_name),
      )[0] ?? ''

    setEntryFormState((current) => ({
      ...current,
      step1: { ...current.step1, seriesName, gradeName: nextGradeName },
    }))
  }

  function toggleEvent(eventId: string) {
    setEntryFormState((current) => {
      const selected = current.step1.eventIds.includes(eventId)
      return {
        ...current,
        step1: {
          ...current.step1,
          eventIds: selected
            ? current.step1.eventIds.filter((currentEventId) => currentEventId !== eventId)
            : [...current.step1.eventIds, eventId],
        },
      }
    })
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
        className="mx-auto flex max-h-[calc(100svh-2rem)] max-w-5xl flex-col overflow-hidden border border-zinc-200 bg-zinc-50 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-form-creator-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:p-5 dark:border-zinc-800">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
              Progressive form
            </p>
            <h2 id="entry-form-creator-title" className="mt-2 text-2xl font-semibold tracking-tight">
              Create Entry Form
            </h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
            aria-label="Close create entry form"
          >
            <X size={20} />
          </motion.button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_1fr]">
          <aside className="border-b border-zinc-200 p-4 lg:border-r lg:border-b-0 dark:border-zinc-800">
            <ol className="grid gap-2 sm:grid-cols-5 lg:grid-cols-1">
              {steps.map((step, index) => (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 text-left text-sm font-medium ${
                      activeStep === index
                        ? 'border-primary text-zinc-950 dark:text-zinc-50'
                        : 'border-zinc-200 text-zinc-500 dark:border-zinc-800'
                    }`}
                  >
                    <span className="font-mono text-xs tabular-nums">0{index + 1}</span>
                    <span>{step}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            {activeStep === 0 ? (
              <Step1Form
                canProceed={canProceedFromStep1}
                error={error}
                events={events}
                gradeNames={gradeNames}
                loading={loading}
                selectedConfigs={selectedConfigs}
                selection={step1}
                seasonOptions={seasonOptions}
                seriesNames={seriesNames}
                onSeasonChange={updateSeason}
                onSeriesChange={updateSeries}
                onGradeChange={(gradeName) => updateStep1Field('gradeName', gradeName)}
                onCarNumberChange={(carNumber) => updateStep1Field('carNumber', carNumber)}
                onToggleEvent={toggleEvent}
              />
            ) : activeStep === 1 ? (
              <Step2PersonalForm
                personalSnapshot={entryFormState.personalSnapshot}
                onChange={updatePersonalField}
              />
            ) : activeStep === 2 ? (
              <Step3VehicleTeamForm
                driverLicense={entryFormState.driverLicense}
                vehicle={entryFormState.vehicle}
                teamSnapshot={entryFormState.teamSnapshot}
                teamLoading={teamLoading}
                teamError={teamError}
                onDriverLicenseChange={updateDriverLicenseField}
                onVehicleChange={updateVehicleField}
                onTeamChange={updateTeamField}
              />
            ) : activeStep === 3 ? (
              <Step4DocumentsForm
                documents={entryFormState.documents}
                uploadingDocuments={uploadingDocuments}
                documentErrors={documentErrors}
                onUpload={handleDocumentUpload}
                onRemove={updateDocumentAsset}
              />
            ) : activeStep === 4 ? (
              <Step5ConsentForm
                consent={entryFormState.consent}
                signatureUploading={signatureUploading}
                signatureError={signatureError}
                submitError={submitError}
                successMessage={successMessage}
                submitting={submitting}
                canSubmit={canSubmit}
                onConsentChange={updateConsent}
                onSignatureUpload={handleSignatureUpload}
                onSubmit={handleSubmitBatch}
              />
            ) : (
              <DeferredStep step={steps[activeStep]} />
            )}
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            Step {activeStep + 1} of {steps.length}: {steps[activeStep]}
          </p>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
              disabled={activeStep === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-800"
            >
              <ChevronLeft size={17} />
              Back
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => {
                if (activeStep === steps.length - 1) {
                  handleSubmitBatch()
                } else {
                  setActiveStep((current) => Math.min(steps.length - 1, current + 1))
                }
              }}
              disabled={!canProceedFromCurrentStep}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              {activeStep === steps.length - 1 ? (submitting ? 'Submitting' : 'Submit') : 'Next'}
              {submitting && activeStep === steps.length - 1 ? <Loader2 size={17} className="animate-spin" /> : <ChevronRight size={17} />}
            </motion.button>
          </div>
        </footer>
      </motion.section>
    </motion.div>
  )
}

function Step1Form({
  canProceed,
  error,
  events,
  gradeNames,
  loading,
  selectedConfigs,
  selection,
  seasonOptions,
  seriesNames,
  onCarNumberChange,
  onGradeChange,
  onSeasonChange,
  onSeriesChange,
  onToggleEvent,
}: {
  canProceed: boolean
  error: string | null
  events: Step1Option[]
  gradeNames: string[]
  loading: boolean
  selectedConfigs: Step1Option[]
  selection: Step1State
  seasonOptions: Step1Option[]
  seriesNames: string[]
  onCarNumberChange: (carNumber: string) => void
  onGradeChange: (gradeName: string) => void
  onSeasonChange: (seasonId: string) => void
  onSeriesChange: (seriesName: string) => void
  onToggleEvent: (eventId: string) => void
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-zinc-500">
          <Loader2 size={18} className="animate-spin" />
          Loading current season options
        </div>
        <div className="h-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
    )
  }

  if (error) {
    return <ErrorPanel message={error} />
  }

  if (seasonOptions.length === 0) {
    return (
      <div className="border border-zinc-200 p-5 dark:border-zinc-800">
        <CalendarDays size={24} className="text-primary" />
        <h3 className="mt-4 text-xl font-semibold">No open registration event.</h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Ask an Admin to activate a season and open registration for at least one event.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="border-l-2 border-primary pl-4">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Required</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">Event & Class Selection</h3>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Select the season, event scope, racing series, grade, and car number. All event options are
          selected by default for the active season.
        </p>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">ปีการแข่งขัน / Season</span>
          <select
            value={selection.seasonId}
            onChange={(event) => onSeasonChange(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-800"
          >
            {seasonOptions.map((option) => (
              <option key={option.season_id} value={option.season_id}>
                {option.season_name} ({option.season_year})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">หมายเลขรถ / Car Number</span>
          <input
            value={selection.carNumber}
            onChange={(event) => onCarNumberChange(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 font-mono text-base tabular-nums dark:border-zinc-800"
            placeholder="Example: 39"
            inputMode="numeric"
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">งานแข่งขัน / Event</legend>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {events.map((event) => {
            const selected = selection.eventIds.includes(event.event_id)
            return (
              <button
                key={event.event_id}
                type="button"
                onClick={() => onToggleEvent(event.event_id)}
                className={`min-h-24 rounded-md border p-4 text-left transition ${
                  selected
                    ? 'border-primary bg-zinc-100 dark:bg-zinc-900'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{event.event_name}</p>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Order {event.event_order} / {event.event_status.replaceAll('_', ' ')}
                    </p>
                  </div>
                  {selected ? <Check size={18} className="text-primary" /> : null}
                </div>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">รุ่นการแข่งขัน / Series Race</span>
          <select
            value={selection.seriesName}
            onChange={(event) => onSeriesChange(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-800"
          >
            {seriesNames.map((seriesName) => (
              <option key={seriesName} value={seriesName}>
                {seriesName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">ระดับที่ลงแข่ง / Grade Race</span>
          <select
            value={selection.gradeName}
            onChange={(event) => onGradeChange(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-800"
          >
            {gradeNames.map((gradeName) => (
              <option key={gradeName} value={gradeName}>
                {gradeName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <FileText size={20} className="mt-1 text-primary" />
          <div>
            <h4 className="font-semibold">Backend mapping preview</h4>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {selectedConfigs.length > 0
                ? `${selectedConfigs.length} event record(s) will map to ${selection.seriesName} - ${selection.gradeName}.`
                : 'Select at least one event, series, and grade to map event rule configs.'}
            </p>
          </div>
        </div>
      </div>

      {!canProceed ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
          Complete season, at least one event, series, grade, and car number before continuing.
        </p>
      ) : null}
    </div>
  )
}

function Step2PersonalForm({
  personalSnapshot,
  onChange,
}: {
  personalSnapshot: PersonalSnapshotState
  onChange: <Key extends keyof PersonalSnapshotState>(
    key: Key,
    value: PersonalSnapshotState[Key],
  ) => void
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Snapshot editable"
        title="Personal Information"
        description="Profile data is copied into this entry snapshot. Edit it here if this event needs a different document value."
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <TextField label="ชื่อ (ภาษาไทย) / Name (Thai)" value={personalSnapshot.firstNameTh} required onChange={(value) => onChange('firstNameTh', value)} />
        <TextField label="นามสกุล (ภาษาไทย) / Surname (Thai)" value={personalSnapshot.lastNameTh} required onChange={(value) => onChange('lastNameTh', value)} />
        <TextField label="ชื่อ (ภาษาอังกฤษ) / Name (English)" value={personalSnapshot.firstNameEn} required onChange={(value) => onChange('firstNameEn', value)} />
        <TextField label="นามสกุล (ภาษาอังกฤษ) / Surname (English)" value={personalSnapshot.lastNameEn} required onChange={(value) => onChange('lastNameEn', value)} />
        <TextField label="วัน/เดือน/ปีเกิด / Date of Birth" type="date" value={personalSnapshot.dateOfBirth} required onChange={(value) => onChange('dateOfBirth', value)} />
        <SelectField
          label="กรุ๊ปเลือด / Blood Type"
          value={personalSnapshot.bloodType}
          required
          options={['A', 'B', 'AB', 'O', 'A-', 'B-', 'AB-', 'O-']}
          onChange={(value) => onChange('bloodType', value)}
        />
        <TextField label="สัญชาติ / Nationality" value={personalSnapshot.nationality} required onChange={(value) => onChange('nationality', value)} />
        <TextField label="เลขที่บัตรประชาชน / พาสปอร์ต / I.D.Card No. / Passport No." value={personalSnapshot.identityNo} required onChange={(value) => onChange('identityNo', value)} />
        <TextField label="Passport No. (if separate)" value={personalSnapshot.passportNo} onChange={(value) => onChange('passportNo', value)} />
        <TextField label="รหัสไปรษณีย์ / Postcode" value={personalSnapshot.postcode} required inputMode="numeric" onChange={(value) => onChange('postcode', value)} />
        <TextField label="อีเมล / Email" type="email" value={personalSnapshot.email} required onChange={(value) => onChange('email', value)} />
        <TextField label="เบอร์โทรศัพท์ / Mobile No." type="tel" value={personalSnapshot.mobileNo} required onChange={(value) => onChange('mobileNo', value)} />
      </div>

      <div className="mt-5">
        <TextAreaField label="ที่อยู่ปัจจุบัน / Address" value={personalSnapshot.address} required onChange={(value) => onChange('address', value)} />
      </div>

      <SubsectionHeader title="Social contacts" />
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <TextField label="ไอดีไลน์ / ID Line" value={personalSnapshot.lineId} onChange={(value) => onChange('lineId', value)} />
        <TextField label="เฟซบุ๊ก / Facebook" value={personalSnapshot.facebook} onChange={(value) => onChange('facebook', value)} />
        <TextField label="อินสตาแกรม / Instagram / IG" value={personalSnapshot.instagram} onChange={(value) => onChange('instagram', value)} />
        <TextField label="ยูทูป / Youtube" value={personalSnapshot.youtube} onChange={(value) => onChange('youtube', value)} />
        <TextField label="ติ๊กต๊อก / Tiktok" value={personalSnapshot.tiktok} onChange={(value) => onChange('tiktok', value)} />
      </div>

      {!isStep2Complete(personalSnapshot) ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
          Complete the required identity, contact, and address fields before continuing.
        </p>
      ) : null}
    </div>
  )
}

function Step3VehicleTeamForm({
  driverLicense,
  vehicle,
  teamSnapshot,
  teamLoading,
  teamError,
  onDriverLicenseChange,
  onVehicleChange,
  onTeamChange,
}: {
  driverLicense: DriverLicenseState
  vehicle: VehicleState
  teamSnapshot: TeamSnapshotState
  teamLoading: boolean
  teamError: string | null
  onDriverLicenseChange: <Key extends keyof DriverLicenseState>(
    key: Key,
    value: DriverLicenseState[Key],
  ) => void
  onVehicleChange: <Key extends keyof VehicleState>(key: Key, value: VehicleState[Key]) => void
  onTeamChange: <Key extends keyof TeamSnapshotState>(key: Key, value: TeamSnapshotState[Key]) => void
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Required vehicle dossier"
        title="License, Vehicle & Team Details"
        description="These values become the technical entry snapshot for inspection, checklist, and weight-in workflows."
      />

      <SubsectionHeader title="Driver License" />
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <TextField label="เลขที่ใบอนุญาตขับแข่ง / Competition License No." value={driverLicense.licenseNo} required onChange={(value) => onDriverLicenseChange('licenseNo', value)} />
        <TextField label="ระดับตามใบอนุญาตขับแข่ง / Categorization Grade" value={driverLicense.categorizationGrade} required onChange={(value) => onDriverLicenseChange('categorizationGrade', value)} />
        <TextField label="ออกโดย / Issued By" value={driverLicense.issuedBy} required onChange={(value) => onDriverLicenseChange('issuedBy', value)} />
        <TextField label="วันออกใบอนุญาต / Date of Issued" type="date" value={driverLicense.issuedDate} required onChange={(value) => onDriverLicenseChange('issuedDate', value)} />
        <TextField label="วันหมดอายุใบอนุญาต / Expiry Date" type="date" value={driverLicense.expiryDate} required onChange={(value) => onDriverLicenseChange('expiryDate', value)} />
      </div>

      <SubsectionHeader title="Car Info" />
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <TextField label="ยี่ห้อรถ / Car Manufacturer" value={vehicle.manufacturer} required onChange={(value) => onVehicleChange('manufacturer', value)} />
        <TextField label="รุ่น / Model" value={vehicle.model} required onChange={(value) => onVehicleChange('model', value)} />
        <TextField label="สี / Color" value={vehicle.color} required onChange={(value) => onVehicleChange('color', value)} />
        <TextField label="ปี / Year" value={vehicle.year} required inputMode="numeric" onChange={(value) => onVehicleChange('year', value)} />
        <TextField label="ขนาดความจุเครื่องยนต์ / Engine Size (CC.)" value={vehicle.engineSizeCc} required inputMode="numeric" onChange={(value) => onVehicleChange('engineSizeCc', value)} />
        <TextField label="รหัสเครื่องยนต์ / Engine Code" value={vehicle.engineCode} required onChange={(value) => onVehicleChange('engineCode', value)} />
      </div>

      <SubsectionHeader title="Team Info" />
      {teamLoading ? (
        <div className="mt-3 flex items-center gap-3 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" />
          Checking accepted team relationship
        </div>
      ) : null}
      {teamError ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-500">
          Team prefill unavailable: {teamError}. You can enter team details manually.
        </p>
      ) : null}
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <TextField label="ชื่อทีมแข่ง / Team Name" value={teamSnapshot.teamName} onChange={(value) => onTeamChange('teamName', value)} />
        <TextField label="ชื่อ-สกุล ผู้จัดการทีม / Manager Name" value={teamSnapshot.managerName} onChange={(value) => onTeamChange('managerName', value)} />
        <TextField label="เบอร์โทรศัพท์มือถือผู้จัดการทีม / Manager Mobile No." type="tel" value={teamSnapshot.managerPhone} onChange={(value) => onTeamChange('managerPhone', value)} />
        <TextField label="รหัสไปรษณีย์ / Postcode" value={teamSnapshot.postcode} inputMode="numeric" onChange={(value) => onTeamChange('postcode', value)} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <TextAreaField label="ความต้องการใช้พื้นที่ pit ร่วมกับทีมใด / Require together for pit area" value={teamSnapshot.pitShareRequest} onChange={(value) => onTeamChange('pitShareRequest', value)} />
        <TextAreaField label="ที่อยู่ในการจัดส่งเอกสาร / Address for send document" value={teamSnapshot.documentAddress} onChange={(value) => onTeamChange('documentAddress', value)} />
      </div>

      {!isStep3Complete(driverLicense, vehicle) ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
          Complete all required driver license and car information fields before continuing.
        </p>
      ) : null}
    </div>
  )
}

function Step4DocumentsForm({
  documents,
  uploadingDocuments,
  documentErrors,
  onUpload,
  onRemove,
}: {
  documents: DocumentUploadsState
  uploadingDocuments: Partial<Record<DocumentKey, boolean>>
  documentErrors: Partial<Record<DocumentKey, string>>
  onUpload: (key: DocumentKey, file: File) => void
  onRemove: (key: DocumentKey, asset: null) => void
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Required uploads"
        title="Document Uploads"
        description="Files upload immediately to Supabase Storage and are recorded as file assets before final submission."
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {requiredDocuments.map((document) => {
          const asset = documents[document.key]
          const uploading = uploadingDocuments[document.key] ?? false
          const error = documentErrors[document.key]

          return (
            <div key={document.key} className="border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{document.title}</h4>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{document.description}</p>
                </div>
                {asset ? <CheckCircle2 size={19} className="shrink-0 text-emerald-600" /> : null}
              </div>

              {asset ? (
                <div className="mt-4 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <p className="truncate font-medium">{asset.filename}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-500 tabular-nums">
                    {formatBytes(asset.sizeBytes)} / {asset.mimeType}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => onRemove(document.key, null)}
                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-800"
                  >
                    <Trash2 size={16} />
                    Remove
                  </motion.button>
                </div>
              ) : (
                <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 px-4 text-center dark:border-zinc-800">
                  {uploading ? <Loader2 size={22} className="animate-spin text-primary" /> : <UploadCloud size={24} className="text-primary" />}
                  <span className="mt-2 text-sm font-medium">{uploading ? 'Uploading...' : 'Select file'}</span>
                  <span className="mt-1 text-xs text-zinc-500">PDF or image, max 10 MB</span>
                  <input
                    type="file"
                    accept={document.accept}
                    disabled={uploading}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) onUpload(document.key, file)
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
              )}

              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </div>
          )
        })}
      </div>

      {!isStep4Complete(documents) ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
          Upload all required documents before continuing.
        </p>
      ) : null}
    </div>
  )
}

function Step5ConsentForm({
  consent,
  signatureUploading,
  signatureError,
  submitError,
  successMessage,
  submitting,
  canSubmit,
  onConsentChange,
  onSignatureUpload,
  onSubmit,
}: {
  consent: ConsentState
  signatureUploading: boolean
  signatureError: string | null
  submitError: string | null
  successMessage: string | null
  submitting: boolean
  canSubmit: boolean
  onConsentChange: (consent: ConsentState) => void
  onSignatureUpload: (blob: Blob) => void
  onSubmit: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    drawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    const point = getCanvasPoint(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return

    const point = getCanvasPoint(event)
    context.lineWidth = 2.4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#18181b'
    context.lineTo(point.x, point.y)
    context.stroke()
    setHasInk(true)
  }

  function stopDrawing() {
    drawingRef.current = false
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onConsentChange({ ...consent, signatureAsset: null, signedAt: '' })
  }

  function saveSignature() {
    const canvas = canvasRef.current
    if (!canvas || !hasInk) return
    canvas.toBlob((blob) => {
      if (blob) onSignatureUpload(blob)
    }, 'image/png')
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Final consent"
        title="Legal Consent & Digital Signature"
        description="Read the consent statement, sign inside the canvas, then submit the batch for secretary review."
      />

      <div className="mt-6 max-h-80 overflow-y-auto border border-zinc-200 p-4 leading-7 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
        <p>{legalConsentThai}</p>
        <p className="mt-4">{legalConsentEnglish}</p>
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={consent.accepted}
          onChange={(event) => onConsentChange({ ...consent, accepted: event.target.checked })}
          className="mt-1 size-4 accent-[var(--primary)]"
        />
        <span>I have read and consent to the terms above.</span>
      </label>

      <div className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold">Digital Signature</h4>
            <p className="mt-1 text-sm text-zinc-500">Sign with mouse, trackpad, stylus, or touch.</p>
          </div>
          {consent.signatureAsset ? <CheckCircle2 size={20} className="text-emerald-600" /> : <PenLine size={20} className="text-primary" />}
        </div>

        <canvas
          ref={canvasRef}
          width={900}
          height={260}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          className="mt-4 h-44 w-full touch-none rounded-md border border-zinc-300 bg-zinc-50 dark:border-zinc-800"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={saveSignature}
            disabled={!hasInk || signatureUploading}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
          >
            {signatureUploading ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}
            Save Signature
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={clearSignature}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-800"
          >
            <Trash2 size={17} />
            Clear
          </motion.button>
        </div>
        {consent.signatureAsset ? (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-500">
            Signature saved at {formatDateTime(consent.signedAt)}.
          </p>
        ) : null}
        {signatureError ? <p className="mt-3 text-sm text-red-600">{signatureError}</p> : null}
      </div>

      {submitError ? <ErrorPanel message={submitError} /> : null}
      {successMessage ? (
        <div className="mt-5 border border-emerald-200 bg-emerald-500/10 p-4 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400">
          {successMessage}
        </div>
      ) : null}

      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
      >
        {submitting ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
        Submit Entry Form Batch
      </motion.button>

      {!canSubmit ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
          Accept consent and save your digital signature before submitting.
        </p>
      ) : null}
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="border-l-2 border-primary pl-4">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  )
}

function SubsectionHeader({ title }: { title: string }) {
  return <h4 className="mt-8 border-b border-zinc-200 pb-2 text-lg font-semibold dark:border-zinc-800">{title}</h4>
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  inputMode?: 'numeric' | 'tel'
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-800"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required = false,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-800"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-28 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-3 text-base dark:border-zinc-800"
      />
    </label>
  )
}

function DeferredStep({ step }: { step: string }) {
  return (
    <div className="border border-zinc-200 p-5 dark:border-zinc-800">
      <FileText size={24} className="text-primary" />
      <h3 className="mt-4 text-2xl font-semibold tracking-tight">{step}</h3>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        This step is scaffolded for the 5-step Entry Form flow. Field implementation will follow
        after Step 1 is approved.
      </p>
    </div>
  )
}

const statusStyles: Record<EntryStatus, string> = {
  draft: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-500',
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-500',
  inactive: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  rejected: 'bg-red-500/10 text-red-700 dark:text-red-500',
}

function createInitialEntryFormState(
  profile: ReturnType<typeof useAuth>['profile'],
  email: string,
): EntryFormState {
  return {
    step1: initialStep1,
    personalSnapshot: createPersonalSnapshot(profile, email),
    driverLicense: emptyDriverLicense,
    vehicle: emptyVehicle,
    teamSnapshot: emptyTeamSnapshot,
    documents: {},
    consent: emptyConsent,
  }
}

function createPersonalSnapshot(
  profile: ReturnType<typeof useAuth>['profile'],
  email: string,
): PersonalSnapshotState {
  if (!profile) return { ...emptyPersonalSnapshot, email }

  return {
    firstNameTh: profile.first_name_th ?? '',
    lastNameTh: profile.last_name_th ?? '',
    firstNameEn: profile.first_name_en ?? '',
    lastNameEn: profile.last_name_en ?? '',
    dateOfBirth: profile.date_of_birth ?? '',
    bloodType: profile.blood_type ?? '',
    nationality: profile.nationality ?? '',
    identityNo: profile.identity_no ?? '',
    passportNo: profile.passport_no ?? '',
    address: profile.address ?? '',
    postcode: profile.postcode ?? '',
    email,
    mobileNo: profile.phone ?? '',
    lineId: profile.line_id ?? '',
    facebook: profile.facebook ?? '',
    instagram: profile.instagram ?? '',
    youtube: profile.youtube ?? '',
    tiktok: profile.tiktok ?? '',
  }
}

function createTeamSnapshot(team: TeamPrefill): TeamSnapshotState {
  return {
    teamId: team.team_id,
    teamName: team.team_name ?? '',
    managerName: team.manager_name ?? '',
    managerPhone: team.manager_phone ?? '',
    pitShareRequest: team.pit_share_request ?? '',
    documentAddress: team.document_address ?? '',
    postcode: team.postcode ?? '',
  }
}

function isStep2Complete(personalSnapshot: PersonalSnapshotState) {
  return [
    personalSnapshot.firstNameTh,
    personalSnapshot.lastNameTh,
    personalSnapshot.firstNameEn,
    personalSnapshot.lastNameEn,
    personalSnapshot.dateOfBirth,
    personalSnapshot.bloodType,
    personalSnapshot.nationality,
    personalSnapshot.identityNo,
    personalSnapshot.address,
    personalSnapshot.postcode,
    personalSnapshot.email,
    personalSnapshot.mobileNo,
  ].every(hasValue)
}

function isStep3Complete(driverLicense: DriverLicenseState, vehicle: VehicleState) {
  return [
    driverLicense.licenseNo,
    driverLicense.categorizationGrade,
    driverLicense.issuedBy,
    driverLicense.issuedDate,
    driverLicense.expiryDate,
    vehicle.manufacturer,
    vehicle.model,
    vehicle.color,
    vehicle.year,
    vehicle.engineSizeCc,
    vehicle.engineCode,
  ].every(hasValue)
}

function isStep4Complete(documents: DocumentUploadsState) {
  return requiredDocuments.every((document) => Boolean(documents[document.key]?.fileAssetId))
}

function isStep5Complete(consent: ConsentState) {
  return consent.accepted && Boolean(consent.signatureAsset?.fileAssetId)
}

function hasValue(value: string) {
  return value.trim().length > 0
}

function sanitizeFileName(filename: string) {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
  return sanitized || 'upload.bin'
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(value: string) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = getKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
