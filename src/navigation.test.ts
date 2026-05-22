import { describe, expect, it } from 'vitest'
import { canSeeRecentlyDeleteNavigation, getNavigationItems } from './navigation'

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
