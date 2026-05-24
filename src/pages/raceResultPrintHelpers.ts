export type PrintableRaceResultEntry = {
  finish_position: number | null
  result_code: string
  points: number
  success_ballast_delta_kg: number
}

export type RaceResultPrintSummary = {
  classified: number
  nonClassified: number
  totalPoints: number
  ballastAssignedKg: number
}

export function getRaceResultPrintSummary(entries: PrintableRaceResultEntry[]): RaceResultPrintSummary {
  return entries.reduce<RaceResultPrintSummary>((summary, entry) => {
    const classified = entry.result_code === 'Classified' && entry.finish_position !== null
    return {
      classified: summary.classified + (classified ? 1 : 0),
      nonClassified: summary.nonClassified + (classified ? 0 : 1),
      totalPoints: summary.totalPoints + Number(entry.points || 0),
      ballastAssignedKg: summary.ballastAssignedKg + Number(entry.success_ballast_delta_kg || 0),
    }
  }, {
    classified: 0,
    nonClassified: 0,
    totalPoints: 0,
    ballastAssignedKg: 0,
  })
}

export function canPrintRaceResult(isOfficial: boolean, entryCount: number) {
  return isOfficial && entryCount > 0
}
