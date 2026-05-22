export type NotificationLink = {
  linkEntityType: string | null
  linkEntityId: string | null
}

export function getNotificationTargetPath(notification: NotificationLink) {
  if (notification.linkEntityType === 'inspection_form') {
    const formId = notification.linkEntityId?.trim()

    if (formId) return `/inspection-forms?inspectionFormId=${encodeURIComponent(formId)}`
    return '/inspection-forms'
  }

  if (notification.linkEntityType === 'entry_form') {
    const entryId = notification.linkEntityId?.trim()

    if (entryId) return `/entry-forms?entryFormId=${encodeURIComponent(entryId)}`
    return '/entry-forms'
  }

  if (notification.linkEntityType === 'competitor_request') {
    const requestId = notification.linkEntityId?.trim()

    if (requestId) return `/competitor-requests?competitorRequestId=${encodeURIComponent(requestId)}`
    return '/competitor-requests'
  }

  if (notification.linkEntityType === 'weight_in') {
    const sessionId = notification.linkEntityId?.trim()

    if (sessionId) return `/weight-in?weighInSessionId=${encodeURIComponent(sessionId)}`
    return '/weight-in'
  }

  return null
}
