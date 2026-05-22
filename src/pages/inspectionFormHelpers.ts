export type InspectionInputType = 'Checkbox' | 'Dropdown' | 'Text Input' | 'Number' | 'Date' | 'File'
export type InspectionItemResultStatus = 'Unchecked' | 'Passed' | 'Failed' | 'Hold' | 'NotApplicable'
export type InspectionWeightEffectType = 'None' | 'Fix' | 'Vary'

export type InspectionOption = {
  label?: string
  value?: string
  weightKg?: number
}

export type InspectionTemplateItem = {
  itemId: string
  sectionId: string
  labelTh: string
  labelEn: string | null
  inputType: InspectionInputType
  options: Array<string | InspectionOption>
  weightEffectType: InspectionWeightEffectType
  fixedWeightKg: number | null
  isRequired: boolean
  sortOrder: number
}

export type InspectionTemplateSection = {
  sectionId: string
  title: string
  code: string
  sortOrder: number
  isFixed: boolean
  items: InspectionTemplateItem[]
}

export type InspectionAnswers = Record<string, unknown>

export type InspectionItemReview = {
  itemId: string
  resultStatus: InspectionItemResultStatus
  answerValue?: unknown
  comment?: string | null
}

export type InspectionVersionHistoryItem = {
  itemId: string
  sectionTitle: string
  labelTh: string
  labelEn: string | null
  sortOrder: number
}

export type InspectionVersionSnapshot = {
  versionNo: number
  status: string
  answers: InspectionAnswers
  itemResults: InspectionItemReview[]
  bopTotalWeightKg: number | null
  issueNote: string | null
}

export type InspectionVersionDiff = {
  itemId: string
  sectionTitle: string
  label: string
  beforeAnswer: unknown
  afterAnswer: unknown
  beforeStatus: string
  afterStatus: string
  beforeComment: string
  afterComment: string
  changed: boolean
}

export function isAnswerFilled(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return false
}

export function getMissingRequiredItems(sections: InspectionTemplateSection[], answers: InspectionAnswers) {
  return sections
    .flatMap((section) => section.items)
    .filter((item) => item.isRequired && !isAnswerFilled(answers[item.itemId]))
}

export function calculateSectionProgress(section: InspectionTemplateSection, answers: InspectionAnswers, reviews: Record<string, InspectionItemReview> = {}) {
  const total = section.items.length
  const answered = section.items.filter((item) => isAnswerFilled(answers[item.itemId])).length
  const reviewed = section.items.filter((item) => reviews[item.itemId]?.resultStatus && reviews[item.itemId]?.resultStatus !== 'Unchecked').length

  return { total, answered, reviewed }
}

export function deriveInspectionStatus(sections: InspectionTemplateSection[], reviews: Record<string, InspectionItemReview>) {
  const items = sections.flatMap((section) => section.items)
  if (items.some((item) => reviews[item.itemId]?.resultStatus === 'Failed')) return 'Failed'
  if (items.some((item) => reviews[item.itemId]?.resultStatus === 'Hold')) return 'Hold'
  if (items.length > 0 && items.every((item) => {
    const status = reviews[item.itemId]?.resultStatus
    return status === 'Passed' || status === 'NotApplicable'
  })) return 'Passed'
  return 'Pending'
}

export function calculateItemWeight(item: InspectionTemplateItem, answer: unknown) {
  let weight = 0

  if (item.weightEffectType === 'Fix' && item.fixedWeightKg !== null && isAnswerFilled(answer)) {
    weight += Number(item.fixedWeightKg)
  }

  if (item.weightEffectType === 'Vary') {
    const numeric = typeof answer === 'number' ? answer : Number(String(answer ?? '').trim())
    if (Number.isFinite(numeric) && numeric > 0) weight += numeric
  }

  const selectedValues = getSelectedValues(answer)
  for (const option of item.options ?? []) {
    if (typeof option === 'string') continue
    const optionValue = option.value ?? option.label
    if (!optionValue || !selectedValues.includes(optionValue)) continue
    const optionWeight = Number(option.weightKg ?? 0)
    if (Number.isFinite(optionWeight) && optionWeight > 0) weight += optionWeight
  }

  return weight
}

