export type PrintBackgroundAsset = {
  printBackgroundAssetId: string
  eventId: string
  eventName: string
  title: string
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

export function getPrintBackgroundAsset(options: PrintOptions | null, selectedBackgroundId: string) {
  if (!options) return null

  return (
    options.printBackgroundAssets.find((asset) => asset.printBackgroundAssetId === selectedBackgroundId)
    ?? options.selectedBackground
    ?? options.printBackgroundAssets[0]
    ?? null
  )
}
