export type PrintBackgroundAsset = {
  printBackgroundAssetId: string
  eventId: string
  eventName: string
  title: string
  orientation: 'portrait' | 'landscape'
  isDefault: boolean
  fileAssetId: string
  bucket: string
  path: string
  filename: string
  mimeType: string | null
  sizeBytes: number | null
}

export type PrintOptions = {
  canManage: boolean
  reportId: string
  status: string
  eventId: string
  eventName: string
  raceName: string
  seriesClass: string
  selectedBackgroundId: string | null
  selectedBackground: PrintBackgroundAsset | null
  printBackgroundAssets: PrintBackgroundAsset[]
}

export function normalizePrintOptions(options: PrintOptions | null | undefined): PrintOptions | null {
  if (!options?.reportId) return null

  return {
    canManage: Boolean(options.canManage),
    reportId: options.reportId,
    status: options.status ?? '',
    eventId: options.eventId ?? '',
    eventName: options.eventName ?? '',
    raceName: options.raceName ?? '',
    seriesClass: options.seriesClass ?? '',
    selectedBackgroundId: options.selectedBackgroundId ?? options.selectedBackground?.printBackgroundAssetId ?? null,
    selectedBackground: options.selectedBackground ?? null,
    printBackgroundAssets: options.printBackgroundAssets ?? [],
  }
}

export function getPrintBackgroundOptionsForOrientation(options: PrintOptions | null, orientation: 'portrait' | 'landscape') {
  return options?.printBackgroundAssets.filter((asset) => asset.orientation === orientation) ?? []
}

export function getPrintBackgroundAsset(options: PrintOptions | null, selectedBackgroundId: string, orientation?: 'portrait' | 'landscape') {
  if (!options) return null

  const eligibleAssets = orientation
    ? getPrintBackgroundOptionsForOrientation(options, orientation)
    : options.printBackgroundAssets

  return (
    eligibleAssets.find((asset) => asset.printBackgroundAssetId === selectedBackgroundId)
    ?? eligibleAssets.find((asset) => asset.printBackgroundAssetId === options.selectedBackground?.printBackgroundAssetId)
    ?? eligibleAssets.find((asset) => asset.isDefault)
    ?? eligibleAssets[0]
    ?? null
  )
}
