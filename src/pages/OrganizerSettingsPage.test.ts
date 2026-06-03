import { describe, expect, it } from 'vitest'
import {
  createEmptyScopeFilter,
  createOrganizerSetupBoard,
  eventNeedsAttention,
  filterByQuery,
  getScopeFilterSummary,
  getEligibleGradesForEventSeries,
  getEligibleSeriesForEvent,
  getRulePackageReadiness,
  getSelectedEventId,
  groupBallastRulesByEventRule,
  groupEventSeriesRulesByEvent,
  groupInspectionTemplatesByEventRule,
  groupPrintBackgroundAssetsByEvent,
  groupSeasonSeriesBySeason,
  groupSeasonSeriesGradesBySeries,
  groupSponsorStickerAssetsByEventRule,
  groupTireRulesByEventRule,
  groupWeightRulesByEventRule,
  hasActiveScopeFilter,
  normalizeOrganizerSettingsPayload,
  raceEventNeedsAttention,
  seasonNeedsAttention,
} from './organizerSettingsHelpers'
import type { OrganizerPayload } from './organizerSettingsHelpers'

describe('OrganizerSettingsPage helpers', () => {
  it('normalizes missing organizer arrays for safe rendering', () => {
    expect(normalizeOrganizerSettingsPayload(null)).toMatchObject({
      canManage: false,
      organizations: [],
      circuits: [],
      seriesRaces: [],
      grades: [],
      seasonSeries: [],
      seasonSeriesGrades: [],
      eventSeriesRules: [],
      ballastRules: [],
      tireRules: [],
      sponsorStickerAssets: [],
      printBackgroundAssets: [],
      weightRules: [],
      inspectionTemplates: [],
      seasons: [],
      events: [],
      races: [],
    })
  })

  it('groups season series by season', () => {
    const grouped = groupSeasonSeriesBySeason([
      { seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', seriesName: 'Siam Eco', isActive: true },
      { seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', seriesName: 'Siam Truck', isActive: true },
      { seasonSeriesId: 'ss-3', seasonId: 'season-2', seriesRaceId: 'series-1', seriesName: 'Siam Eco', isActive: false },
    ])

    expect(grouped.get('season-1')?.map((series) => series.seriesRaceId)).toEqual(['series-1', 'series-2'])
    expect(grouped.get('season-2')?.map((series) => series.seriesRaceId)).toEqual(['series-1'])
  })

  it('groups season series grades by season series link', () => {
    const grouped = groupSeasonSeriesGradesBySeries([
      { seasonSeriesGradeId: 'ssg-1', seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', gradeId: 'grade-pro', gradeName: 'PRO', isActive: true },
      { seasonSeriesGradeId: 'ssg-2', seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', gradeId: 'grade-am', gradeName: 'AM', isActive: true },
      { seasonSeriesGradeId: 'ssg-3', seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', gradeId: 'grade-pro', gradeName: 'PRO', isActive: false },
    ])

    expect(grouped.get('ss-1')?.map((grade) => grade.gradeId)).toEqual(['grade-pro', 'grade-am'])
    expect(grouped.get('ss-2')?.map((grade) => grade.gradeId)).toEqual(['grade-pro'])
  })

  it('groups event series rules by event', () => {
    const grouped = groupEventSeriesRulesByEvent([
      createEventRule('rule-1', 'event-1', 'series-1', 'grade-pro'),
      createEventRule('rule-2', 'event-1', 'series-1', 'grade-am'),
      createEventRule('rule-3', 'event-2', 'series-2', 'grade-pro'),
    ])

    expect(grouped.get('event-1')?.map((rule) => rule.eventSeriesRuleId)).toEqual(['rule-1', 'rule-2'])
    expect(grouped.get('event-2')?.map((rule) => rule.eventSeriesRuleId)).toEqual(['rule-3'])
  })

  it('groups inspection templates by event rule', () => {
    const grouped = groupInspectionTemplatesByEventRule([
      createInspectionTemplate('template-1', 'rule-1', 1),
      createInspectionTemplate('template-2', 'rule-1', 2),
      createInspectionTemplate('template-3', 'rule-2', 1),
    ])

    expect(grouped.get('rule-1')?.map((template) => template.templateId)).toEqual(['template-1', 'template-2'])
    expect(grouped.get('rule-2')?.map((template) => template.templateId)).toEqual(['template-3'])
  })

  it('groups ballast rules by event rule', () => {
    const grouped = groupBallastRulesByEventRule([
      createBallastRule('ballast-1', 'rule-1'),
      createBallastRule('ballast-2', 'rule-1'),
      createBallastRule('ballast-3', 'rule-2'),
    ])

    expect(grouped.get('rule-1')?.map((rule) => rule.ballastRuleId)).toEqual(['ballast-1', 'ballast-2'])
    expect(grouped.get('rule-2')?.map((rule) => rule.ballastRuleId)).toEqual(['ballast-3'])
  })

  it('groups tire rules by event rule', () => {
    const grouped = groupTireRulesByEventRule([
      createTireRule('tire-1', 'rule-1'),
      createTireRule('tire-2', 'rule-1'),
      createTireRule('tire-3', 'rule-2'),
    ])

    expect(grouped.get('rule-1')?.map((rule) => rule.tireRuleId)).toEqual(['tire-1', 'tire-2'])
    expect(grouped.get('rule-2')?.map((rule) => rule.tireRuleId)).toEqual(['tire-3'])
  })

  it('groups sponsor sticker assets by event rule', () => {
    const grouped = groupSponsorStickerAssetsByEventRule([
      createSponsorStickerAsset('sticker-1', 'rule-1'),
      createSponsorStickerAsset('sticker-2', 'rule-1'),
      createSponsorStickerAsset('sticker-3', 'rule-2'),
    ])

    expect(grouped.get('rule-1')?.map((asset) => asset.sponsorStickerAssetId)).toEqual(['sticker-1', 'sticker-2'])
    expect(grouped.get('rule-2')?.map((asset) => asset.sponsorStickerAssetId)).toEqual(['sticker-3'])
  })

  it('groups print background assets by event', () => {
    const grouped = groupPrintBackgroundAssetsByEvent([
      createPrintBackgroundAsset('background-1', 'event-1'),
      createPrintBackgroundAsset('background-2', 'event-1'),
      createPrintBackgroundAsset('background-3', 'event-2'),
    ])

    expect(grouped.get('event-1')?.map((asset) => asset.printBackgroundAssetId)).toEqual(['background-1', 'background-2'])
    expect(grouped.get('event-2')?.map((asset) => asset.printBackgroundAssetId)).toEqual(['background-3'])
  })

  it('groups weight rules by event rule', () => {
    const grouped = groupWeightRulesByEventRule([
      createWeightRule('weight-1', 'rule-1'),
      createWeightRule('weight-2', 'rule-1'),
      createWeightRule('weight-3', 'rule-2'),
    ])

    expect(grouped.get('rule-1')?.map((rule) => rule.weightRuleId)).toEqual(['weight-1', 'weight-2'])
    expect(grouped.get('rule-2')?.map((rule) => rule.weightRuleId)).toEqual(['weight-3'])
  })

  it('returns only active grades linked to the selected event season and series', () => {
    const eligibleGrades = getEligibleGradesForEventSeries(
      'event-1',
      'series-1',
      [{ eventId: 'event-1', seasonId: 'season-1', circuitId: null, circuitName: null, name: 'Event 1', eventOrder: 1, startsOn: null, endsOn: null, status: 'Draft' }],
      [
        { seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', seriesName: 'Siam Eco', isActive: true },
        { seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', seriesName: 'Siam Truck', isActive: true },
      ],
      [
        { seasonSeriesGradeId: 'ssg-1', seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', gradeId: 'grade-pro', gradeName: 'PRO', isActive: true },
        { seasonSeriesGradeId: 'ssg-2', seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', gradeId: 'grade-am', gradeName: 'AM', isActive: false },
        { seasonSeriesGradeId: 'ssg-3', seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', gradeId: 'grade-pro', gradeName: 'PRO', isActive: true },
      ],
    )

    expect(eligibleGrades.map((grade) => grade.gradeId)).toEqual(['grade-pro'])
  })

  it('returns only active series linked to the selected event season', () => {
    const eligibleSeries = getEligibleSeriesForEvent(
      'event-1',
      [
        { eventId: 'event-1', seasonId: 'season-1', circuitId: null, circuitName: null, name: 'Event 1', eventOrder: 1, startsOn: null, endsOn: null, status: 'Draft' },
        { eventId: 'event-2', seasonId: 'season-2', circuitId: null, circuitName: null, name: 'Event 2', eventOrder: 2, startsOn: null, endsOn: null, status: 'Draft' },
      ],
      [
        { seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', seriesName: 'Siam Eco', isActive: true },
        { seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', seriesName: 'Siam Truck', isActive: false },
        { seasonSeriesId: 'ss-3', seasonId: 'season-2', seriesRaceId: 'series-3', seriesName: 'Siam GT', isActive: true },
      ],
    )

    expect(eligibleSeries.map((series) => series.seriesRaceId)).toEqual(['series-1'])
  })

  it('creates setup board guidance for a new empty organizer setup', () => {
    const board = createOrganizerSetupBoard(createOrganizerPayload())

    expect(board.completionPercent).toBe(0)
    expect(board.nextStep.key).toBe('foundation')
    expect(board.nextStep.primaryActionLabel).toBe('Create Season')
    expect(board.stats.find((stat) => stat.label === 'Missing setup')?.value).toBe('13')
  })

  it('prioritizes missing rule package setup for an active season', () => {
    const payload = createOrganizerPayload({
      seasons: [{ seasonId: 'season-1', organizationId: 'org-1', name: '2026 Season', year: 2026, status: 'Active', isActive: true, activatedAt: '2026-01-01' }],
      circuits: [{ circuitId: 'circuit-1', name: 'Chang International Circuit', location: 'Buriram', country: 'Thailand' }],
      events: [{ eventId: 'event-1', seasonId: 'season-1', circuitId: 'circuit-1', circuitName: 'Chang International Circuit', name: 'Event 1', eventOrder: 1, startsOn: null, endsOn: null, status: 'Draft' }],
      races: [{ raceId: 'race-1', eventId: 'event-1', name: 'Race 1', raceOrder: 1, sessionType: 'Race', scheduledAt: null, resultsImportUnlocked: false }],
      seriesRaces: [{ seriesRaceId: 'series-1', organizationId: 'org-1', code: 'SIAM', name: 'Siam Series', ballastType: 'SuccessBallast', isActive: true }],
      grades: [{ gradeId: 'grade-pro', code: 'PRO', name: 'Professional', sortOrder: 1 }],
      seasonSeries: [{ seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', seriesName: 'Siam Series', isActive: true }],
      seasonSeriesGrades: [{ seasonSeriesGradeId: 'ssg-1', seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', gradeId: 'grade-pro', gradeName: 'PRO', isActive: true }],
    })

    const board = createOrganizerSetupBoard(payload)

    expect(board.nextStep.key).toBe('rules')
    expect(board.nextStep.primaryActionLabel).toBe('Create Rule Package')
    expect(board.steps.find((step) => step.key === 'classes')).toMatchObject({ complete: 4, total: 4 })
  })

  it('selects the requested event or falls back to the first event', () => {
    const events = [
      { eventId: 'event-1', seasonId: 'season-1', circuitId: null, circuitName: null, name: 'Event 1', eventOrder: 1, startsOn: null, endsOn: null, status: 'Draft' as const },
      { eventId: 'event-2', seasonId: 'season-1', circuitId: null, circuitName: null, name: 'Event 2', eventOrder: 2, startsOn: null, endsOn: null, status: 'Draft' as const },
    ]

    expect(getSelectedEventId(events, 'event-2')).toBe('event-2')
    expect(getSelectedEventId(events, 'missing-event')).toBe('event-1')
    expect(getSelectedEventId([], 'event-2')).toBeNull()
  })

  it('filters organizer scope rows by normalized query values', () => {
    const rows = [
      { name: 'Chang International Circuit', country: 'Thailand' },
      { name: 'Sepang International Circuit', country: 'Malaysia' },
    ]

    expect(filterByQuery(rows, ' chang ', (row) => [row.name, row.country]).map((row) => row.name)).toEqual(['Chang International Circuit'])
    expect(filterByQuery(rows, 'MALAYSIA', (row) => [row.name, row.country]).map((row) => row.name)).toEqual(['Sepang International Circuit'])
    expect(filterByQuery(rows, '', (row) => [row.name])).toBe(rows)
  })

  it('summarizes active scope filters for the toolbar', () => {
    expect(createEmptyScopeFilter()).toEqual({ query: '', needsAttentionOnly: false })
    expect(hasActiveScopeFilter(createEmptyScopeFilter())).toBe(false)
    expect(getScopeFilterSummary(createEmptyScopeFilter())).toBe('Showing all settings')

    const queryFilter = { query: '  Event 1  ', needsAttentionOnly: false }
    expect(hasActiveScopeFilter(queryFilter)).toBe(true)
    expect(getScopeFilterSummary(queryFilter)).toBe('Search: Event 1')

    const combinedFilter = { query: 'Series', needsAttentionOnly: true }
    expect(hasActiveScopeFilter(combinedFilter)).toBe(true)
    expect(getScopeFilterSummary(combinedFilter)).toBe('Search: Series / Needs attention')
  })

  it('flags seasons missing series or grade links as attention items', () => {
    const completeSeason = { seasonId: 'season-1', organizationId: 'org-1', name: '2026 Season', year: 2026, status: 'Active' as const, isActive: true, activatedAt: '2026-01-01' }
    const missingGradeSeason = { ...completeSeason, seasonId: 'season-2', name: '2027 Season', year: 2027 }
    const emptySeason = { ...completeSeason, seasonId: 'season-3', name: '2028 Season', year: 2028 }
    const seriesBySeason = groupSeasonSeriesBySeason([
      { seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', seriesName: 'Siam Series', isActive: true },
      { seasonSeriesId: 'ss-2', seasonId: 'season-2', seriesRaceId: 'series-1', seriesName: 'Siam Series', isActive: true },
    ])
    const gradesBySeries = groupSeasonSeriesGradesBySeries([
      { seasonSeriesGradeId: 'ssg-1', seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', gradeId: 'grade-pro', gradeName: 'PRO', isActive: true },
    ])

    expect(seasonNeedsAttention(completeSeason, seriesBySeason, gradesBySeries)).toBe(false)
    expect(seasonNeedsAttention(missingGradeSeason, seriesBySeason, gradesBySeries)).toBe(true)
    expect(seasonNeedsAttention(emptySeason, seriesBySeason, gradesBySeries)).toBe(true)
  })

  it('ignores inactive season series and grade links when checking season readiness', () => {
    const season = { seasonId: 'season-1', organizationId: 'org-1', name: '2026 Season', year: 2026, status: 'Active' as const, isActive: true, activatedAt: '2026-01-01' }
    const inactiveSeriesOnly = groupSeasonSeriesBySeason([
      { seasonSeriesId: 'ss-1', seasonId: 'season-1', seriesRaceId: 'series-1', seriesName: 'Siam Series', isActive: false },
    ])
    const activeSeries = groupSeasonSeriesBySeason([
      { seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', seriesName: 'Truck Series', isActive: true },
    ])
    const inactiveGradeOnly = groupSeasonSeriesGradesBySeries([
      { seasonSeriesGradeId: 'ssg-1', seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', gradeId: 'grade-pro', gradeName: 'PRO', isActive: false },
    ])
    const activeGrade = groupSeasonSeriesGradesBySeries([
      { seasonSeriesGradeId: 'ssg-2', seasonSeriesId: 'ss-2', seasonId: 'season-1', seriesRaceId: 'series-2', gradeId: 'grade-am', gradeName: 'AM', isActive: true },
    ])

    expect(seasonNeedsAttention(season, inactiveSeriesOnly, groupSeasonSeriesGradesBySeries([]))).toBe(true)
    expect(seasonNeedsAttention(season, activeSeries, inactiveGradeOnly)).toBe(true)
    expect(seasonNeedsAttention(season, activeSeries, activeGrade)).toBe(false)
  })

  it('flags events missing a circuit or A4 background as attention items', () => {
    const eventWithCircuit = { eventId: 'event-1', seasonId: 'season-1', circuitId: 'circuit-1', circuitName: 'Chang International Circuit', name: 'Event 1', eventOrder: 1, startsOn: null, endsOn: null, status: 'Draft' as const }
    const eventWithoutCircuit = { ...eventWithCircuit, eventId: 'event-2', circuitId: null, circuitName: null, name: 'Event 2', eventOrder: 2 }
    const backgroundsByEvent = groupPrintBackgroundAssetsByEvent([createPrintBackgroundAsset('background-1', 'event-1')])

    expect(eventNeedsAttention(eventWithCircuit, backgroundsByEvent)).toBe(false)
    expect(eventNeedsAttention(eventWithoutCircuit, backgroundsByEvent)).toBe(true)
    expect(eventNeedsAttention({ ...eventWithCircuit, eventId: 'event-3' }, backgroundsByEvent)).toBe(true)
  })

  it('flags events with no race sessions as race attention items', () => {
    const events = [
      { eventId: 'event-1', seasonId: 'season-1', circuitId: null, circuitName: null, name: 'Event 1', eventOrder: 1, startsOn: null, endsOn: null, status: 'Draft' as const },
      { eventId: 'event-2', seasonId: 'season-1', circuitId: null, circuitName: null, name: 'Event 2', eventOrder: 2, startsOn: null, endsOn: null, status: 'Draft' as const },
    ]
    const racesByEvent = new Map([
      ['event-1', [{ raceId: 'race-1', eventId: 'event-1', name: 'Race 1', raceOrder: 1, sessionType: 'Race', scheduledAt: null, resultsImportUnlocked: false }]],
    ])

    expect(raceEventNeedsAttention(events[0], racesByEvent)).toBe(false)
    expect(raceEventNeedsAttention(events[1], racesByEvent)).toBe(true)
  })

  it('reports missing rule package setup items', () => {
    const rule = createEventRule('rule-1', 'event-1', 'series-1', 'grade-pro')
    const readiness = getRulePackageReadiness(
      rule,
      groupWeightRulesByEventRule([createWeightRule('weight-1', 'rule-1')]),
      groupBallastRulesByEventRule([]),
      groupTireRulesByEventRule([createTireRule('tire-1', 'rule-1')]),
      groupSponsorStickerAssetsByEventRule([]),
      groupInspectionTemplatesByEventRule([createInspectionTemplate('template-1', 'rule-1', 1)]),
    )

    expect(readiness.ready).toBe(false)
    expect(readiness.missingLabels).toEqual(['Success ballast', 'Sponsor sticker'])
  })
})

function createOrganizerPayload(overrides: Partial<OrganizerPayload> = {}): OrganizerPayload {
  return {
    canManage: true,
    organizations: [{ organizationId: 'org-1', name: 'RaceDoc Organizer', slug: 'racedoc', isActive: true }],
    circuits: [],
    seriesRaces: [],
    grades: [],
    seasonSeries: [],
    seasonSeriesGrades: [],
    eventSeriesRules: [],
    ballastRules: [],
    tireRules: [],
    sponsorStickerAssets: [],
    printBackgroundAssets: [],
    weightRules: [],
    inspectionTemplates: [],
    seasons: [],
    events: [],
    races: [],
    ...overrides,
  }
}

function createEventRule(eventSeriesRuleId: string, eventId: string, seriesRaceId: string, gradeId: string) {
  return {
    eventSeriesRuleId,
    eventId,
    eventName: eventId,
    seasonId: 'season-1',
    seriesRaceId,
    seriesName: seriesRaceId,
    gradeId,
    gradeName: gradeId,
    status: 'Draft' as const,
    version: 1,
    isLocked: false,
    clonedFromId: null,
    lockedAt: null,
  }
}

function createInspectionTemplate(templateId: string, eventSeriesRuleId: string, version: number) {
  return {
    templateId,
    eventSeriesRuleId,
    eventId: 'event-1',
    eventName: 'Event 1',
    seriesRaceId: 'series-1',
    seriesName: 'Siam Eco',
    gradeId: 'grade-pro',
    gradeName: 'PRO',
    name: `Template ${version}`,
    version,
    isActive: version === 1,
    sections: [],
  }
}

function createBallastRule(ballastRuleId: string, eventSeriesRuleId: string) {
  return {
    ballastRuleId,
    eventSeriesRuleId,
    eventId: 'event-1',
    eventName: 'Event 1',
    seriesRaceId: 'series-1',
    seriesName: 'Siam Eco',
    gradeId: 'grade-pro',
    gradeName: 'PRO',
    ballastType: 'SuccessBallast' as const,
    maxBallastKg: 80,
    joinWeightEnabled: false,
    positionMatrix: { '1': 30 },
    removalRule: {},
  }
}

function createTireRule(tireRuleId: string, eventSeriesRuleId: string) {
  return {
    tireRuleId,
    eventSeriesRuleId,
    eventId: 'event-1',
    eventName: 'Event 1',
    seriesRaceId: 'series-1',
    seriesName: 'Siam Eco',
    gradeId: 'grade-pro',
    gradeName: 'PRO',
    tireBrand: 'Yokohama',
    tireModel: 'A050',
    isAllowed: true,
  }
}

function createSponsorStickerAsset(sponsorStickerAssetId: string, eventSeriesRuleId: string) {
  return {
    sponsorStickerAssetId,
    eventSeriesRuleId,
    eventId: 'event-1',
    eventName: 'Event 1',
    seriesRaceId: 'series-1',
    seriesName: 'Siam Eco',
    gradeId: 'grade-pro',
    gradeName: 'PRO',
    title: 'Door sponsor sticker',
    fileAssetId: `file-${sponsorStickerAssetId}`,
    bucket: 'organizer_assets',
    path: `sponsor-stickers/rule-1/${sponsorStickerAssetId}.png`,
    filename: `${sponsorStickerAssetId}.png`,
    mimeType: 'image/png',
    sizeBytes: 1024,
  }
}

function createPrintBackgroundAsset(printBackgroundAssetId: string, eventId: string) {
  return {
    printBackgroundAssetId,
    eventId,
    eventName: eventId,
    seasonId: 'season-1',
    eventOrder: 1,
    title: 'A4 official background',
    orientation: 'portrait' as const,
    isDefault: printBackgroundAssetId === 'background-1',
    fileAssetId: `file-${printBackgroundAssetId}`,
    bucket: 'organizer_assets',
    path: `print-backgrounds/${eventId}/${printBackgroundAssetId}.pdf`,
    filename: `${printBackgroundAssetId}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 4096,
  }
}

function createWeightRule(weightRuleId: string, eventSeriesRuleId: string) {
  return {
    weightRuleId,
    eventSeriesRuleId,
    eventId: 'event-1',
    eventName: 'Event 1',
    seriesRaceId: 'series-1',
    seriesName: 'Siam Eco',
    gradeId: 'grade-pro',
    gradeName: 'PRO',
    name: '1,500 cc baseline',
    engineMinCc: 0,
    engineMaxCc: 1500,
    baseWeightKg: 950,
    additionalWeightRules: [{ code: 'turbo', weightKg: 30 }],
    isActive: true,
    sortOrder: 10,
  }
}
