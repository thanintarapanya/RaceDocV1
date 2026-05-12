import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'

export function OnboardingRoute({ children }: { children: ReactNode }) {
  const { user, profile, roles, loading } = useAuth()

  if (loading) {
    return <LoadingScreen label="Preparing onboarding" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles.includes('ADMIN') || roles.includes('SECRETARY')) {
    return <Navigate to="/dashboard" replace />
  }

  if (profile?.onboarding_status === 'Ready') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
