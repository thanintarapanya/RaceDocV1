import { describe, expect, it } from 'vitest'
import { createEmptyEntryListFilters, filterEntryList, getEntryListFilterOptions, getEntryStatusDisplay, hasActiveEntryListFilters, type EntryListRow } from './entryFormListHelpers'

const entries: EntryListRow[] = [
  { event_name: 'Event 1 Chang', season_year: 2026, series_class: 'Siam Series / PRO', car_number: '39', status: 'active', created_at: '2026-01-01' },
  { event_name: 'Event 2 Bangsaen', season_year: 2026, series_class: 'Siam Series / AM', car_number: '88', status: 'pending', created_at: '2026-01-02' },
  { event_name: 'Event 3 Songkhla', season_year: 2025, series_class: 'Isuzu Challenge / PRO', car_number: null, status: 'draft', created_at: '2026-01-03' },
]

describe('Entry Form list helpers', () => {
  it('creates and detects empty filters', () => {
    expect(createEmptyEntryListFilters()).toEqual({ query: '', year: 'all', event: 'all', series: 'all', status: 'all' })
    expect(hasActiveEntryListFilters(createEmptyEntryListFilters())).toBe(false)
    expect(hasActiveEntryListFilters({ ...createEmptyEntryListFilters(), query: ' 39 ' })).toBe(true)
    expect(hasActiveEntryListFilters({ ...createEmptyEntryListFilters(), status: 'pending' })).toBe(true)
  })

  it('builds stable filter options from visible entry data', () => {
    expect(getEntryListFilterOptions(entries)).toEqual({
      years: ['2026', '2025'],
      events: ['Event 1 Chang', 'Event 2 Bangsaen', 'Event 3 Songkhla'],
      series: ['Isuzu Challenge / PRO', 'Siam Series / AM', 'Siam Series / PRO'],
      statuses: ['active', 'draft', 'pending'],
    })
  })

  it('filters by year, event, series, status, and query', () => {
    expect(filterEntryList(entries, { ...createEmptyEntryListFilters(), year: '2026' })).toHaveLength(2)
    expect(filterEntryList(entries, { ...createEmptyEntryListFilters(), event: 'Event 2 Bangsaen' })).toEqual([entries[1]])
    expect(filterEntryList(entries, { ...createEmptyEntryListFilters(), series: 'Isuzu Challenge / PRO' })).toEqual([entries[2]])
    expect(filterEntryList(entries, { ...createEmptyEntryListFilters(), status: 'active' })).toEqual([entries[0]])
    expect(filterEntryList(entries, { ...createEmptyEntryListFilters(), query: 'songkhla' })).toEqual([entries[2]])
    expect(filterEntryList(entries, { ...createEmptyEntryListFilters(), query: '88', status: 'pending' })).toEqual([entries[1]])
  })

  it('explains operational status meaning', () => {
    expect(getEntryStatusDisplay('active')).toEqual({ label: 'Active / Locked', description: 'Approved source data' })
    expect(getEntryStatusDisplay('pending').description).toContain('Secretary')
  })
})
