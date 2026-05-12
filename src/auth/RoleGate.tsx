import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canSeeAdminNavigation } from '@/navigation'

export function AdminOrSecretaryRoute({ children }: { children: ReactNode }) {
  const { roles } = useAuth()

  if (!canSeeAdminNavigation(roles)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
