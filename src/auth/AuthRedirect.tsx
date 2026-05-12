import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'

export function AuthRedirect() {
  const { user, profile, roles, loading } = useAuth()

  if (loading) {
    return <LoadingScreen label="Checking session" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles.includes('ADMIN') || roles.includes('SECRETARY')) {
    return <Navigate to="/dashboard" replace />
  }

  if (!profile || profile.onboarding_status === 'ProfileRequired') {
    return <Navigate to="/onboarding" replace />
  }

  if (profile.onboarding_status === 'TeamRequired') {
    return <Navigate to="/onboarding/team" replace />
  }

  return <Navigate to="/dashboard" replace />
}
