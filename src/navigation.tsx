import type { LucideIcon } from 'lucide-react'
import {
  ArchiveRestore,
  ClipboardCheck,
  FilePenLine,
  FileText,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react'
import type { RoleCode } from './auth/auth-context'

export type AppNavItem = {
  label: string
  path: string
  icon: LucideIcon
  adminOnly?: boolean
}

export const baseNavItems: AppNavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Team', path: '/team', icon: Users },
  { label: 'Entry Form', path: '/entry-forms', icon: FilePenLine },
  { label: 'Checklist', path: '/checklist', icon: ClipboardCheck },
  { label: 'Inspection Form', path: '/inspection-forms', icon: ShieldCheck },
  { label: 'Weight-In', path: '/weight-in', icon: Scale },
  { label: 'Race Result', path: '/race-results', icon: Trophy },
  { label: 'Competitor Request', path: '/competitor-requests', icon: FileText },
]

export const adminNavItems: AppNavItem[] = [
  { label: 'Scrutineer Report', path: '/scrutineer-reports', icon: ScrollText, adminOnly: true },
  { label: 'Recently Delete', path: '/recently-delete', icon: ArchiveRestore, adminOnly: true },
  { label: 'Organizer Settings', path: '/organizer-settings', icon: Wrench, adminOnly: true },
  { label: 'Auth Health', path: '/auth-health', icon: HeartPulse, adminOnly: true },
]

export const settingsNavItems: AppNavItem[] = [
  { label: 'Profile', path: '/settings/profile', icon: Settings },
  { label: 'Privacy', path: '/settings/privacy', icon: Gauge },
]

const elevatedRoles: RoleCode[] = ['ADMIN', 'SECRETARY']

export function canSeeAdminNavigation(roles: RoleCode[]) {
  return roles.some((role) => elevatedRoles.includes(role))
}

export function getNavigationItems(roles: RoleCode[]) {
  return [
    ...baseNavItems,
    ...(canSeeAdminNavigation(roles) ? adminNavItems : []),
    ...settingsNavItems,
  ]
}

export function getPrimaryRoleLabel(roles: RoleCode[]) {
  if (roles.includes('ADMIN')) return 'Admin'
  if (roles.includes('SECRETARY')) return 'Secretary'
  if (roles.includes('TEAM_MANAGER')) return 'Team Manager'
  if (roles.includes('COMPETITOR')) return 'Competitor'
  if (roles.includes('HEAD_SCRUTINEER')) return 'Head Scrutineer'
  if (roles.includes('SCRUTINEER_STAFF')) return 'Scrutineer Staff'
  if (roles.includes('OFFSITE_SCRUTINEER')) return 'Off-Site Scrutineer'
  if (roles.includes('STEWARD')) return 'Steward'
  if (roles.includes('CHAIRMAN')) return 'President'
  if (roles.includes('CLERK')) return 'Clerk of the course'
  return 'Authenticated'
}
