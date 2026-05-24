export type EntryListStatus = 'draft' | 'pending' | 'active' | 'inactive' | 'rejected'

export type EntryListRow = {
  event_name: string
  season_year: number
  series_class: string
  car_number: string | null
  status: EntryListStatus
  created_at: string
}

export type EntryListFilters = {
  query: string
  year: string
  event: string
  series: string
  status: string
}

export function createEmptyEntryListFilters(): EntryListFilters {
  return { query: '', year: 'all', event: 'all', series: 'all', status: 'all' }
}

export function hasActiveEntryListFilters(filters: EntryListFilters) {
  return Boolean(filters.query.trim()) || filters.year !== 'all' || filters.event !== 'all' || filters.series !== 'all' || filters.status !== 'all'
}

export function getEntryListFilterOptions(entries: EntryListRow[]) {
  return {
    years: uniqueSorted(entries.map((entry) => String(entry.season_year)), (first, second) => Number(second) - Number(first)),
    events: uniqueSorted(entries.map((entry) => entry.event_name)),
    series: uniqueSorted(entries.map((entry) => entry.series_class)),
    statuses: uniqueSorted(entries.map((entry) => entry.status)),
  }
}

export function filterEntryList<T extends EntryListRow>(entries: T[], filters: EntryListFilters) {
  const query = filters.query.trim().toLowerCase()

  return entries.filter((entry) => {
    if (filters.year !== 'all' && String(entry.season_year) !== filters.year) return false
    if (filters.event !== 'all' && entry.event_name !== filters.event) return false
    if (filters.series !== 'all' && entry.series_class !== filters.series) return false
    if (filters.status !== 'all' && entry.status !== filters.status) return false
    if (!query) return true

    return [entry.event_name, entry.series_class, entry.car_number ?? '', entry.status, String(entry.season_year)].some((value) =>
      value.toLowerCase().includes(query),
    )
  })
}

export function getEntryStatusDisplay(status: EntryListStatus) {
  switch (status) {
    case 'draft':
      return { label: 'Draft', description: 'Editable before submit' }
    case 'pending':
      return { label: 'Pending', description: 'Submitted for Secretary review' }
    case 'active':
      return { label: 'Active / Locked', description: 'Approved source data' }
    case 'inactive':
      return { label: 'Inactive', description: 'Archived or withdrawn' }
    case 'rejected':
      return { label: 'Rejected', description: 'Returned by official review' }
  }
}

function uniqueSorted(values: string[], compareFn?: (first: string, second: string) => number) {
  return Array.from(new Set(values.filter(Boolean))).sort(compareFn ?? ((first, second) => first.localeCompare(second)))
}
