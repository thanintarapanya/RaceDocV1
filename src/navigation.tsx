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
  { label: 'Scrutineer Report', path: '/scrutineer-reports', icon: ScrollText },
  { label: 'Recently Delete', path: '/recently-delete', icon: ArchiveRestore },
  { label: 'Organizer Settings', path: '/organizer-settings', icon: Wrench },
  { label: 'Auth Health', path: '/auth-health', icon: HeartPulse },
]

export const settingsNavItems: AppNavItem[] = [
  { label: 'User & Role', path: '/settings/user-roles', icon: ShieldCheck },
  { label: 'Profile', path: '/settings/profile', icon: Settings },
  { label: 'Privacy', path: '/settings/privacy', icon: Gauge },
]

const elevatedRoles: RoleCode[] = ['ADMIN', 'SECRETARY']
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

export function canSeeAdminNavigation(roles: RoleCode[]) {
  return roles.some((role) => elevatedRoles.includes(role))
}

export function canSeeRecentlyDeleteNavigation(roles: RoleCode[]) {
  return roles.includes('ADMIN')
}

export function canSeeScrutineerReportNavigation(roles: RoleCode[]) {
  return roles.some((role) => scrutineerReportRoles.includes(role))
}

export function getNavigationItems(roles: RoleCode[]) {
  const scrutineerReportItem = canSeeScrutineerReportNavigation(roles) ? [adminNavItems[0]] : []
  const adminOnlyItems = canSeeAdminNavigation(roles)
    ? adminNavItems.slice(1).filter((item) => item.path !== '/recently-delete' || canSeeRecentlyDeleteNavigation(roles))
    : []

  return [
    ...baseNavItems,
    ...scrutineerReportItem,
    ...adminOnlyItems,
    ...(canSeeAdminNavigation(roles) ? settingsNavItems : settingsNavItems.slice(1)),
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
