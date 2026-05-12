export function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }

  if (normalized.includes('rate limit')) {
    return 'Too many attempts. Please wait and try again.'
  }

  return message || 'Something went wrong. Please try again.'
}
