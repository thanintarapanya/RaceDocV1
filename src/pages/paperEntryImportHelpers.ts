export type PaperEntryDraft = {
  firstNameTh: string
  lastNameTh: string
  firstNameEn: string
  lastNameEn: string
  email: string
  phone: string
  identityNo: string
  passportNo: string
  licenseNo: string
  carNumber: string
  eventName: string
  seriesName: string
  gradeName: string
  vehicleManufacturer: string
  vehicleModel: string
  vehicleColor: string
  vehicleYear: string
  engineSizeCc: string
  teamName: string
  notes: string
}

export type PaperEntryImportPayload = {
  rawPayload: Record<string, string>
  normalizedPayload: Record<string, unknown>
}

export type ParsedPaperEntryImportRow = PaperEntryImportPayload & {
  rowNumber: number
}

export type PaperEntryImportRowSummary = {
  driverName: string
  identitySignal: string
  entrySignal: string
}

export type PaperEntryImportRowLike = {
  status?: string | null
  matched_profile_id?: string | null
  raw_payload?: Record<string, unknown> | null
  normalized_payload?: Record<string, unknown> | null
}

export type PaperEntryCommitReadiness = {
  canCommit: boolean
  matchedCount: number
  blockingReason: string
}

export function createEmptyPaperEntryDraft(): PaperEntryDraft {
  return {
    firstNameTh: '',
    lastNameTh: '',
    firstNameEn: '',
    lastNameEn: '',
    email: '',
    phone: '',
    identityNo: '',
    passportNo: '',
    licenseNo: '',
    carNumber: '',
    eventName: '',
    seriesName: '',
    gradeName: '',
    vehicleManufacturer: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: '',
    engineSizeCc: '',
    teamName: '',
    notes: '',
  }
}

export function isPaperEntryDraftStageable(draft: PaperEntryDraft) {
  const hasIdentity = [draft.email, draft.phone, draft.identityNo, draft.passportNo].some(hasValue)
  const hasName = [draft.firstNameTh, draft.lastNameTh].every(hasValue) || [draft.firstNameEn, draft.lastNameEn].every(hasValue)
  return (hasIdentity || hasName) && hasValue(draft.carNumber)
}

export function createPaperEntryImportPayload(draft: PaperEntryDraft): PaperEntryImportPayload {
  const normalizedDraft = Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, normalizeText(value)]),
  ) as PaperEntryDraft

  return {
    rawPayload: normalizedDraft,
    normalizedPayload: {
      ...normalizedDraft,
      personalSnapshot: {
        firstNameTh: normalizedDraft.firstNameTh,
        lastNameTh: normalizedDraft.lastNameTh,
        firstNameEn: normalizedDraft.firstNameEn,
        lastNameEn: normalizedDraft.lastNameEn,
        email: normalizedDraft.email,
        mobileNo: normalizedDraft.phone,
        identityNo: normalizedDraft.identityNo,
        passportNo: normalizedDraft.passportNo,
      },
      entry: {
        eventName: normalizedDraft.eventName,
        seriesName: normalizedDraft.seriesName,
        gradeName: normalizedDraft.gradeName,
        carNumber: normalizedDraft.carNumber,
      },
      driverLicense: {
        licenseNo: normalizedDraft.licenseNo,
      },
      vehicle: {
        manufacturer: normalizedDraft.vehicleManufacturer,
        model: normalizedDraft.vehicleModel,
        color: normalizedDraft.vehicleColor,
        year: normalizedDraft.vehicleYear,
        engineSizeCc: normalizedDraft.engineSizeCc,
      },
      teamSnapshot: {
        teamName: normalizedDraft.teamName,
      },
    },
  }
}

export function parsePaperEntryCsvImportRows(csvText: string) {
  const table = parseCsv(csvText)
  if (table.length === 0) return { rows: [] as ParsedPaperEntryImportRow[], errors: ['CSV file is empty.'] }

  const [headers, ...records] = table
  const normalizedHeaders = headers.map(normalizeHeader)
  const errors: string[] = []
  const rows = records
    .map((record, index) => ({ record, rowNumber: index + 2 }))
    .filter(({ record }) => record.some(hasValue))
    .map(({ record, rowNumber }) => {
      const draft = createEmptyPaperEntryDraft()

      normalizedHeaders.forEach((header, index) => {
        const draftKey = headerToDraftKey(header)
        if (draftKey) draft[draftKey] = normalizeText(record[index] ?? '')
      })

      if (!isPaperEntryDraftStageable(draft)) {
        errors.push(`Row ${rowNumber} needs car number plus identity, phone, email, or full name.`)
      }

      return {
        rowNumber,
        ...createPaperEntryImportPayload(draft),
      }
    })

  if (rows.length === 0) errors.push('CSV file has headers but no data rows.')

  return { rows, errors }
}

