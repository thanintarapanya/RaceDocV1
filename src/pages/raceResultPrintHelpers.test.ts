import { describe, expect, it } from 'vitest'
import { canPrintRaceResult, getRaceResultPrintSummary } from './raceResultPrintHelpers'

describe('race result print helpers', () => {
  it('summarizes printable result entries', () => {
    const summary = getRaceResultPrintSummary([
      { finish_position: 1, result_code: 'Classified', points: 25, success_ballast_delta_kg: 30 },
      { finish_position: 2, result_code: 'Classified', points: 18, success_ballast_delta_kg: 20 },
      { finish_position: null, result_code: 'DNF', points: 0, success_ballast_delta_kg: 0 },
    ])

    expect(summary).toEqual({
      classified: 2,
      nonClassified: 1,
      totalPoints: 43,
      ballastAssignedKg: 50,
    })
  })

  it('allows print only for official results with entries', () => {
    expect(canPrintRaceResult(false, 3)).toBe(false)
    expect(canPrintRaceResult(true, 0)).toBe(false)
    expect(canPrintRaceResult(true, 3)).toBe(true)
  })
})