export function calculateBopWeight(sections: InspectionTemplateSection[], answers: InspectionAnswers) {
  return sections.reduce((sectionTotal, section) => {
    return sectionTotal + section.items.reduce((itemTotal, item) => itemTotal + calculateItemWeight(item, answers[item.itemId]), 0)
  }, 0)
}

export function createDefaultReviews(sections: InspectionTemplateSection[], existingReviews: InspectionItemReview[] = []) {
  const existing = Object.fromEntries(existingReviews.map((review) => [review.itemId, review]))

  return Object.fromEntries(sections.flatMap((section) => section.items).map((item) => [
    item.itemId,
    {
      itemId: item.itemId,
      resultStatus: existing[item.itemId]?.resultStatus ?? 'Unchecked',
      answerValue: existing[item.itemId]?.answerValue,
      comment: existing[item.itemId]?.comment ?? '',
    } satisfies InspectionItemReview,
  ]))
}

export function getItemLabel(item: InspectionTemplateItem) {
  return item.labelEn?.trim() || item.labelTh
}

export function createInspectionVersionDiff(
  catalog: InspectionVersionHistoryItem[],
  before: InspectionVersionSnapshot | null,
  after: InspectionVersionSnapshot | null,
) {
  if (!before || !after) return []

  const beforeResults = mapReviews(before.itemResults)
  const afterResults = mapReviews(after.itemResults)

  return catalog.map((item) => {
    const beforeResult = beforeResults[item.itemId]
    const afterResult = afterResults[item.itemId]
    const beforeAnswer = before.answers?.[item.itemId] ?? beforeResult?.answerValue ?? null
    const afterAnswer = after.answers?.[item.itemId] ?? afterResult?.answerValue ?? null
    const beforeStatus = beforeResult?.resultStatus ?? 'Unchecked'
    const afterStatus = afterResult?.resultStatus ?? 'Unchecked'
    const beforeComment = beforeResult?.comment ?? ''
    const afterComment = afterResult?.comment ?? ''

    return {
      itemId: item.itemId,
      sectionTitle: item.sectionTitle,
      label: item.labelEn?.trim() || item.labelTh,
      beforeAnswer,
      afterAnswer,
      beforeStatus,
      afterStatus,
      beforeComment,
      afterComment,
      changed:
        stableValue(beforeAnswer) !== stableValue(afterAnswer)
        || beforeStatus !== afterStatus
        || beforeComment !== afterComment,
    } satisfies InspectionVersionDiff
  })
}

export function formatInspectionValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '--'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatInspectionValue).join(', ')
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.filename === 'string') return record.filename
    if (typeof record.label === 'string') return record.label
    if (typeof record.value === 'string') return record.value
    return JSON.stringify(value)
  }
  return String(value)
}

function getSelectedValues(answer: unknown) {
  if (answer === null || answer === undefined) return []
  if (Array.isArray(answer)) return answer.map((value) => getSingleSelectedValue(value)).filter(Boolean) as string[]
  const value = getSingleSelectedValue(answer)
  return value ? [value] : []
}

function mapReviews(reviews: InspectionItemReview[] = []) {
  return Object.fromEntries(reviews.map((review) => [review.itemId, review]))
}

function stableValue(value: unknown) {
  if (value === undefined) return 'null'
  return JSON.stringify(value, Object.keys(typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}).sort())
}

function getSingleSelectedValue(answer: unknown) {
  if (typeof answer === 'object' && answer !== null) {
    const record = answer as Record<string, unknown>
    return String(record.value ?? record.label ?? '').trim() || null
  }

  return String(answer ?? '').trim() || null
}
