import { describe, expect, it } from 'vitest'
import {
  applyPaperEntryOptionDefaults,
  createEmptyPaperEntryDraft,
  createPaperEntryImportPayload,
  getPaperEntryCommitReadiness,
  getPaperEntryImportRowSummary,
  getPaperEntryMatchTone,
  isPaperEntryDraftStageable,
  parsePaperEntryCsvImportRows,
} from './paperEntryImportHelpers'

describe('paper entry import helpers', () => {
  it('requires a car number plus an identity signal or full name before staging', () => {
    expect(isPaperEntryDraftStageable(createEmptyPaperEntryDraft())).toBe(false)
    expect(isPaperEntryDraftStageable({ ...createEmptyPaperEntryDraft(), eventName: 'Event 1', seriesName: 'SIAM ECO', gradeName: 'PRO', carNumber: '39', email: 'driver@example.com' })).toBe(true)
    expect(isPaperEntryDraftStageable({ ...createEmptyPaperEntryDraft(), eventName: 'Event 1', seriesName: 'SIAM ECO', gradeName: 'PRO', carNumber: '39', firstNameTh: 'สมชาย', lastNameTh: 'ใจดี' })).toBe(true)
    expect(isPaperEntryDraftStageable({ ...createEmptyPaperEntryDraft(), carNumber: '39', email: 'driver@example.com' })).toBe(false)
  })

  it('normalizes manual paper data into raw and structured payloads', () => {
    const payload = createPaperEntryImportPayload({
      ...createEmptyPaperEntryDraft(),
      firstNameEn: '  Max  ',
      lastNameEn: ' Driver ',
      email: ' max@example.com ',
      phone: ' 081 234 5678 ',
      carNumber: ' 39 ',
      vehicleManufacturer: ' Toyota ',
    })

    expect(payload.rawPayload.email).toBe('max@example.com')
    expect(payload.normalizedPayload).toMatchObject({
      personalSnapshot: { firstNameEn: 'Max', lastNameEn: 'Driver', email: 'max@example.com' },
      entry: { carNumber: '39' },
      vehicle: { manufacturer: 'Toyota' },
    })
  })

  it('parses CSV rows using race-office friendly column names', () => {
    const csv = [
      'Name EN,Surname EN,Email,Car No,Event,Series Race,Grade Race',
      'Max,Driver,max@example.com,39,Event 1,SIAM ECO,PRO',
      'No,Car,nocar@example.com,,Event 1,SIAM ECO,AM',
    ].join('\n')

    const result = parsePaperEntryCsvImportRows(csv)

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      rawPayload: { firstNameEn: 'Max', lastNameEn: 'Driver', email: 'max@example.com', carNumber: '39', eventName: 'Event 1' },
    })
    expect(result.errors).toEqual(['Row 3 needs event, series, grade, car number, plus identity, phone, email, or full name.'])
  })

  it('returns a clear error for empty CSV input', () => {
    expect(parsePaperEntryCsvImportRows('  ').errors).toEqual(['CSV file is empty.'])
  })

  it('summarizes staged rows for review without exposing the full payload first', () => {
    expect(getPaperEntryImportRowSummary({
      raw_payload: {
        firstNameEn: 'Max',
        lastNameEn: 'Driver',
        email: 'max@example.com',
        carNumber: '39',
        seriesName: 'SIAM ECO',
        gradeName: 'PRO',
      },
    })).toEqual({
      driverName: 'Max Driver',
      identitySignal: 'max@example.com',
      entrySignal: 'SIAM ECO / PRO',
    })
  })

  it('classifies profile match confidence for UI badges', () => {
    expect(getPaperEntryMatchTone(100)).toBe('strong')
    expect(getPaperEntryMatchTone(75)).toBe('medium')
    expect(getPaperEntryMatchTone(55)).toBe('weak')
    expect(getPaperEntryMatchTone(null)).toBe('weak')
  })

  it('requires every staged row to be matched before commit', () => {
    expect(getPaperEntryCommitReadiness([])).toEqual({
      canCommit: false,
      matchedCount: 0,
      blockingReason: 'No staged rows in this batch.',
    })

    expect(getPaperEntryCommitReadiness([
      { status: 'Matched', matched_profile_id: 'profile-1' },
      { status: 'NeedsReview', matched_profile_id: null },
    ])).toEqual({
      canCommit: false,
      matchedCount: 1,
      blockingReason: '1 row(s) still need an accepted profile match.',
    })

    expect(getPaperEntryCommitReadiness([
      { status: 'Matched', matched_profile_id: 'profile-1' },
      { status: 'Matched', matched_profile_id: 'profile-2' },
    ])).toEqual({
      canCommit: true,
      matchedCount: 2,
      blockingReason: '',
    })

    expect(getPaperEntryCommitReadiness([
      { status: 'Committed', matched_profile_id: 'profile-1' },
    ])).toEqual({
      canCommit: false,
      matchedCount: 0,
      blockingReason: 'This batch has already been committed.',
    })
  })

  it('defaults manual paper entry scope from active event options', () => {
    const options = [
      { event_name: 'Event 1 Chang', series_name: 'SIAM ECO', grade_name: 'AM' },
      { event_name: 'Event 1 Chang', series_name: 'SIAM ECO', grade_name: 'PRO' },
      { event_name: 'Event 2 Songkhla', series_name: 'ISUZU', grade_name: 'PRO' },
    ]

    expect(applyPaperEntryOptionDefaults(createEmptyPaperEntryDraft(), options)).toMatchObject({
      eventName: 'Event 1 Chang',
      seriesName: 'SIAM ECO',
      gradeName: 'AM',
    })

    expect(applyPaperEntryOptionDefaults({
      ...createEmptyPaperEntryDraft(),
      eventName: 'Event 2 Songkhla',
      seriesName: 'SIAM ECO',
      gradeName: 'AM',
    }, options)).toMatchObject({
      eventName: 'Event 2 Songkhla',
      seriesName: 'ISUZU',
      gradeName: 'PRO',
    })
  })
})
