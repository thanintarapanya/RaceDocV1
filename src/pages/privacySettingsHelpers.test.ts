import { describe, expect, it } from 'vitest'
import { canSubmitPasswordChange, getPasswordStrength } from './privacySettingsHelpers'

describe('privacy settings password helpers', () => {
  it('classifies strong passwords with all checks', () => {
    const strength = getPasswordStrength('RaceDoc#2026Secure')

    expect(strength.label).toBe('Strong')
    expect(strength.score).toBe(4)
    expect(strength.checks).toEqual({
      length: true,
      upperLower: true,
      number: true,
      symbol: true,
    })
  })

  it('requires a matching password of at least eight characters', () => {
    expect(canSubmitPasswordChange('short', 'short')).toBe(false)
    expect(canSubmitPasswordChange('longenough', 'different')).toBe(false)
    expect(canSubmitPasswordChange('longenough', 'longenough')).toBe(true)
  })
})
