export type OrganizationOption = {
  organizationId: string
  name: string
  slug: string
  isActive: boolean
}

export type CircuitOption = {
  circuitId: string
  name: string
  location: string | null
  country: string
}

export type SeasonStatus = 'Draft' | 'Active' | 'Completed' | 'Archived'
export type EventStatus = 'Draft' | 'RegistrationOpen' | 'Active' | 'Completed' | 'Cancelled'
export type BallastType = 'None' | 'SuccessBallast' | 'ChampionshipWeight'
export type RuleStatus = 'Draft' | 'Active' | 'Locked' | 'Archived'
export type InspectionInputType = 'Checkbox' | 'Dropdown' | 'Text Input' | 'Number' | 'Date' | 'File'
export type WeightEffectType = 'None' | 'Fix' | 'Vary'

export type SeasonRow = {
  seasonId: string
  organizationId: string
  name: string
  year: number
  plannedEventCount: number
  status: SeasonStatus
  isActive: boolean
  activatedAt: string | null
}

export type EventRow = {
  eventId: string
  seasonId: string
  circuitId: string | null
  circuitName: string | null
  name: string
  eventOrder: number
  startsOn: string | null
  endsOn: string | null
  status: EventStatus
}

export type RaceRow = {
  raceId: string
  eventId: string
  name: string
  raceOrder: number
  sessionType: string
  scheduledAt: string | null
  resultsImportUnlocked: boolean
}

export type SeriesRaceRow = {
  seriesRaceId: string
  organizationId: string
  code: string
  name: string
  ballastType: BallastType
  isActive: boolean
}

export type GradeRow = {
  gradeId: string
  code: string
  name: string
  sortOrder: number
}

export type SeasonSeriesRow = {
  seasonSeriesId: string
  seasonId: string
  seriesRaceId: string
  seriesName: string
  isActive: boolean
}

export type SeasonSeriesGradeRow = {
  seasonSeriesGradeId: string
  seasonSeriesId: string
  seasonId: string
  seriesRaceId: string
  gradeId: string
  gradeName: string
  isActive: boolean
}

export type EventSeriesRuleRow = {
  eventSeriesRuleId: string
  eventId: string
  eventName: string
  seasonId: string
  seriesRaceId: string
  seriesName: string
  gradeId: string
  gradeName: string
  status: RuleStatus
  version: number
  isLocked: boolean
  clonedFromId: string | null
  lockedAt: string | null
}

export type InspectionTemplateItemRow = {
  itemId: string
  sectionId: string
  labelTh: string
  labelEn: string | null
  inputType: InspectionInputType
  options: unknown[]
  weightEffectType: WeightEffectType
  fixedWeightKg: number | null
  isRequired: boolean
  sortOrder: number
}

export type InspectionTemplateSectionRow = {
  sectionId: string
  templateId: string
  code: string
  title: string
  sortOrder: number
  isFixed: boolean
  items: InspectionTemplateItemRow[]
}

export type InspectionTemplateRow = {
  templateId: string
  eventSeriesRuleId: string
  eventId: string
  eventName: string
  seriesRaceId: string
  seriesName: string
  gradeId: string
  gradeName: string
  name: string
  version: number
  isActive: boolean
  sections: InspectionTemplateSectionRow[]
}

export type BallastRuleRow = {
  ballastRuleId: string
  eventSeriesRuleId: string
  eventId: string
  eventName: string
  seriesRaceId: string
  seriesName: string
  gradeId: string
  gradeName: string
  ballastType: BallastType
  maxBallastKg: number | null
  joinWeightEnabled: boolean
  positionMatrix: Record<string, unknown>
  removalRule: Record<string, unknown>
}

export type TireRuleRow = {
  tireRuleId: string
  eventSeriesRuleId: string
  eventId: string
  eventName: string
  seriesRaceId: string
  seriesName: string
  gradeId: string
  gradeName: string
  tireBrand: string
  tireModel: string | null
  isAllowed: boolean
}

