export type SeriesRaceFilterItem = {
  series_class: string | null
}

export function getSeriesRaceOptions<T extends SeriesRaceFilterItem>(items: T[]) {
  return Array.from(new Set(items.map((item) => item.series_class).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  )
}

export function filterBySeriesRace<T extends SeriesRaceFilterItem>(items: T[], selectedSeries: string) {
  if (selectedSeries === 'all') return items
  return items.filter((item) => item.series_class === selectedSeries)
}
