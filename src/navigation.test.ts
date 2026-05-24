import { describe, expect, it } from 'vitest'
import { canSeeAuditTrailNavigation, canSeeRecentlyDeleteNavigation, getNavigationItems } from './navigation'

describe('recently deleted navigation access', () => {
  it('allows Admin to access the restore center', () => {
    expect(canSeeRecentlyDeleteNavigation(['ADMIN'])).toBe(true)
    expect(getNavigationItems(['ADMIN']).some((item) => item.path === '/recently-delete')).toBe(true)
  })

  it('hides the restore center from Secretary users', () => {
    expect(canSeeRecentlyDeleteNavigation(['SECRETARY'])).toBe(false)
    expect(getNavigationItems(['SECRETARY']).some((item) => item.path === '/recently-delete')).toBe(false)
  })
})

describe('audit trail navigation access', () => {
  it('allows Admin to access the audit trail', () => {
    expect(canSeeAuditTrailNavigation(['ADMIN'])).toBe(true)
    expect(getNavigationItems(['ADMIN']).some((item) => item.path === '/audit-trail')).toBe(true)
  })

  it('hides the audit trail from Secretary users', () => {
    expect(canSeeAuditTrailNavigation(['SECRETARY'])).toBe(false)
    expect(getNavigationItems(['SECRETARY']).some((item) => item.path === '/audit-trail')).toBe(false)
  })
})
