export type PasswordStrength = {
  score: number
  label: string
  tone: 'danger' | 'warning' | 'success'
  checks: {
    length: boolean
    upperLower: boolean
    number: boolean
    symbol: boolean
  }
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 12,
    upperLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
  const score = Object.values(checks).filter(Boolean).length

  if (score >= 4) {
    return { score, label: 'Strong', tone: 'success', checks }
  }

  if (score >= 2) {
    return { score, label: 'Usable', tone: 'warning', checks }
  }

  return { score, label: 'Weak', tone: 'danger', checks }
}

export function canSubmitPasswordChange(password: string, confirmPassword: string) {
  return password.length >= 8 && password === confirmPassword
}
