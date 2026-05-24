import { describe, expect, it } from 'vitest'
import {
  buildAuditTrailCsv,
  getAuditActionLabel,
  getAuditEntityLabel,
  getAuditPageRange,
  normalizeAuditTrailPayload,
} from './auditTrailHelpers'

describe('audit trail helpers', () => {
  it('normalizes malformed payloads to a safe empty state', () => {
    expect(normalizeAuditTrailPayload(null)).toEqual({
      canView: false,
      total: 0,
      limit: 50,
      offset: 0,
      items: [],
    })
  })

  it('keeps valid payload values', () => {
    const payload = normalizeAuditTrailPayload({
      canView: true,
      total: 12,
      limit: 5,
      offset: 10,
      items: [{ id: 'audit-1' }],
    })

    expect(payload.canView).toBe(true)
    expect(payload.total).toBe(12)
    expect(payload.items).toHaveLength(1)
  })

  it('formats entity and action labels for display', () => {
    expect(getAuditEntityLabel('entry_form')).toBe('Entry Form')
    expect(getAuditActionLabel('password_updated')).toBe('Password Updated')
  })

  it('calculates the visible page range', () => {
    expect(getAuditPageRange(0, 50, 0)).toEqual({ from: 0, to: 0 })
    expect(getAuditPageRange(122, 50, 100)).toEqual({ from: 101, to: 122 })
  })

  it('builds escaped CSV rows for visible audit results', () => {
    const csv = buildAuditTrailCsv([
      {
        id: 'audit-1',
        entityType: 'entry_form',
        entityId: 'entity-1',
        action: 'status_changed',
        oldValues: { note: 'Before "approval"' },
        newValues: { note: 'Approved, locked' },
        previousStatus: 'Pending',
        newStatus: 'Active',
        actionById: 'profile-1',
        actorName: 'Admin User',
        createdAt: '2026-05-24T10:00:00Z',
      },
    ])

    expect(csv).toContain('Recorded At,Entity Type,Entity ID,Action,Actor,Previous Status,New Status,Old Values,New Values')
    expect(csv).toContain('"{""note"":""Before \\""approval\\""""}"')
    expect(csv).toContain('"{""note"":""Approved, locked""}"')
  })
})