export type SponsorStickerAssetRow = {
  sponsorStickerAssetId: string
  eventSeriesRuleId: string
  eventId: string
  eventName: string
  seriesRaceId: string
  seriesName: string
  gradeId: string
  gradeName: string
  title: string
  fileAssetId: string
  bucket: string
  path: string
  filename: string
  mimeType: string
  sizeBytes: number | null
}

export type PrintBackgroundAssetRow = {
  printBackgroundAssetId: string
  eventId: string
  eventName: string
  seasonId: string
  eventOrder: number
  title: string
  orientation: 'portrait' | 'landscape'
  isDefault: boolean
  fileAssetId: string
  bucket: string
  path: string
  filename: string
  mimeType: string
  sizeBytes: number | null
}

export type WeightRuleRow = {
  weightRuleId: string
  eventSeriesRuleId: string
  eventId: string
  eventName: string
  seriesRaceId: string
  seriesName: string
  gradeId: string
  gradeName: string
  name: string
  engineMinCc: number | null
  engineMaxCc: number | null
  baseWeightKg: number
  additionalWeightRules: unknown[]
  isActive: boolean
  sortOrder: number
}

export type OrganizerPayload = {
  canManage: boolean
  organizations: OrganizationOption[]
  circuits: CircuitOption[]
  seriesRaces: SeriesRaceRow[]
  grades: GradeRow[]
  seasonSeries: SeasonSeriesRow[]
  seasonSeriesGrades: SeasonSeriesGradeRow[]
  eventSeriesRules: EventSeriesRuleRow[]
  ballastRules: BallastRuleRow[]
  tireRules: TireRuleRow[]
  sponsorStickerAssets: SponsorStickerAssetRow[]
  printBackgroundAssets: PrintBackgroundAssetRow[]
  weightRules: WeightRuleRow[]
  inspectionTemplates: InspectionTemplateRow[]
  seasons: SeasonRow[]
  events: EventRow[]
  races: RaceRow[]
}

export type ScopeFilter = {
  query: string
  needsAttentionOnly: boolean
}

export function createEmptyScopeFilter(): ScopeFilter {
  return { query: '', needsAttentionOnly: false }
}

export function hasActiveScopeFilter(filter: ScopeFilter) {
  return Boolean(filter.query.trim()) || filter.needsAttentionOnly
}

export function getScopeFilterSummary(filter: ScopeFilter) {
  const labels = []
  const query = filter.query.trim()
  if (query) labels.push(`Search: ${query}`)
  if (filter.needsAttentionOnly) labels.push('Needs attention')
  return labels.length > 0 ? labels.join(' / ') : 'Showing all settings'
}

export type OrganizerSetupStepKey = 'foundation' | 'calendar' | 'classes' | 'rules' | 'assets'

export type OrganizerSetupRequirement = {
  label: string
  ready: boolean
}

export type OrganizerSetupStep = {
  key: OrganizerSetupStepKey
  label: string
  shortLabel: string
  description: string
  primaryActionLabel: string
  editorKey: string
  complete: number
  total: number
  requirements: OrganizerSetupRequirement[]
}

export type OrganizerSetupStat = {
  label: string
  value: string
  helper: string
  tone: 'success' | 'warning' | 'neutral'
}

export type OrganizerSetupBoard = {
  completionPercent: number
  missingCount: number
  activeSeasonLabel: string
  nextStep: OrganizerSetupStep
  steps: OrganizerSetupStep[]
  stats: OrganizerSetupStat[]
}

export type RulePackageReadiness = {
  ready: boolean
  missingLabels: string[]
}

export type SeasonEventSlot = {
  slotNumber: number
  event: EventRow | null
}

