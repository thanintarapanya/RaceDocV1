import { describe, expect, it } from 'vitest'
import { canSeeAuditTrailNavigation, canSeeRecentlyDeleteNavigation, getNavigationItems } from './navigation'

describe('account settings navigation access', () => {
  it('keeps Profile and Privacy out of the main navigation', () => {
    const adminPaths = getNavigationItems(['ADMIN']).map((item) => item.path)
    const competitorPaths = getNavigationItems(['COMPETITOR']).map((item) => item.path)

    expect(adminPaths).not.toContain('/settings/profile')
    expect(adminPaths).not.toContain('/settings/privacy')
    expect(competitorPaths).not.toContain('/settings/profile')
    expect(competitorPaths).not.toContain('/settings/privacy')
  })

  it('keeps User & Role as an elevated-role work module', () => {
    expect(getNavigationItems(['ADMIN']).some((item) => item.path === '/settings/user-roles')).toBe(true)
    expect(getNavigationItems(['SECRETARY']).some((item) => item.path === '/settings/user-roles')).toBe(true)
    expect(getNavigationItems(['COMPETITOR']).some((item) => item.path === '/settings/user-roles')).toBe(false)
  })
})

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
