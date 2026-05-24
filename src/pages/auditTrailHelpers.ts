export type AuditTrailItem = {
  id: string
  entityType: string
  entityId: string
  action: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  previousStatus: string | null
  newStatus: string | null
  actionById: string | null
  actorName: string | null
  createdAt: string
}

export type AuditTrailPayload = {
  canView: boolean
  total: number
  limit: number
  offset: number
  items: AuditTrailItem[]
}

export const emptyAuditTrailPayload: AuditTrailPayload = {
  canView: false,
  total: 0,
  limit: 50,
  offset: 0,
  items: [],
}

export function normalizeAuditTrailPayload(data: unknown): AuditTrailPayload {
  if (!data || typeof data !== 'object') return emptyAuditTrailPayload

  const candidate = data as Partial<AuditTrailPayload>

  return {
    canView: Boolean(candidate.canView),
    total: typeof candidate.total === 'number' ? candidate.total : 0,
    limit: typeof candidate.limit === 'number' ? candidate.limit : 50,
    offset: typeof candidate.offset === 'number' ? candidate.offset : 0,
    items: Array.isArray(candidate.items) ? candidate.items as AuditTrailItem[] : [],
  }
}

export function getAuditEntityLabel(entityType: string) {
  return entityType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown Entity'
}

export function getAuditActionLabel(action: string) {
  return action
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown Action'
}

export function getAuditPageRange(total: number, limit: number, offset: number) {
  if (total <= 0) return { from: 0, to: 0 }

  const from = offset + 1
  const to = Math.min(offset + limit, total)
  return { from, to }
}

export function buildAuditTrailCsv(items: AuditTrailItem[]) {
  const header = [
    'Recorded At',
    'Entity Type',
    'Entity ID',
    'Action',
    'Actor',
    'Previous Status',
    'New Status',
    'Old Values',
    'New Values',
  ]

  const rows = items.map((item) => [
    item.createdAt,
    item.entityType,
    item.entityId,
    item.action,
    item.actorName || item.actionById || '',
    item.previousStatus || '',
    item.newStatus || '',
    item.oldValues ? JSON.stringify(item.oldValues) : '',
    item.newValues ? JSON.stringify(item.newValues) : '',
  ])

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

function escapeCsvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}
