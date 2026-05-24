import { Bell, CheckCircle2, ClipboardCheck, FileClock, FileText, Scale, ScrollText, ShieldAlert, Trophy, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RoleCode } from '@/auth/auth-context'

export type DashboardScope = 'admin' | 'secretary' | 'head_scrutineer' | 'scrutineer' | 'committee' | 'team_manager' | 'competitor' | 'authenticated' | 'official'

export type DashboardMetrics = {
  draftEntryForms: number
  pendingEntryForms: number
  activeEntryForms: number
  rejectedEntryForms: number
  eligibleToRace: number
  pendingRequests: number
  racerApprovalRequired: number
  approvedRequests: number
  rejectedRequests: number
  requestReviewQueue: number
  inspectionDraft: number
  inspectionPending: number
  inspectionHold: number
  inspectionFailed: number
  inspectionPassed: number
  weightInPending: number
  weightInPassed: number
  weightInFailed: number
  scrutineerReportsDraft: number
  scrutineerReportsOfficial: number
  raceResultsDraft: number
  raceResultsProvisional: number
  raceResultsOfficial: number
  unreadNotifications: number
  teamCompetitors: number
}

export type DashboardAlert = {
  type: string
  severity: 'info' | 'warning' | 'danger'
  title: string
  description: string
  timestamp: string | null
  path?: string
}

export type DashboardAction = {
  label: string
  path: string
  count: number
}

export type DashboardSummary = {
  scope: DashboardScope
  metrics: DashboardMetrics
  alerts: DashboardAlert[]
  next_actions: DashboardAction[]
}

export type DashboardCard = {
  label: string
  value: number
  note: string
  icon: LucideIcon
  emphasis: boolean
}

export const defaultMetrics: DashboardMetrics = {
  draftEntryForms: 0,
  pendingEntryForms: 0,
  activeEntryForms: 0,
  rejectedEntryForms: 0,
  eligibleToRace: 0,
  pendingRequests: 0,
  racerApprovalRequired: 0,
  approvedRequests: 0,
  rejectedRequests: 0,
  requestReviewQueue: 0,
  inspectionDraft: 0,
  inspectionPending: 0,
  inspectionHold: 0,
  inspectionFailed: 0,
  inspectionPassed: 0,
  weightInPending: 0,
  weightInPassed: 0,
  weightInFailed: 0,
  scrutineerReportsDraft: 0,
  scrutineerReportsOfficial: 0,
  raceResultsDraft: 0,
  raceResultsProvisional: 0,
  raceResultsOfficial: 0,
  unreadNotifications: 0,
  teamCompetitors: 0,
}

