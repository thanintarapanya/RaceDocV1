import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { RoleCode } from './auth-context'
import { useAuth } from './useAuth'
import { canSeeAdminNavigation, canSeeRecentlyDeleteNavigation } from '@/navigation'

export function AdminOrSecretaryRoute({ children }: { children: ReactNode }) {
  const { roles } = useAuth()

  if (!canSeeAdminNavigation(roles)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { roles } = useAuth()

  if (!canSeeRecentlyDeleteNavigation(roles)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

const scrutineerReportRoles: RoleCode[] = [
  'ADMIN',
  'SECRETARY',
  'HEAD_SCRUTINEER',
  'SCRUTINEER_STAFF',
  'OFFSITE_SCRUTINEER',
  'CHAIRMAN',
  'STEWARD',
  'CLERK',
]

export function ScrutineerReportRoute({ children }: { children: ReactNode }) {
  const { roles } = useAuth()

  if (!roles.some((role) => scrutineerReportRoles.includes(role))) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
