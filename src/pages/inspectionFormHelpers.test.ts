import { describe, expect, it } from 'vitest'
import {
  calculateBopWeight,
  calculateSectionProgress,
  createInspectionVersionDiff,
  deriveInspectionStatus,
  formatInspectionValue,
  getMissingRequiredItems,
  type InspectionTemplateSection,
} from './inspectionFormHelpers'

const sections: InspectionTemplateSection[] = [
  {
    sectionId: 'weight',
    title: 'Weight',
    code: 'weight',
    sortOrder: 10,
    isFixed: false,
    items: [
      {
        itemId: 'base-weight',
        sectionId: 'weight',
        labelTh: 'Base weight',
        labelEn: 'Base weight',
        inputType: 'Number',
        options: [],
        weightEffectType: 'Vary',
        fixedWeightKg: null,
        isRequired: true,
        sortOrder: 10,
      },
      {
        itemId: 'option-weight',
        sectionId: 'weight',
        labelTh: 'Option',
        labelEn: 'Option',
        inputType: 'Dropdown',
        options: [
          { label: 'Sequential Gear', value: 'sequential', weightKg: 30 },
          { label: '4WD', value: '4wd', weightKg: 50 },
        ],
        weightEffectType: 'None',
        fixedWeightKg: null,
        isRequired: false,
        sortOrder: 20,
      },
    ],
  },
]

describe('inspection form helpers', () => {
  it('detects required dynamic answers', () => {
    expect(getMissingRequiredItems(sections, {}).map((item) => item.itemId)).toEqual(['base-weight'])
    expect(getMissingRequiredItems(sections, { 'base-weight': 950 })).toEqual([])
  })

  it('calculates section answer and review progress', () => {
    expect(calculateSectionProgress(sections[0], { 'base-weight': 950 }, {
      'base-weight': { itemId: 'base-weight', resultStatus: 'Passed' },
    })).toEqual({ total: 2, answered: 1, reviewed: 1 })
  })

  it('derives status from official item review rows', () => {
    expect(deriveInspectionStatus(sections, {
      'base-weight': { itemId: 'base-weight', resultStatus: 'Passed' },
      'option-weight': { itemId: 'option-weight', resultStatus: 'Passed' },
    })).toBe('Passed')
    expect(deriveInspectionStatus(sections, {
      'base-weight': { itemId: 'base-weight', resultStatus: 'Hold' },
      'option-weight': { itemId: 'option-weight', resultStatus: 'Passed' },
    })).toBe('Hold')
    expect(deriveInspectionStatus(sections, {
      'base-weight': { itemId: 'base-weight', resultStatus: 'Failed' },
      'option-weight': { itemId: 'option-weight', resultStatus: 'Hold' },
    })).toBe('Failed')
  })

  it('calculates BOP from vary values and structured weighted options', () => {
    expect(calculateBopWeight(sections, {
      'base-weight': 950,
      'option-weight': 'sequential',
    })).toBe(980)
  })

  it('creates dynamic version diffs across answers and official review status', () => {
    const diff = createInspectionVersionDiff([
      { itemId: 'base-weight', sectionTitle: 'Weight', labelTh: 'Base weight', labelEn: 'Base weight', sortOrder: 10 },
      { itemId: 'option-weight', sectionTitle: 'Weight', labelTh: 'Option', labelEn: 'Option', sortOrder: 20 },
    ], {
      versionNo: 1,
      status: 'Pending',
      answers: { 'base-weight': 900, 'option-weight': 'sequential' },
      itemResults: [],
      bopTotalWeightKg: null,
      issueNote: null,
    }, {
      versionNo: 2,
      status: 'Failed',
      answers: { 'base-weight': 950, 'option-weight': 'sequential' },
      itemResults: [{ itemId: 'base-weight', resultStatus: 'Failed', comment: 'Scale mismatch' }],
      bopTotalWeightKg: 980,
      issueNote: 'Base weight corrected',
    })

    expect(diff.filter((item) => item.changed).map((item) => item.itemId)).toEqual(['base-weight'])
  })

  it('formats inspection values for readable comparison', () => {
    expect(formatInspectionValue(['sequential', '4wd'])).toBe('sequential, 4wd')
    expect(formatInspectionValue({ filename: 'inspection-photo.jpg' })).toBe('inspection-photo.jpg')
    expect(formatInspectionValue(null)).toBe('--')
  })
})
