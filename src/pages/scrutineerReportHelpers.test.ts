import { describe, expect, it } from 'vitest'
import { getPrintBackgroundAsset, normalizePrintOptions, type PrintOptions } from './scrutineerReportHelpers'

describe('scrutineer report helpers', () => {
  it('normalizes empty print options safely', () => {
    expect(normalizePrintOptions(null)).toBeNull()
  })

  it('uses selected background id from selected background when the rpc field is empty', () => {
    const options = normalizePrintOptions({
      canManage: true,
      reportId: 'report-1',
      status: 'Official',
      eventId: 'event-1',
      eventName: 'Event 1',
      raceName: 'Race 1',
      seriesClass: 'Siam Eco - Pro',
      selectedBackgroundId: null,
      selectedBackground: createBackground('background-1'),
      printBackgroundAssets: [createBackground('background-1')],
    })

    expect(options?.selectedBackgroundId).toBe('background-1')
  })

  it('prefers the explicitly selected print background asset', () => {
    const options: PrintOptions = {
      canManage: true,
      reportId: 'report-1',
      status: 'Official',
      eventId: 'event-1',
      eventName: 'Event 1',
      raceName: 'Race 1',
      seriesClass: 'Siam Eco - Pro',
      selectedBackgroundId: 'background-1',
      selectedBackground: createBackground('background-1'),
      printBackgroundAssets: [createBackground('background-1'), createBackground('background-2')],
    }

    expect(getPrintBackgroundAsset(options, 'background-2')?.printBackgroundAssetId).toBe('background-2')
  })
})

function createBackground(printBackgroundAssetId: string) {
  return {
    printBackgroundAssetId,
    eventId: 'event-1',
    eventName: 'Event 1',
    title: printBackgroundAssetId,
    isDefault: printBackgroundAssetId === 'background-1',
    fileAssetId: `file-${printBackgroundAssetId}`,
    bucket: 'organizer_assets',
    path: `print-backgrounds/event-1/${printBackgroundAssetId}.png`,
    filename: `${printBackgroundAssetId}.png`,
    mimeType: 'image/png',
    sizeBytes: 4096,
  }
}
