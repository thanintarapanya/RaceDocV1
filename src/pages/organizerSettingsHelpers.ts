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
    seasons: payload?.seasons ?? [],
    events: payload?.events ?? [],
    races: payload?.races ?? [],
  }
}

export function groupSeasonSeriesBySeason(seasonSeries: SeasonSeriesRow[]) {
  const map = new Map<string, SeasonSeriesRow[]>()
  seasonSeries.forEach((series) => {
    map.set(series.seasonId, [...(map.get(series.seasonId) ?? []), series])
  })
  return map
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