export function createDashboardCards(metrics: DashboardMetrics, scope: DashboardScope): DashboardCard[] {
  if (scope === 'admin') {
    return [
      createCard('Active Entry Forms', metrics.activeEntryForms, 'Approved and locked race entries', Trophy, false),
      createCard('Pending Requests', metrics.pendingRequests, 'Request pipeline items still open', FileText, metrics.pendingRequests > 0),
      createCard('Unread Notifications', metrics.unreadNotifications, 'New system notices for your account', Bell, metrics.unreadNotifications > 0),
      createCard('Official Results', metrics.raceResultsOfficial, 'Race Results signed as official', Wrench, false),
    ]
  }

  if (scope === 'secretary') {
    return [
      createCard('Pending Entry Forms', metrics.pendingEntryForms, 'Awaiting Secretary/Admin review', FileClock, metrics.pendingEntryForms > 0),
      createCard('Checklist Rows', metrics.activeEntryForms, 'Active entries visible in Checklist', ClipboardCheck, false),
      createCard('Pending Requests', metrics.pendingRequests, 'Requests requiring secretary processing', FileText, metrics.pendingRequests > 0),
      createCard('Eligible To Race', metrics.eligibleToRace, 'Active cars cleared by technical status', Trophy, false),
    ]
  }

  if (scope === 'head_scrutineer') {
    return [
      createCard('Inspection Queue', metrics.inspectionPending + metrics.inspectionHold, 'Pending or hold inspections', ShieldAlert, metrics.inspectionPending + metrics.inspectionHold > 0),
      createCard('Weight-In Issues', metrics.weightInFailed, 'Failed non-void weigh-in logs', Scale, metrics.weightInFailed > 0),
      createCard('Draft Reports', metrics.scrutineerReportsDraft, 'Scrutineer Reports not official yet', ScrollText, metrics.scrutineerReportsDraft > 0),
      createCard('Passed Inspection', metrics.inspectionPassed, 'Cars passed by technical team', CheckCircle2, false),
    ]
  }

  if (scope === 'scrutineer') {
    return [
      createCard('Inspection Pending', metrics.inspectionPending, 'Cars waiting for inspection result', ShieldAlert, metrics.inspectionPending > 0),
      createCard('Inspection Hold', metrics.inspectionHold, 'Cars held for technical follow-up', FileClock, metrics.inspectionHold > 0),
      createCard('Weight-In Pending', metrics.weightInPending, 'Cars waiting for weighing', Scale, metrics.weightInPending > 0),
      createCard('Active Entry Forms', metrics.activeEntryForms, 'Approved cars in the current scope', Trophy, false),
    ]
  }

  if (scope === 'committee') {
    return [
      createCard('Review Queue', metrics.requestReviewQueue, 'Requests assigned to your decision role', FileText, metrics.requestReviewQueue > 0),
      createCard('Provisional Results', metrics.raceResultsProvisional, 'Race Results not official yet', Trophy, metrics.raceResultsProvisional > 0),
      createCard('Official Reports', metrics.scrutineerReportsOfficial, 'Published technical reports', ScrollText, false),
      createCard('Pending Requests', metrics.pendingRequests, 'Visible request pipeline items', Bell, metrics.pendingRequests > 0),
    ]
  }

  if (scope === 'team_manager') {
    return [
      createCard('Team Competitors', metrics.teamCompetitors, 'Accepted competitors under your team', Users, false),
      createCard('Active Entry Forms', metrics.activeEntryForms, 'Approved team race entries', Trophy, false),
      createCard('Pending Entry Forms', metrics.pendingEntryForms, 'Team entries awaiting review', FileClock, metrics.pendingEntryForms > 0),
      createCard('Pending Requests', metrics.pendingRequests, 'Open team request pipeline items', FileText, metrics.pendingRequests > 0),
    ]
  }

  return [
    createCard('Active Entry Forms', metrics.activeEntryForms, 'Approved and locked race entries', Trophy, false),
    createCard('Pending Entry Forms', metrics.pendingEntryForms, 'Submitted and awaiting review', FileClock, metrics.pendingEntryForms > 0),
    createCard('Requests Waiting', metrics.pendingRequests + metrics.racerApprovalRequired, 'Requests still moving through approval', Bell, metrics.pendingRequests + metrics.racerApprovalRequired > 0),
    createCard('Technical Issues', metrics.inspectionHold + metrics.inspectionFailed + metrics.weightInFailed, 'Inspection hold/fail or failed weigh-in', ShieldAlert, metrics.inspectionHold + metrics.inspectionFailed + metrics.weightInFailed > 0),
  ]
}

export function normalizeDashboardSummary(raw: unknown, roles: RoleCode[]): DashboardSummary {
  const row = (raw ?? {}) as Partial<DashboardSummary>

  return {
    scope: row.scope ?? getFallbackScope(roles),
    metrics: { ...defaultMetrics, ...(row.metrics ?? {}) },
    alerts: row.alerts ?? [],
    next_actions: row.next_actions ?? [],
  }
}

export function getFallbackScope(roles: RoleCode[]): DashboardScope {
  if (roles.includes('ADMIN')) return 'admin'
  if (roles.includes('SECRETARY')) return 'secretary'
  if (roles.includes('HEAD_SCRUTINEER')) return 'head_scrutineer'
  if (roles.includes('SCRUTINEER_STAFF') || roles.includes('OFFSITE_SCRUTINEER')) return 'scrutineer'
  if (roles.includes('CHAIRMAN') || roles.includes('STEWARD') || roles.includes('CLERK')) return 'committee'
  if (roles.includes('TEAM_MANAGER')) return 'team_manager'
  if (roles.includes('COMPETITOR')) return 'competitor'
  return 'authenticated'
}

export function getScopeLabel(scope: DashboardScope) {
  const labels: Record<DashboardScope, string> = {
    admin: 'System control',
    secretary: 'Race office',
    head_scrutineer: 'Technical command',
    scrutineer: 'Technical crew',
    committee: 'Decision desk',
    team_manager: 'Team cockpit',
    competitor: 'Driver cockpit',
    authenticated: 'Operations',
    official: 'Official',
  }
  return labels[scope]
}

export function getScopeDescription(scope: DashboardScope) {
  if (scope === 'admin') return 'System-level race operations, user control, audit posture, and official output status.'
  if (scope === 'secretary') return 'Race office queue for Entry approvals, Checklist readiness, and Competitor Request processing.'
  if (scope === 'head_scrutineer') return 'Technical control for inspection queue, weight-in issues, and Scrutineer Report publishing.'
  if (scope === 'scrutineer') return 'Operational technical workbench for inspection, component checks, and weigh-in follow-up.'
  if (scope === 'committee') return 'Decision desk for assigned requests, provisional results, and official technical reports.'
  if (scope === 'team_manager') return 'Team status across accepted competitors, active entries, and open request workflows.'
  return 'Your race documents, technical status, request progress, and next actions in one place.'
}

function createCard(label: string, value: number, note: string, icon: LucideIcon, emphasis: boolean): DashboardCard {
  return { label, value, note, icon, emphasis }
}
