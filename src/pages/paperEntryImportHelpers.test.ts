import { describe, expect, it } from 'vitest'
import {
  createEmptyPaperEntryDraft,
  createPaperEntryImportPayload,
  isPaperEntryDraftStageable,
  parsePaperEntryCsvImportRows,
} from './paperEntryImportHelpers'

describe('paper entry import helpers', () => {
  it('requires a car number plus an identity signal or full name before staging', () => {
    expect(isPaperEntryDraftStageable(createEmptyPaperEntryDraft())).toBe(false)
    expect(isPaperEntryDraftStageable({ ...createEmptyPaperEntryDraft(), carNumber: '39', email: 'driver@example.com' })).toBe(true)
    expect(isPaperEntryDraftStageable({ ...createEmptyPaperEntryDraft(), carNumber: '39', firstNameTh: 'สมชาย', lastNameTh: 'ใจดี' })).toBe(true)
    expect(isPaperEntryDraftStageable({ ...createEmptyPaperEntryDraft(), email: 'driver@example.com' })).toBe(false)
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
      'Name EN,Surname EN,Email,Car No,Series Race,Grade Race',
      'Max,Driver,max@example.com,39,SIAM ECO,PRO',
      'No,Car,nocar@example.com,,SIAM ECO,AM',
    ].join('\n')

    const result = parsePaperEntryCsvImportRows(csv)

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      rawPayload: { firstNameEn: 'Max', lastNameEn: 'Driver', email: 'max@example.com', carNumber: '39' },
    })
    expect(result.errors).toEqual(['Row 3 needs car number plus identity, phone, email, or full name.'])
  })

  it('returns a clear error for empty CSV input', () => {
    expect(parsePaperEntryCsvImportRows('  ').errors).toEqual(['CSV file is empty.'])
  })
})
