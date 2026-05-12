import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, roles, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen label="Loading protected area" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles.includes('ADMIN') || roles.includes('SECRETARY')) {
    return children
  }

  if (!profile || profile.onboarding_status === 'ProfileRequired') {
    return <Navigate to="/onboarding" replace />
  }

  if (profile.onboarding_status === 'TeamRequired') {
    return <Navigate to="/onboarding/team" replace />
  }

  return children
}