export function normalizeOrganizerSettingsPayload(payload: OrganizerPayload | null): OrganizerPayload {
  return {
    canManage: Boolean(payload?.canManage),
    organizations: payload?.organizations ?? [],
    circuits: payload?.circuits ?? [],
    seriesRaces: payload?.seriesRaces ?? [],
    grades: payload?.grades ?? [],
    seasonSeries: payload?.seasonSeries ?? [],
    seasonSeriesGrades: payload?.seasonSeriesGrades ?? [],
    eventSeriesRules: payload?.eventSeriesRules ?? [],
    ballastRules: payload?.ballastRules ?? [],
    tireRules: payload?.tireRules ?? [],
    sponsorStickerAssets: payload?.sponsorStickerAssets ?? [],
    printBackgroundAssets: payload?.printBackgroundAssets ?? [],
    weightRules: payload?.weightRules ?? [],
    inspectionTemplates: payload?.inspectionTemplates ?? [],
    seasons: (payload?.seasons ?? []).map((season) => ({
      ...season,
      plannedEventCount: Math.max(Number(season.plannedEventCount) || 1, 1),
    })),
    events: payload?.events ?? [],
    races: payload?.races ?? [],
  }
}

export function filterByQuery<T>(items: T[], query: string, getValues: (item: T) => string[]) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return items
  return items.filter((item) => getValues(item).some((value) => value.toLowerCase().includes(normalizedQuery)))
}

