import { describe, expect, it } from 'vitest'
import { getNotificationTargetPath } from './appLayoutHelpers'

describe('app layout helpers', () => {
  it('links inspection notifications to the exact inspection form document', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'inspection_form',
      linkEntityId: 'inspection-form-1',
    })).toBe('/inspection-forms?inspectionFormId=inspection-form-1')
  })

  it('falls back to the inspection tab when the notification has no document id', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'inspection_form',
      linkEntityId: null,
    })).toBe('/inspection-forms')
  })

  it('links entry notifications to the exact entry form row', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'entry_form',
      linkEntityId: 'entry-form-1',
    })).toBe('/entry-forms?entryFormId=entry-form-1')
  })

  it('falls back to the entry tab when the notification has no document id', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'entry_form',
      linkEntityId: null,
    })).toBe('/entry-forms')
  })

  it('links competitor request notifications to the exact request row', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'competitor_request',
      linkEntityId: 'competitor-request-1',
    })).toBe('/competitor-requests?competitorRequestId=competitor-request-1')
  })

  it('falls back to the competitor request tab when the notification has no document id', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'competitor_request',
      linkEntityId: null,
    })).toBe('/competitor-requests')
  })

  it('links weight-in notifications to the exact session context', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'weight_in',
      linkEntityId: 'weight-session-1',
    })).toBe('/weight-in?weighInSessionId=weight-session-1')
  })

  it('falls back to the weight-in tab when the notification has no session id', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'weight_in',
      linkEntityId: null,
    })).toBe('/weight-in')
  })

  it('ignores unsupported notification targets', () => {
    expect(getNotificationTargetPath({
      linkEntityType: 'race_result',
      linkEntityId: 'race-result-1',
    })).toBeNull()
  })
})
