import { describe, expect, it } from 'vitest'
import {
  getEligibleGradesForEventSeries,
  groupBallastRulesByEventRule,
  groupEventSeriesRulesByEvent,
  groupInspectionTemplatesByEventRule,
  groupPrintBackgroundAssetsByEvent,
  groupSeasonSeriesBySeason,
  groupSeasonSeriesGradesBySeries,
  groupSponsorStickerAssetsByEventRule,
  groupTireRulesByEventRule,
  groupWeightRulesByEventRule,
  normalizeOrganizerSettingsPayload,
} from './organizerSettingsHelpers'

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
})

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