export function createOrganizerSetupBoard(payload: OrganizerPayload): OrganizerSetupBoard {
  const activeSeason = payload.seasons.find((season) => season.isActive) ?? payload.seasons.find((season) => season.status === 'Active') ?? payload.seasons[0]
  const activeSeasonEvents = activeSeason ? payload.events.filter((event) => event.seasonId === activeSeason.seasonId) : []
  const activeEventIds = new Set(activeSeasonEvents.map((event) => event.eventId))
  const activeRuleIds = new Set(payload.eventSeriesRules.filter((rule) => activeEventIds.has(rule.eventId)).map((rule) => rule.eventSeriesRuleId))
  const activeRaces = payload.races.filter((race) => activeEventIds.has(race.eventId))
  const activePrintBackgrounds = payload.printBackgroundAssets.filter((asset) => activeEventIds.has(asset.eventId))
  const activeSponsorStickers = payload.sponsorStickerAssets.filter((asset) => activeRuleIds.has(asset.eventSeriesRuleId))
  const activeWeightRules = payload.weightRules.filter((rule) => activeRuleIds.has(rule.eventSeriesRuleId))
  const activeTemplates = payload.inspectionTemplates.filter((template) => activeRuleIds.has(template.eventSeriesRuleId))

  const steps = [
    createSetupStep({
      key: 'foundation',
      label: 'Season Foundation',
      shortLabel: 'Foundation',
      description: 'Create the racing year and reusable track list before building the calendar.',
      primaryActionLabel: payload.seasons.length === 0 ? 'Create Season' : 'Add Circuit',
      editorKey: payload.seasons.length === 0 ? 'season' : 'circuit',
      requirements: [
        { label: 'Season exists', ready: payload.seasons.length > 0 },
        { label: 'Circuit exists', ready: payload.circuits.length > 0 },
      ],
    }),
    createSetupStep({
      key: 'calendar',
      label: 'Race Calendar',
      shortLabel: 'Calendar',
      description: 'Add race weekends and sessions so Entry Forms, results, and reports have a place to attach.',
      primaryActionLabel: activeSeasonEvents.length === 0 ? 'Create Event' : 'Add Race Session',
      editorKey: activeSeasonEvents.length === 0 ? 'event' : 'race',
      requirements: [
        { label: 'Event exists', ready: activeSeasonEvents.length > 0 },
        { label: 'Race session exists', ready: activeRaces.length > 0 },
      ],
    }),
    createSetupStep({
      key: 'classes',
      label: 'Competition Classes',
      shortLabel: 'Classes',
      description: 'Define who can race: series, grades, and which class combinations are active this season.',
      primaryActionLabel: getClassActionLabel(payload),
      editorKey: getClassEditorKey(payload),
      requirements: [
        { label: 'Series exists', ready: payload.seriesRaces.length > 0 },
        { label: 'Grade exists', ready: payload.grades.length > 0 },
        { label: 'Series linked to season', ready: payload.seasonSeries.some((series) => series.isActive) },
        { label: 'Grades linked to season series', ready: payload.seasonSeriesGrades.some((grade) => grade.isActive) },
      ],
    }),
    createSetupStep({
      key: 'rules',
      label: 'Rule Packages',
      shortLabel: 'Rules',
      description: 'Package event, class, weight, tires, ballast, and inspection form rules together.',
      primaryActionLabel: activeRuleIds.size === 0 ? 'Create Rule Package' : 'Complete Technical Rules',
      editorKey: getRuleEditorKey(activeRuleIds.size, activeWeightRules.length, activeTemplates.length),
      requirements: [
        { label: 'Rule package exists', ready: activeRuleIds.size > 0 },
        { label: 'Weight rule exists', ready: activeWeightRules.length > 0 },
        { label: 'Inspection template exists', ready: activeTemplates.length > 0 },
      ],
    }),
    createSetupStep({
      key: 'assets',
      label: 'Official Assets',
      shortLabel: 'Assets',
      description: 'Upload A4 print backgrounds and sponsor stickers used in official documents.',
      primaryActionLabel: activePrintBackgrounds.length === 0 ? 'Add A4 Background' : 'Add Sponsor Sticker',
      editorKey: activePrintBackgrounds.length === 0 ? 'printBackgroundAsset' : 'sponsorStickerAsset',
      requirements: [
        { label: 'A4 background exists', ready: activePrintBackgrounds.length > 0 },
        { label: 'Sponsor sticker exists', ready: activeSponsorStickers.length > 0 },
      ],
    }),
  ]
  const complete = steps.reduce((sum, step) => sum + step.complete, 0)
  const total = steps.reduce((sum, step) => sum + step.total, 0)
  const missingCount = total - complete
  const nextStep = steps.find((step) => step.complete < step.total) ?? steps[steps.length - 1]

  return {
    completionPercent: total === 0 ? 0 : Math.round((complete / total) * 100),
    missingCount,
    activeSeasonLabel: activeSeason ? `${activeSeason.year} / ${activeSeason.name}` : 'No active season',
    nextStep,
    steps,
    stats: [
      {
        label: 'Active season',
        value: activeSeason ? String(activeSeason.year) : 'None',
        helper: activeSeason ? activeSeason.name : 'Create a season first',
        tone: activeSeason ? 'success' : 'warning',
      },
      {
        label: 'Race weekends',
        value: String(activeSeasonEvents.length),
        helper: activeSeason ? `Inside ${activeSeason.name}` : 'Waiting for season',
        tone: activeSeasonEvents.length > 0 ? 'success' : 'warning',
      },
      {
        label: 'Rule packages',
        value: String(activeRuleIds.size),
        helper: 'Event + series + grade combinations',
        tone: activeRuleIds.size > 0 ? 'success' : 'warning',
      },
      {
        label: 'Missing setup',
        value: String(missingCount),
        helper: missingCount === 0 ? 'Ready for race operations' : 'Items still need attention',
        tone: missingCount === 0 ? 'success' : 'warning',
      },
    ],
  }
}

export function getSelectedEventId(events: EventRow[], selectedEventId: string | null) {
  if (selectedEventId && events.some((event) => event.eventId === selectedEventId)) return selectedEventId
  return events[0]?.eventId ?? null
}

export function createSeasonEventSlots(season: SeasonRow, events: EventRow[]): SeasonEventSlot[] {
  const eventsByOrder = new Map(events.filter((event) => event.seasonId === season.seasonId).map((event) => [event.eventOrder, event]))
  const plannedEventCount = Math.max(Number(season.plannedEventCount) || 1, 1)
  return Array.from({ length: plannedEventCount }, (_, index) => {
    const slotNumber = index + 1
    return { slotNumber, event: eventsByOrder.get(slotNumber) ?? null }
  })
}