export function getPaperEntryImportRowSummary(row: PaperEntryImportRowLike): PaperEntryImportRowSummary {
  const payload = getPayloadRecord(row)
  const driverName = firstNonEmpty(
    [payload.firstNameTh, payload.lastNameTh].join(' '),
    [payload.firstNameEn, payload.lastNameEn].join(' '),
    payload.email,
    'Unidentified driver',
  )
  const identitySignal = firstNonEmpty(
    payload.email,
    payload.phone,
    payload.identityNo,
    payload.passportNo,
    'No identity signal',
  )
  const entrySignal = firstNonEmpty(
    [payload.eventName, payload.seriesName, payload.gradeName].filter(Boolean).join(' / '),
    payload.carNumber ? `Car #${payload.carNumber}` : '',
    'Entry scope not recorded',
  )

  return { driverName, identitySignal, entrySignal }
}

export function getPaperEntryMatchPayload(row: PaperEntryImportRowLike) {
  return getPayloadRecord(row)
}

export function getPaperEntryMatchTone(confidence: number | null | undefined) {
  if (typeof confidence !== 'number') return 'weak'
  if (confidence >= 90) return 'strong'
  if (confidence >= 70) return 'medium'
  return 'weak'
}

export function getPaperEntryCommitReadiness(rows: PaperEntryImportRowLike[]): PaperEntryCommitReadiness {
  if (rows.length === 0) {
    return { canCommit: false, matchedCount: 0, blockingReason: 'No staged rows in this batch.' }
  }

  const committedCount = rows.filter((row) => row.status === 'Committed').length
  if (committedCount === rows.length) {
    return { canCommit: false, matchedCount: 0, blockingReason: 'This batch has already been committed.' }
  }

  const matchedRows = rows.filter((row) => row.status === 'Matched' && Boolean(row.matched_profile_id))
  const blockingRows = rows.length - matchedRows.length

  if (blockingRows > 0) {
    return {
      canCommit: false,
      matchedCount: matchedRows.length,
      blockingReason: `${blockingRows} row(s) still need an accepted profile match.`,
    }
  }

  return { canCommit: true, matchedCount: matchedRows.length, blockingReason: '' }
}

function parseCsv(csvText: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const nextChar = csvText[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  rows.push(row)

  return rows.filter((cells) => cells.some(hasValue))
}

function getPayloadRecord(row: PaperEntryImportRowLike): Record<string, string> {
  const rawPayload = normalizeRecord(row.raw_payload)
  const normalizedPayload = normalizeRecord(row.normalized_payload)
  return { ...normalizedPayload, ...rawPayload }
}

function normalizeRecord(value: Record<string, unknown> | null | undefined) {
  const record: Record<string, string> = {}
  if (!value) return record

  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === 'string') record[key] = normalizeText(item)
  })

  return record
}

function firstNonEmpty(...values: unknown[]) {
  return values.map(normalizeText).find(Boolean) ?? ''
}

function headerToDraftKey(header: string): keyof PaperEntryDraft | null {
  const map: Record<string, keyof PaperEntryDraft> = {
    firstnameth: 'firstNameTh',
    nameth: 'firstNameTh',
    lastnameth: 'lastNameTh',
    surnameth: 'lastNameTh',
    firstnameen: 'firstNameEn',
    nameen: 'firstNameEn',
    lastnameen: 'lastNameEn',
    surnameen: 'lastNameEn',
    email: 'email',
    phone: 'phone',
    mobileno: 'phone',
    mobile: 'phone',
    identityno: 'identityNo',
    idcardno: 'identityNo',
    idcard: 'identityNo',
    passportno: 'passportNo',
    passport: 'passportNo',
    licenseno: 'licenseNo',
    competitionlicenseno: 'licenseNo',
    carnumber: 'carNumber',
    carno: 'carNumber',
    event: 'eventName',
    eventname: 'eventName',
    series: 'seriesName',
    seriesrace: 'seriesName',
    grade: 'gradeName',
    graderace: 'gradeName',
    manufacturer: 'vehicleManufacturer',
    carmanufacturer: 'vehicleManufacturer',
    model: 'vehicleModel',
    color: 'vehicleColor',
    year: 'vehicleYear',
    enginesizecc: 'engineSizeCc',
    enginecc: 'engineSizeCc',
    team: 'teamName',
    teamname: 'teamName',
    notes: 'notes',
  }

  return map[header] ?? null
}

function normalizeHeader(value: string) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function hasValue(value: string) {
  return value.trim().length > 0
}
