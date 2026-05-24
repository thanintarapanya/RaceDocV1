import { describe, expect, it } from 'vitest'
import { createDashboardCards, defaultMetrics, getFallbackScope, normalizeDashboardSummary, type DashboardMetrics } from './dashboardHelpers'

describe('dashboard helpers', () => {
  it('maps role codes to dashboard scopes by operational priority', () => {
    expect(getFallbackScope(['ADMIN', 'COMPETITOR'])).toBe('admin')
    expect(getFallbackScope(['HEAD_SCRUTINEER'])).toBe('head_scrutineer')
    expect(getFallbackScope(['STEWARD'])).toBe('committee')
    expect(getFallbackScope(['TEAM_MANAGER'])).toBe('team_manager')
    expect(getFallbackScope(['COMPETITOR'])).toBe('competitor')
  })

  it('normalizes missing dashboard payload fields safely', () => {
    const summary = normalizeDashboardSummary({ metrics: { pendingEntryForms: 2 } }, ['SECRETARY'])

    expect(summary.scope).toBe('secretary')
    expect(summary.metrics.pendingEntryForms).toBe(2)
    expect(summary.metrics.activeEntryForms).toBe(0)
    expect(summary.alerts).toEqual([])
    expect(summary.next_actions).toEqual([])
  })

  it('creates secretary cards from race office metrics', () => {
    const cards = createDashboardCards(createMetrics({ pendingEntryForms: 4, activeEntryForms: 12, pendingRequests: 3, eligibleToRace: 8 }), 'secretary')

    expect(cards.map((card) => [card.label, card.value, card.emphasis])).toEqual([
      ['Pending Entry Forms', 4, true],
      ['Checklist Rows', 12, false],
      ['Pending Requests', 3, true],
      ['Eligible To Race', 8, false],
    ])
  })

  it('combines technical issue counts for competitor cards', () => {
    const cards = createDashboardCards(createMetrics({ inspectionHold: 1, inspectionFailed: 2, weightInFailed: 3 }), 'competitor')

    expect(cards.find((card) => card.label === 'Technical Issues')).toMatchObject({
      value: 6,
      emphasis: true,
    })
  })
})

function createMetrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return { ...defaultMetrics, ...overrides }
}