export function seasonNeedsAttention(season: SeasonRow, seasonSeriesBySeason: Map<string, SeasonSeriesRow[]>, seasonSeriesGradesBySeries: Map<string, SeasonSeriesGradeRow[]>) {
  const seasonSeries = (seasonSeriesBySeason.get(season.seasonId) ?? []).filter((series) => series.isActive)
  return seasonSeries.length === 0 || seasonSeries.some((series) => (seasonSeriesGradesBySeries.get(series.seasonSeriesId) ?? []).filter((grade) => grade.isActive).length === 0)
}

export function eventNeedsAttention(event: EventRow, printBackgroundAssetsByEvent: Map<string, PrintBackgroundAssetRow[]>) {
  return !event.circuitId || (printBackgroundAssetsByEvent.get(event.eventId) ?? []).length === 0
}

export function raceEventNeedsAttention(event: EventRow, racesByEvent: Map<string, RaceRow[]>) {
  return (racesByEvent.get(event.eventId) ?? []).length === 0
}

export function getRulePackageReadiness(
  rule: EventSeriesRuleRow,
  weightRulesByEventRule: Map<string, WeightRuleRow[]>,
  ballastRulesByEventRule: Map<string, BallastRuleRow[]>,
  tireRulesByEventRule: Map<string, TireRuleRow[]>,
  sponsorStickerAssetsByEventRule: Map<string, SponsorStickerAssetRow[]>,
  inspectionTemplatesByEventRule: Map<string, InspectionTemplateRow[]>,
): RulePackageReadiness {
  const missingLabels = [
    { label: 'Weight rule', ready: (weightRulesByEventRule.get(rule.eventSeriesRuleId) ?? []).length > 0 },
    { label: 'Success ballast', ready: (ballastRulesByEventRule.get(rule.eventSeriesRuleId) ?? []).length > 0 },
    { label: 'Tire rule', ready: (tireRulesByEventRule.get(rule.eventSeriesRuleId) ?? []).length > 0 },
    { label: 'Inspection form', ready: (inspectionTemplatesByEventRule.get(rule.eventSeriesRuleId) ?? []).length > 0 },
    { label: 'Sponsor sticker', ready: (sponsorStickerAssetsByEventRule.get(rule.eventSeriesRuleId) ?? []).length > 0 },
  ].filter((item) => !item.ready).map((item) => item.label)

  return {
    ready: missingLabels.length === 0,
    missingLabels,
  }
}

export function groupSeasonSeriesBySeason(seasonSeries: SeasonSeriesRow[]) {
  const map = new Map<string, SeasonSeriesRow[]>()
  seasonSeries.forEach((series) => {
    map.set(series.seasonId, [...(map.get(series.seasonId) ?? []), series])
  })
  return map
}

function createSetupStep(step: Omit<OrganizerSetupStep, 'complete' | 'total'>): OrganizerSetupStep {
  return {
    ...step,
    complete: step.requirements.filter((requirement) => requirement.ready).length,
    total: step.requirements.length,
  }
}

function getClassActionLabel(payload: OrganizerPayload) {
  if (payload.seriesRaces.length === 0) return 'Create Series'
  if (payload.grades.length === 0) return 'Create Grade'
  if (!payload.seasonSeries.some((series) => series.isActive)) return 'Link Series To Season'
  return 'Link Grades To Series'
}

function getClassEditorKey(payload: OrganizerPayload) {
  if (payload.seriesRaces.length === 0) return 'seriesRace'
  if (payload.grades.length === 0) return 'grade'
  if (!payload.seasonSeries.some((series) => series.isActive)) return 'seasonSeries'
  return 'seasonSeriesGrade'
}

function getRuleEditorKey(ruleCount: number, weightRuleCount: number, templateCount: number) {
  if (ruleCount === 0) return 'eventSeriesRule'
  if (weightRuleCount === 0) return 'weightRule'
  if (templateCount === 0) return 'inspectionTemplate'
  return 'eventSeriesRule'
}

