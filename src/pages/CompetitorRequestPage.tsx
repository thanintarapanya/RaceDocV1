import { motion } from 'framer-motion'
import { CheckCircle2, FilePlus2, FileText, Loader2, Plus, RefreshCcw, Scale, Send, UserCheck, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import {
  FilterResultSummary,
  SeriesRaceFilter,
} from '@/components/SeriesRaceFilter'
import { filterBySeriesRace, getSeriesRaceOptions } from '@/lib/series-race-filter'
import { canSeeAdminNavigation } from '@/navigation'
import { supabase } from '@/lib/supabase'

type EntryOption = {
  entry_id: string
  event_name: string
  season_year: number
  series_class: string
  car_number: string
  competitor_name: string
  vehicle_summary: string | null
}

type CompetitorRequest = {
  request_id: string
  entry_id: string
  race_id: string | null
  event_name: string
  season_year: number
  series_class: string
  car_number: string
  competitor_name: string
  competitor_email: string
  queue_no: string
  topic: string
  request_topics: RequestTopicSelection[]
  status: 'Draft' | 'Need Racer Approval' | 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Cancelled'
  racer_consent_status: string
  fine_amount: number | null
  penalty_weight_kg: number | null
  grid_penalty: string | null
  request_payload: { description?: string; requestedChange?: unknown; topics?: RequestTopicSelection[] } | null
  final_comment: string | null
  created_at: string
  updated_at: string
  approvals: RequestApproval[]
  can_racer_consent: boolean
  can_final_decide: boolean
  can_assign_reviewers: boolean
}

type RequestTopicOption = {
  code: string
  thai_label: string
  english_label: string
  display_label: string
  requires_other_detail: boolean
  sort_order: number
}

type RequestTopicSelection = {
  code: string
  label: string
  thaiLabel: string
  englishLabel: string | null
  otherText: string | null
}

type RequestApproval = {
  approvalId: string
  approverProfileId: string
  approverRoleCode: string
  approverName: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Skipped'
  comment: string | null
  decidedAt: string | null
  canDecideApproval: boolean
}

type ReviewerOption = {
  profile_id: string
  role_code: string
  role_name: string
  display_name: string
  email: string
}

type FinalDecisionDraft = {
  comment: string
  fineAmount: string
  penaltyWeightKg: string
  gridPenalty: string
}

type ReviewDraft = {
  approve: boolean
  comment: string
}

export function CompetitorRequestPage() {
  const { roles } = useAuth()
  const canFinalize = canSeeAdminNavigation(roles)
  const [entries, setEntries] = useState<EntryOption[]>([])
  const [requests, setRequests] = useState<CompetitorRequest[]>([])
  const [topicOptions, setTopicOptions] = useState<RequestTopicOption[]>([])
  const [reviewerOptions, setReviewerOptions] = useState<ReviewerOption[]>([])
  const [selectedSeries, setSelectedSeries] = useState('all')
  const [selectedRequestTopicFilter, setSelectedRequestTopicFilter] = useState('all')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [selectedTopicCode, setSelectedTopicCode] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<RequestTopicSelection[]>([])
  const [otherTopicText, setOtherTopicText] = useState('')
  const [description, setDescription] = useState('')
  const [requestedChange, setRequestedChange] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null)
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, FinalDecisionDraft>>({})
  const [reviewerDrafts, setReviewerDrafts] = useState<Record<string, string>>({})
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadData = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const [entryResult, requestResult, reviewerResult, topicResult] = await Promise.all([
      supabase.rpc('get_competitor_request_entry_options'),
      supabase.rpc('get_competitor_requests'),
      supabase.rpc('get_competitor_request_reviewer_options'),
      supabase.rpc('get_competitor_request_topic_options'),
    ])

    if (!isActive()) return
    if (entryResult.error) {
      setEntries([])
      setError(entryResult.error.message)
    } else if (requestResult.error) {
      setRequests([])
      setError(requestResult.error.message)
    } else if (reviewerResult.error) {
      setReviewerOptions([])
      setError(reviewerResult.error.message)
    } else if (topicResult.error) {
      setTopicOptions([])
      setError(topicResult.error.message)
    } else {
      const nextEntries = (entryResult.data ?? []) as EntryOption[]
      const nextRequests = ((requestResult.data ?? []) as CompetitorRequest[]).map((request) => ({
        ...request,
        approvals: request.approvals ?? [],
        request_topics: normalizeRequestTopics(request),
      }))
      const nextReviewerOptions = (reviewerResult.data ?? []) as ReviewerOption[]
      const nextTopicOptions = (topicResult.data ?? []) as RequestTopicOption[]
      setEntries(nextEntries)
      setReviewerOptions(nextReviewerOptions)
      setTopicOptions(nextTopicOptions)
      setSelectedTopicCode((current) => current || nextTopicOptions[0]?.code || '')
      setSelectedEntryId((current) => current || nextEntries[0]?.entry_id || '')
      setRequests(nextRequests)
      setDecisionDrafts(Object.fromEntries(nextRequests.map((request) => [request.request_id, createDecisionDraft(request)])))
      setReviewDrafts(createReviewDrafts(nextRequests))
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

  const totals = useMemo(() => calculateTotals(requests), [requests])
  const seriesOptions = useMemo(() => getSeriesRaceOptions(requests), [requests])
  const filteredBySeries = useMemo(() => filterBySeriesRace(requests, selectedSeries), [requests, selectedSeries])
  const visibleRequests = useMemo(
    () => filterByRequestTopic(filteredBySeries, selectedRequestTopicFilter),
    [filteredBySeries, selectedRequestTopicFilter],
  )

  function addTopicSelection(topicCode: string) {
    const option = topicOptions.find((current) => current.code === topicCode)
    if (!option || selectedTopics.some((current) => current.code === topicCode)) return

    const nextTopic = createTopicSelection(option, option.code === 'OTHER' ? otherTopicText : '')
    setSelectedTopics((current) => [...current, nextTopic])
  }

  function removeTopicSelection(topicCode: string) {
    setSelectedTopics((current) => current.filter((topic) => topic.code !== topicCode))
    if (topicCode === 'OTHER') setOtherTopicText('')
  }

  function updateOtherTopicText(value: string) {
    setOtherTopicText(value)
    setSelectedTopics((current) => current.map((topic) => (
      topic.code === 'OTHER' ? { ...topic, otherText: value } : topic
    )))
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotice(null)

    if (selectedTopics.length === 0) {
      setError('Select at least one request topic.')
      setSubmitting(false)
      return
    }

    const requestedChangePayload = requestedChange.trim()
      ? { text: requestedChange.trim() }
      : {}
    const { error } = await supabase.rpc('create_competitor_request', {
      p_entry_id: selectedEntryId,
      p_topic: getTopicSummary(selectedTopics),
      p_description: description.trim(),
      p_race_id: null,
      p_requested_change: requestedChangePayload,
      p_request_topics: selectedTopics.map((topic) => ({ code: topic.code, otherText: topic.otherText })),
    })

    if (error) {
      setError(error.message)
    } else {
      setSelectedTopics([])
      setOtherTopicText('')
      setDescription('')
      setRequestedChange('')
      setNotice('Competitor Request created.')
      await loadData()
    }

    setSubmitting(false)
  }

  async function respondConsent(request: CompetitorRequest, accept: boolean) {
    setActiveRequestId(request.request_id)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('respond_competitor_request_consent', {
      p_request_id: request.request_id,
      p_accept: accept,
      p_comment: accept ? 'Racer approved request.' : 'Racer rejected request.',
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(accept ? 'Request approved by racer.' : 'Request rejected by racer.')
      await loadData()
    }

    setActiveRequestId(null)
  }

  async function finalizeRequest(request: CompetitorRequest, approve: boolean) {
    const draft = decisionDrafts[request.request_id] ?? createDecisionDraft(request)
    setActiveRequestId(request.request_id)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('finalize_competitor_request', {
      p_request_id: request.request_id,
      p_approve: approve,
      p_comment: draft.comment.trim(),
      p_fine_amount: draft.fineAmount.trim() ? Number(draft.fineAmount) : null,
      p_penalty_weight_kg: draft.penaltyWeightKg.trim() ? Number(draft.penaltyWeightKg) : null,
      p_grid_penalty: draft.gridPenalty.trim() || null,
      p_race_id: null,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(approve ? 'Request approved and finalized.' : 'Request rejected and finalized.')
      await loadData()
    }

    setActiveRequestId(null)
  }

  async function assignReviewers(request: CompetitorRequest) {
    const selectedKey = reviewerDrafts[request.request_id]
    const selected = reviewerOptions.find((reviewer) => getReviewerKey(reviewer) === selectedKey)
    if (!selected) {
      setError('Select an official reviewer first.')
      return
    }

    setActiveRequestId(request.request_id)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('assign_competitor_request_reviewers', {
      p_request_id: request.request_id,
      p_reviewers: [{ profileId: selected.profile_id, roleCode: selected.role_code }],
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('Request sent to official reviewer.')
      await loadData()
    }

    setActiveRequestId(null)
  }

  async function submitReview(approval: RequestApproval) {
    const draft = reviewDrafts[approval.approvalId] ?? createReviewDraft(null)
    setActiveApprovalId(approval.approvalId)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('submit_competitor_request_review', {
      p_approval_id: approval.approvalId,
      p_approve: draft.approve,
      p_comment: draft.comment.trim(),
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('Review recommendation submitted.')
      await loadData()
    }

    setActiveApprovalId(null)
  }

  function updateDecisionDraft(requestId: string, changes: Partial<FinalDecisionDraft>) {
    setDecisionDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] ?? createDecisionDraft(null)),
        ...changes,
      },
    }))
  }

  function updateReviewDraft(approvalId: string, changes: Partial<ReviewDraft>) {
    setReviewDrafts((current) => ({
      ...current,
      [approvalId]: {
        ...(current[approvalId] ?? createReviewDraft(null)),
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Request control</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Competitor Request</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Submit race document requests against Active Entry Forms. Team Manager submissions require racer consent before Secretary review.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadData()}
          disabled={loading || submitting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Total" value={requests.length} />
        <SummaryCard label="Needs Racer" value={totals.needRacer} />
        <SummaryCard label="Pending" value={totals.pending} />
        <SummaryCard label="Approved" value={totals.approved} />
      </div>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="border border-zinc-200 p-5 dark:border-zinc-800"
          onSubmit={createRequest}
        >
          <div className="flex items-start gap-3">
            <FilePlus2 className="mt-1 text-primary" size={20} />
            <div>
              <h2 className="text-xl font-semibold">Create Request</h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Select only from Active Entry Forms you are allowed to manage.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Active Entry</span>
              <select
                value={selectedEntryId}
                onChange={(event) => setSelectedEntryId(event.target.value)}
                required
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
              >
                {entries.map((entry) => (
                  <option key={entry.entry_id} value={entry.entry_id}>
                    #{entry.car_number} / {entry.event_name} / {entry.series_class}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Request topic</span>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selectedTopicCode}
                    onChange={(event) => setSelectedTopicCode(event.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {topicOptions.map((option) => (
                      <option key={option.code} value={option.code}>{option.display_label}</option>
                    ))}
                  </select>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => addTopicSelection(selectedTopicCode)}
                    disabled={!selectedTopicCode || selectedTopics.some((current) => current.code === selectedTopicCode)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
                  >
                    <Plus size={16} />
                    Add Topic
                  </motion.button>
                </div>
              </label>
              {selectedTopics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedTopics.map((selectedTopic) => (
                    <span key={selectedTopic.code} className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold dark:border-zinc-800">
                      {selectedTopic.label}
                      <button type="button" onClick={() => removeTopicSelection(selectedTopic.code)} aria-label={`Remove ${selectedTopic.label}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {selectedTopics.some((selectedTopic) => selectedTopic.code === 'OTHER') ? (
                <TextField label="Other topic detail" value={otherTopicText} onChange={updateOtherTopicText} placeholder="ระบุหัวข้อคำร้อง / Specify request topic" />
              ) : null}
            </div>
            <label className="block">
              <span className="text-sm font-medium">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                required
                className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Requested change</span>
              <textarea
                value={requestedChange}
                onChange={(event) => setRequestedChange(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Optional details to overwrite later after approval"
              />
            </label>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || submitting || entries.length === 0}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting ? <Loader2 className="animate-spin" size={17} /> : <FilePlus2 size={17} />}
              Submit Request
            </motion.button>
          </div>
        </motion.form>

        <div>
          {!loading && requests.length > 0 ? (
            <div className="mb-4 grid gap-3 border border-zinc-200 p-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,20rem)_1fr] lg:items-end dark:border-zinc-800">
              <SeriesRaceFilter value={selectedSeries} options={seriesOptions} onChange={setSelectedSeries} />
              <RequestTopicFilter value={selectedRequestTopicFilter} options={topicOptions} onChange={setSelectedRequestTopicFilter} />
              <FilterResultSummary visible={visibleRequests.length} total={requests.length} onClear={() => {
                setSelectedSeries('all')
                setSelectedRequestTopicFilter('all')
              }} />
            </div>
          ) : null}
          {loading ? <RequestSkeleton /> : null}
          {!loading && requests.length === 0 ? <RequestEmpty /> : null}
          {!loading && requests.length > 0 && visibleRequests.length === 0 ? (
            <RequestFilteredEmpty onClear={() => {
              setSelectedSeries('all')
              setSelectedRequestTopicFilter('all')
            }} />
          ) : null}
          {!loading && visibleRequests.length > 0 ? (
            <div className="space-y-4">
              {visibleRequests.map((request, index) => (
                <RequestRow
                  key={request.request_id}
                  request={request}
                  index={index}
                  canFinalize={canFinalize}
                  reviewers={reviewerOptions}
                  selectedReviewerKey={reviewerDrafts[request.request_id] ?? ''}
                  active={activeRequestId === request.request_id}
                  activeApprovalId={activeApprovalId}
                  draft={decisionDrafts[request.request_id] ?? createDecisionDraft(request)}
                  reviewDrafts={reviewDrafts}
                  onConsent={respondConsent}
                  onFinalize={finalizeRequest}
                  onAssignReviewer={assignReviewers}
                  onDraftChange={updateDecisionDraft}
                  onReviewerChange={(value) => setReviewerDrafts((current) => ({ ...current, [request.request_id]: value }))}
                  onReviewDraftChange={updateReviewDraft}
                  onSubmitReview={submitReview}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </section>
  )
}

function RequestRow({
  request,
  index,
  canFinalize,
  reviewers,
  selectedReviewerKey,
  active,
  activeApprovalId,
  draft,
  reviewDrafts,
  onConsent,
  onFinalize,
  onAssignReviewer,
  onDraftChange,
  onReviewerChange,
  onReviewDraftChange,
  onSubmitReview,
}: {
  request: CompetitorRequest
  index: number
  canFinalize: boolean
  reviewers: ReviewerOption[]
  selectedReviewerKey: string
  active: boolean
  activeApprovalId: string | null
  draft: FinalDecisionDraft
  reviewDrafts: Record<string, ReviewDraft>
  onConsent: (request: CompetitorRequest, accept: boolean) => Promise<void>
  onFinalize: (request: CompetitorRequest, approve: boolean) => Promise<void>
  onAssignReviewer: (request: CompetitorRequest) => Promise<void>
  onDraftChange: (requestId: string, changes: Partial<FinalDecisionDraft>) => void
  onReviewerChange: (value: string) => void
  onReviewDraftChange: (approvalId: string, changes: Partial<ReviewDraft>) => void
  onSubmitReview: (approval: RequestApproval) => Promise<void>
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, delay: index * 0.02 }}
      className={`border p-4 ${getStatusSurface(request.status)}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
            Queue {request.queue_no} / {request.event_name} / {request.series_class}
          </p>
          <h2 className="mt-2 text-xl font-semibold">#{request.car_number} / {request.topic}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {request.competitor_name} / updated {formatDateTime(request.updated_at)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <TopicChips topics={request.request_topics} />

      <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {request.request_payload?.description ?? 'No description provided.'}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoCell label="Racer consent" value={request.racer_consent_status} />
        <InfoCell label="Penalty weight" value={request.penalty_weight_kg ? `${request.penalty_weight_kg} kg` : '--'} />
        <InfoCell label="Fine" value={request.fine_amount ? `${request.fine_amount.toLocaleString('en-GB')} THB` : '--'} />
      </div>

      {request.can_racer_consent ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <SmallAction label="Approve Consent" disabled={active} onClick={() => onConsent(request, true)} primary />
          <SmallAction label="Reject" disabled={active} onClick={() => onConsent(request, false)} />
        </div>
      ) : null}

      {request.can_assign_reviewers ? (
        <div className="mt-5 border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-semibold">Request Review</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Ask Steward, President, Clerk, or Head Scrutineer to recommend before final decision.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="text-sm font-medium">Official reviewer</span>
              <select
                value={selectedReviewerKey}
                onChange={(event) => onReviewerChange(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">Select reviewer</option>
                {reviewers.map((reviewer) => (
                  <option key={getReviewerKey(reviewer)} value={getReviewerKey(reviewer)}>
                    {reviewer.display_name} / {reviewer.role_name}
                  </option>
                ))}
              </select>
            </label>
            <SmallAction label="Send Review" disabled={active || !selectedReviewerKey} onClick={() => onAssignReviewer(request)} primary icon={<Send size={15} />} />
          </div>
          {reviewers.length === 0 ? (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              No eligible official reviewer account exists yet. Add roles in User & Role first.
            </p>
          ) : null}
        </div>
      ) : null}

      {request.approvals.length > 0 ? (
        <div className="mt-5 border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-semibold">Official Recommendations</p>
          <div className="mt-3 grid gap-3">
            {request.approvals.map((approval) => (
              <ApprovalRow
                key={approval.approvalId}
                approval={approval}
                active={activeApprovalId === approval.approvalId}
                draft={reviewDrafts[approval.approvalId] ?? createReviewDraft(approval)}
                onDraftChange={onReviewDraftChange}
                onSubmit={onSubmitReview}
              />
            ))}
          </div>
        </div>
      ) : null}

      {canFinalize && request.can_final_decide ? (
        <div className="mt-5 border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-semibold">Secretary Final Decision</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <TextField label="Fine amount" value={draft.fineAmount} onChange={(value) => onDraftChange(request.request_id, { fineAmount: value })} inputMode="decimal" />
            <TextField label="Penalty kg" value={draft.penaltyWeightKg} onChange={(value) => onDraftChange(request.request_id, { penaltyWeightKg: value })} inputMode="decimal" />
            <TextField label="Grid penalty" value={draft.gridPenalty} onChange={(value) => onDraftChange(request.request_id, { gridPenalty: value })} required={false} />
            <label className="block sm:col-span-3">
              <span className="text-sm font-medium">Final comment</span>
              <textarea
                value={draft.comment}
                onChange={(event) => onDraftChange(request.request_id, { comment: event.target.value })}
                rows={3}
                className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                required
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SmallAction label="Final Approve" disabled={active} onClick={() => onFinalize(request, true)} primary icon={<CheckCircle2 size={15} />} />
            <SmallAction label="Final Reject" disabled={active} onClick={() => onFinalize(request, false)} icon={<XCircle size={15} />} />
          </div>
          <p className="mt-3 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Scale className="mt-0.5 shrink-0" size={15} />
            Approved penalty weight is synced to Weight-In target calculations.
          </p>
        </div>
      ) : null}
    </motion.article>
  )
}

function ApprovalRow({
  approval,
  active,
  draft,
  onDraftChange,
  onSubmit,
}: {
  approval: RequestApproval
  active: boolean
  draft: ReviewDraft
  onDraftChange: (approvalId: string, changes: Partial<ReviewDraft>) => void
  onSubmit: (approval: RequestApproval) => Promise<void>
}) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">{approval.approverName}</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">{approval.approverRoleCode}</p>
        </div>
        <RecommendationBadge status={approval.status} />
      </div>
      {approval.comment ? (
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{approval.comment}</p>
      ) : null}
      {approval.canDecideApproval ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-sm font-medium">Recommendation</span>
            <select
              value={draft.approve ? 'approve' : 'reject'}
              onChange={(event) => onDraftChange(approval.approvalId, { approve: event.target.value === 'approve' })}
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="approve">Recommend Approve</option>
              <option value="reject">Recommend Reject</option>
            </select>
          </label>
          <TextField label="Reviewer comment" value={draft.comment} onChange={(value) => onDraftChange(approval.approvalId, { comment: value })} />
          <SmallAction label="Submit" disabled={active || !draft.comment.trim()} onClick={() => onSubmit(approval)} primary icon={<UserCheck size={15} />} />
        </div>
      ) : null}
      {approval.decidedAt ? <p className="mt-2 font-mono text-xs text-zinc-500 tabular-nums">{formatDateTime(approval.decidedAt)}</p> : null}
    </div>
  )
}

function TopicChips({ topics }: { topics: RequestTopicSelection[] }) {
  if (topics.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {topics.map((topic) => (
        <span key={`${topic.code}:${topic.otherText ?? ''}`} className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold dark:border-zinc-800">
          {formatTopicLabel(topic)}
        </span>
      ))}
    </div>
  )
}

function RequestTopicFilter({
  value,
  options,
  onChange,
}: {
  value: string
  options: RequestTopicOption[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Request Topic</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="all">All topics</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>{option.display_label}</option>
        ))}
      </select>
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'decimal'
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        required={required}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      />
    </label>
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

function SmallAction({
  label,
  disabled,
  onClick,
  primary = false,
  icon,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  primary?: boolean
  icon?: ReactNode
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        primary
          ? 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
          : 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800'
      }
    >
      {icon}
      {label}
    </motion.button>
  )
}

function StatusBadge({ status }: { status: CompetitorRequest['status'] }) {
  return (
    <span className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${getStatusBadgeClass(status)}`}>
      <FileText size={15} />
      {status}
    </span>
  )
}

function RecommendationBadge({ status }: { status: RequestApproval['status'] }) {
  return (
    <span className={`inline-flex min-h-8 items-center rounded-md border px-2 text-xs font-semibold ${getRecommendationBadgeClass(status)}`}>
      {status}
    </span>
  )
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className =
    tone === 'success'
      ? 'mt-5 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
      : 'mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400'
  return <div className={className}>{message}</div>
}

function RequestSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function RequestEmpty() {
  return (
    <div className="border border-zinc-200 p-8 dark:border-zinc-800">
      <FileText className="text-zinc-500" size={24} />
      <h2 className="mt-4 text-xl font-semibold">No Competitor Requests yet.</h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Create a request from an Active Entry Form to start the approval workflow.
      </p>
    </div>
  )
}

function RequestFilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="border border-zinc-200 p-6 dark:border-zinc-800">
      <p className="font-medium">No requests match this Series Race filter.</p>
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

function createDecisionDraft(request: CompetitorRequest | null): FinalDecisionDraft {
  return {
    comment: request?.final_comment ?? '',
    fineAmount: request?.fine_amount ? String(request.fine_amount) : '',
    penaltyWeightKg: request?.penalty_weight_kg ? String(request.penalty_weight_kg) : '',
    gridPenalty: request?.grid_penalty ?? '',
  }
}

function createReviewDraft(approval: RequestApproval | null): ReviewDraft {
  return {
    approve: approval?.status !== 'Rejected',
    comment: approval?.comment ?? '',
  }
}

function createReviewDrafts(requests: CompetitorRequest[]) {
  return Object.fromEntries(
    requests.flatMap((request) => request.approvals.map((approval) => [approval.approvalId, createReviewDraft(approval)])),
  )
}

function createTopicSelection(option: RequestTopicOption, otherText = ''): RequestTopicSelection {
  return {
    code: option.code,
    label: option.display_label,
    thaiLabel: option.thai_label,
    englishLabel: option.english_label,
    otherText: option.requires_other_detail ? otherText : null,
  }
}

function normalizeRequestTopics(request: CompetitorRequest): RequestTopicSelection[] {
  if (Array.isArray(request.request_topics) && request.request_topics.length > 0) return request.request_topics
  if (Array.isArray(request.request_payload?.topics) && request.request_payload.topics.length > 0) return request.request_payload.topics as RequestTopicSelection[]
  return request.topic
    ? [{ code: 'LEGACY', label: request.topic, thaiLabel: request.topic, englishLabel: null, otherText: null }]
    : []
}

function getTopicSummary(topics: RequestTopicSelection[]) {
  return topics.map(formatTopicLabel).join(', ')
}

function formatTopicLabel(topic: RequestTopicSelection) {
  const label = topic.label || [topic.thaiLabel, topic.englishLabel].filter(Boolean).join(' / ')
  return topic.otherText ? `${label}: ${topic.otherText}` : label
}

function getReviewerKey(reviewer: ReviewerOption) {
  return `${reviewer.profile_id}:${reviewer.role_code}`
}

function calculateTotals(requests: CompetitorRequest[]) {
  return {
    needRacer: requests.filter((request) => request.status === 'Need Racer Approval').length,
    pending: requests.filter((request) => request.status === 'Pending' || request.status === 'In Review').length,
    approved: requests.filter((request) => request.status === 'Approved').length,
  }
}

function filterByRequestTopic(requests: CompetitorRequest[], selectedTopicCode: string) {
  if (selectedTopicCode === 'all') return requests
  return requests.filter((request) => request.request_topics.some((topic) => topic.code === selectedTopicCode))
}

function getStatusSurface(status: CompetitorRequest['status']) {
  if (status === 'Approved') return 'border-emerald-200 bg-emerald-500/5 dark:border-emerald-900/60'
  if (status === 'Rejected' || status === 'Cancelled') return 'border-red-200 bg-red-500/5 dark:border-red-900/60'
  if (status === 'Need Racer Approval') return 'border-amber-200 bg-amber-500/5 dark:border-amber-900/60'
  return 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950'
}

function getStatusBadgeClass(status: CompetitorRequest['status']) {
  if (status === 'Approved') return 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
  if (status === 'Rejected' || status === 'Cancelled') return 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-400'
  if (status === 'Need Racer Approval') return 'border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-900/60 dark:text-amber-400'
  return 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'
}

function getRecommendationBadgeClass(status: RequestApproval['status']) {
  if (status === 'Approved') return 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
  if (status === 'Rejected') return 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-400'
  if (status === 'Skipped') return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
  return 'border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-900/60 dark:text-amber-400'
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