export function groupSeasonSeriesGradesBySeries(seasonSeriesGrades: SeasonSeriesGradeRow[]) {
  const map = new Map<string, SeasonSeriesGradeRow[]>()
  seasonSeriesGrades.forEach((grade) => {
    map.set(grade.seasonSeriesId, [...(map.get(grade.seasonSeriesId) ?? []), grade])
  })
  return map
}

export function groupEventSeriesRulesByEvent(eventSeriesRules: EventSeriesRuleRow[]) {
  const map = new Map<string, EventSeriesRuleRow[]>()
  eventSeriesRules.forEach((rule) => {
    map.set(rule.eventId, [...(map.get(rule.eventId) ?? []), rule])
  })
  return map
}

export function groupInspectionTemplatesByEventRule(inspectionTemplates: InspectionTemplateRow[]) {
  const map = new Map<string, InspectionTemplateRow[]>()
  inspectionTemplates.forEach((template) => {
    map.set(template.eventSeriesRuleId, [...(map.get(template.eventSeriesRuleId) ?? []), template])
  })
  return map
}

export function groupBallastRulesByEventRule(ballastRules: BallastRuleRow[]) {
  const map = new Map<string, BallastRuleRow[]>()
  ballastRules.forEach((rule) => {
    map.set(rule.eventSeriesRuleId, [...(map.get(rule.eventSeriesRuleId) ?? []), rule])
  })
  return map
}

export function groupTireRulesByEventRule(tireRules: TireRuleRow[]) {
  const map = new Map<string, TireRuleRow[]>()
  tireRules.forEach((rule) => {
    map.set(rule.eventSeriesRuleId, [...(map.get(rule.eventSeriesRuleId) ?? []), rule])
  })
  return map
}

export function groupSponsorStickerAssetsByEventRule(sponsorStickerAssets: SponsorStickerAssetRow[]) {
  const map = new Map<string, SponsorStickerAssetRow[]>()
  sponsorStickerAssets.forEach((asset) => {
    map.set(asset.eventSeriesRuleId, [...(map.get(asset.eventSeriesRuleId) ?? []), asset])
  })
  return map
}

export function groupPrintBackgroundAssetsByEvent(printBackgroundAssets: PrintBackgroundAssetRow[]) {
  const map = new Map<string, PrintBackgroundAssetRow[]>()
  printBackgroundAssets.forEach((asset) => {
    map.set(asset.eventId, [...(map.get(asset.eventId) ?? []), asset])
  })
  return map
}

export function groupWeightRulesByEventRule(weightRules: WeightRuleRow[]) {
  const map = new Map<string, WeightRuleRow[]>()
  weightRules.forEach((rule) => {
    map.set(rule.eventSeriesRuleId, [...(map.get(rule.eventSeriesRuleId) ?? []), rule])
  })
  return map
}

export function getEligibleGradesForEventSeries(
  eventId: string,
  seriesRaceId: string,
  events: EventRow[],
  seasonSeries: SeasonSeriesRow[],
  seasonSeriesGrades: SeasonSeriesGradeRow[],
) {
  const seasonId = events.find((event) => event.eventId === eventId)?.seasonId
  if (!seasonId || !seriesRaceId) return []

  const seasonSeriesId = seasonSeries.find((series) => (
    series.seasonId === seasonId
    && series.seriesRaceId === seriesRaceId
    && series.isActive
  ))?.seasonSeriesId

  if (!seasonSeriesId) return []

  return seasonSeriesGrades.filter((grade) => grade.seasonSeriesId === seasonSeriesId && grade.isActive)
}

export function getEligibleSeriesForEvent(
  eventId: string,
  events: EventRow[],
  seasonSeries: SeasonSeriesRow[],
) {
  const seasonId = events.find((event) => event.eventId === eventId)?.seasonId
  if (!seasonId) return []

  return seasonSeries.filter((series) => series.seasonId === seasonId && series.isActive)
}
