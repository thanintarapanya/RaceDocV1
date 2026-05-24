import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ClipboardList, Flag, Image, Layers3, Loader2, MapPinned, RefreshCcw, Save, Scale, Trophy, Wrench, X } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  groupBallastRulesByEventRule,
  groupPrintBackgroundAssetsByEvent,
  groupSponsorStickerAssetsByEventRule,
  groupTireRulesByEventRule,
  groupSeasonSeriesBySeason,
  groupSeasonSeriesGradesBySeries,
  groupEventSeriesRulesByEvent,
  groupInspectionTemplatesByEventRule,
  groupWeightRulesByEventRule,
  getEligibleGradesForEventSeries,
  normalizeOrganizerSettingsPayload,
  type BallastRuleRow,
  type BallastType,
  type CircuitOption,
  type EventSeriesRuleRow,
  type EventRow,
  type EventStatus,
  type GradeRow,
  type InspectionInputType,
  type InspectionTemplateItemRow,
  type InspectionTemplateRow,
  type InspectionTemplateSectionRow,
  type OrganizerPayload,
  type PrintBackgroundAssetRow,
  type RaceRow,
  type SeasonRow,
  type SeasonSeriesGradeRow,
  type SeasonSeriesRow,
  type SeasonStatus,
  type SeriesRaceRow,
  type RuleStatus,
  type SponsorStickerAssetRow,
  type TireRuleRow,
  type WeightRuleRow,
  type WeightEffectType,
} from './organizerSettingsHelpers'

type CircuitForm = {
  circuitId: string
  name: string
  location: string
  country: string
}

type SeasonForm = {
  seasonId: string
  organizationId: string
  name: string
  year: string
  status: SeasonStatus
  isActive: boolean
}

type EventForm = {
  eventId: string
  seasonId: string
  circuitId: string
  name: string
  eventOrder: string
  startsOn: string
  endsOn: string
  status: EventStatus
}

type RaceForm = {
  raceId: string
  eventId: string
  name: string
  raceOrder: string
  sessionType: string
  scheduledAt: string
  resultsImportUnlocked: boolean
}

type SeriesRaceForm = {
  seriesRaceId: string
  organizationId: string
  code: string
  name: string
  ballastType: BallastType
  isActive: boolean
}

type GradeForm = {
  gradeId: string
  code: string
  name: string
  sortOrder: string
}

type SeasonSeriesForm = {
  seasonId: string
  seriesRaceId: string
  isActive: boolean
}

type SeasonSeriesGradeForm = {
  seasonId: string
  seriesRaceId: string
  gradeId: string
  isActive: boolean
}

type EventSeriesRuleForm = {
  eventSeriesRuleId: string
  eventId: string
  seriesRaceId: string
  gradeId: string
  status: RuleStatus
  version: string
  isLocked: boolean
  clonedFromId: string
}

type InspectionTemplateForm = {
  templateId: string
  eventSeriesRuleId: string
  name: string
  version: string
  isActive: boolean
  cloneFromTemplateId: string
}

type InspectionSectionForm = {
  sectionId: string
  templateId: string
  code: string
  title: string
  sortOrder: string
  isFixed: boolean
}

type InspectionItemForm = {
  itemId: string
  sectionId: string
  labelTh: string
  labelEn: string
  inputType: InspectionInputType
  optionsText: string
  weightEffectType: WeightEffectType
  fixedWeightKg: string
  isRequired: boolean
  sortOrder: string
}

type BallastRuleForm = {
  ballastRuleId: string
  eventSeriesRuleId: string
  ballastType: BallastType
  maxBallastKg: string
  joinWeightEnabled: boolean
  positionMatrixText: string
  removalRuleText: string
}

type WeightRuleForm = {
  weightRuleId: string
  eventSeriesRuleId: string
  name: string
  engineMinCc: string
  engineMaxCc: string
  baseWeightKg: string
  additionalWeightRulesText: string
  isActive: boolean
  sortOrder: string
}

type TireRuleForm = {
  tireRuleId: string
  eventSeriesRuleId: string
  tireBrand: string
  tireModel: string
  isAllowed: boolean
}

type SponsorStickerAssetForm = {
  sponsorStickerAssetId: string
  eventSeriesRuleId: string
  title: string
  file: File | null
  existingFilename: string
  existingPath: string
}

type PrintBackgroundAssetForm = {
  printBackgroundAssetId: string
  eventId: string
  title: string
  orientation: 'portrait' | 'landscape'
  isDefault: boolean
  file: File | null
  existingFilename: string
  existingPath: string
}

const emptyPayload: OrganizerPayload = {
  canManage: false,
  organizations: [],
  circuits: [],
  seriesRaces: [],
  grades: [],
  seasonSeries: [],
  seasonSeriesGrades: [],
  eventSeriesRules: [],
  ballastRules: [],
  tireRules: [],
  sponsorStickerAssets: [],
  printBackgroundAssets: [],
  weightRules: [],
  inspectionTemplates: [],
  seasons: [],
  events: [],
  races: [],
}

const seasonStatuses: SeasonStatus[] = ['Draft', 'Active', 'Completed', 'Archived']
const eventStatuses: EventStatus[] = ['Draft', 'RegistrationOpen', 'Active', 'Completed', 'Cancelled']
const ruleStatuses: RuleStatus[] = ['Draft', 'Active', 'Locked', 'Archived']
const inspectionInputTypes: InspectionInputType[] = ['Checkbox', 'Dropdown', 'Text Input', 'Number', 'Date', 'File']
const weightEffectTypes: WeightEffectType[] = ['None', 'Fix', 'Vary']
const ballastTypes: BallastType[] = ['None', 'SuccessBallast', 'ChampionshipWeight']
const sessionTypes = ['Practice', 'Qualifying', 'Race']

type SettingsEditorKey =
  | 'circuit'
  | 'season'
  | 'seriesRace'
  | 'grade'
  | 'seasonSeries'
  | 'seasonSeriesGrade'
  | 'event'
  | 'race'
  | 'eventSeriesRule'
  | 'weightRule'
  | 'ballastRule'
  | 'tireRule'
  | 'sponsorStickerAsset'
  | 'printBackgroundAsset'
  | 'inspectionTemplate'
  | 'inspectionSection'
  | 'inspectionItem'

type DuplicateMode = 'season' | 'event'

type DuplicateDraft = {
  mode: DuplicateMode
  sourceId: string
  title: string
  name: string
  year: string
  eventOrder: string
  startsOn: string
  endsOn: string
  targetSeasonId: string
}

type SettingsEditor = {
  key: SettingsEditorKey
  label: string
  phase: string
  hint: string
  icon: typeof Wrench
}

type SettingsReadinessItem = {
  label: string
  value: number
  ready: boolean
}

type SettingsPhaseSummary = {
  phase: string
  complete: number
  total: number
}

const settingsEditors: SettingsEditor[] = [
  { key: 'season', label: 'Season', phase: '1. Foundation', hint: 'Start the racing year and active season.', icon: CalendarDays },
  { key: 'circuit', label: 'Circuit', phase: '1. Foundation', hint: 'Create tracks before assigning events.', icon: MapPinned },
  { key: 'seriesRace', label: 'Series Race', phase: '2. Classes', hint: 'Define competition groups and ballast type.', icon: Trophy },
  { key: 'grade', label: 'Grade', phase: '2. Classes', hint: 'Create PRO, AM, or other class levels.', icon: Layers3 },
  { key: 'seasonSeries', label: 'Season Series', phase: '3. Season Links', hint: 'Activate a series inside a season.', icon: Trophy },
  { key: 'seasonSeriesGrade', label: 'Season Grade', phase: '3. Season Links', hint: 'Choose grades available for a season series.', icon: Layers3 },
  { key: 'event', label: 'Event', phase: '4. Event Calendar', hint: 'Create each race weekend.', icon: Flag },
  { key: 'race', label: 'Race', phase: '4. Event Calendar', hint: 'Add practice, qualifying, and race sessions.', icon: Wrench },
  { key: 'eventSeriesRule', label: 'Event Rule', phase: '5. Rule Package', hint: 'Bind event, series, grade, and rule version.', icon: ClipboardList },
  { key: 'weightRule', label: 'Weight Rule', phase: '6. Technical Rules', hint: 'Set base weight and option weight rules.', icon: Scale },
  { key: 'ballastRule', label: 'Success Ballast', phase: '6. Technical Rules', hint: 'Set ballast type, caps, and position matrix.', icon: Trophy },
  { key: 'tireRule', label: 'Tire Rule', phase: '6. Technical Rules', hint: 'Control allowed tire brand and model.', icon: Wrench },
  { key: 'sponsorStickerAsset', label: 'Sponsor Sticker', phase: '7. Assets', hint: 'Upload official sponsor sticker artwork.', icon: Image },
  { key: 'printBackgroundAsset', label: 'A4 Background', phase: '7. Assets', hint: 'Upload printable document backgrounds.', icon: Image },
  { key: 'inspectionTemplate', label: 'Inspection Template', phase: '8. Inspection Builder', hint: 'Create the inspection form version.', icon: ClipboardList },
  { key: 'inspectionSection', label: 'Inspection Section', phase: '8. Inspection Builder', hint: 'Group inspection items into readable sections.', icon: Layers3 },
  { key: 'inspectionItem', label: 'Inspection Item', phase: '8. Inspection Builder', hint: 'Add fields, options, and weight effects.', icon: Wrench },
]

export function OrganizerSettingsPage() {
  const [payload, setPayload] = useState<OrganizerPayload>(emptyPayload)
  const [loading, setLoading] = useState(true)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [circuitForm, setCircuitForm] = useState<CircuitForm>(() => createEmptyCircuitForm())
  const [seriesRaceForm, setSeriesRaceForm] = useState<SeriesRaceForm>(() => createEmptySeriesRaceForm())
  const [gradeForm, setGradeForm] = useState<GradeForm>(() => createEmptyGradeForm())
  const [seasonSeriesForm, setSeasonSeriesForm] = useState<SeasonSeriesForm>(() => createEmptySeasonSeriesForm())
  const [seasonSeriesGradeForm, setSeasonSeriesGradeForm] = useState<SeasonSeriesGradeForm>(() => createEmptySeasonSeriesGradeForm())
  const [eventSeriesRuleForm, setEventSeriesRuleForm] = useState<EventSeriesRuleForm>(() => createEmptyEventSeriesRuleForm())
  const [inspectionTemplateForm, setInspectionTemplateForm] = useState<InspectionTemplateForm>(() => createEmptyInspectionTemplateForm())
  const [inspectionSectionForm, setInspectionSectionForm] = useState<InspectionSectionForm>(() => createEmptyInspectionSectionForm())
  const [inspectionItemForm, setInspectionItemForm] = useState<InspectionItemForm>(() => createEmptyInspectionItemForm())
  const [weightRuleForm, setWeightRuleForm] = useState<WeightRuleForm>(() => createEmptyWeightRuleForm())
  const [ballastRuleForm, setBallastRuleForm] = useState<BallastRuleForm>(() => createEmptyBallastRuleForm())
  const [tireRuleForm, setTireRuleForm] = useState<TireRuleForm>(() => createEmptyTireRuleForm())
  const [sponsorStickerAssetForm, setSponsorStickerAssetForm] = useState<SponsorStickerAssetForm>(() => createEmptySponsorStickerAssetForm())
  const [printBackgroundAssetForm, setPrintBackgroundAssetForm] = useState<PrintBackgroundAssetForm>(() => createEmptyPrintBackgroundAssetForm())
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(() => createEmptySeasonForm())
  const [eventForm, setEventForm] = useState<EventForm>(() => createEmptyEventForm())
  const [raceForm, setRaceForm] = useState<RaceForm>(() => createEmptyRaceForm())
  const [activeEditor, setActiveEditor] = useState<SettingsEditorKey>('season')
  const [editorOpen, setEditorOpen] = useState(false)
  const [duplicateDraft, setDuplicateDraft] = useState<DuplicateDraft | null>(null)

  const loadData = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const [settingsResult, weightRulesResult] = await Promise.all([
      supabase.rpc('get_organizer_settings'),
      supabase.rpc('get_organizer_weight_rules'),
    ])

    if (!isActive()) return

    if (settingsResult.error || weightRulesResult.error) {
      setPayload(emptyPayload)
      setError(settingsResult.error?.message ?? weightRulesResult.error?.message ?? 'Failed to load organizer settings.')
    } else {
      const nextPayload = normalizeOrganizerSettingsPayload({
        ...(settingsResult.data as OrganizerPayload | null),
        weightRules: (weightRulesResult.data ?? []) as WeightRuleRow[],
      } as OrganizerPayload)
      setPayload(nextPayload)
      setSeriesRaceForm((current) => current.seriesRaceId || current.organizationId ? current : createEmptySeriesRaceForm(nextPayload.organizations[0]?.organizationId ?? ''))
      setSeasonSeriesForm((current) => current.seasonId || current.seriesRaceId ? current : createEmptySeasonSeriesForm(nextPayload.seasons[0]?.seasonId ?? '', nextPayload.seriesRaces[0]?.seriesRaceId ?? ''))
      setSeasonSeriesGradeForm((current) => current.seasonId || current.seriesRaceId || current.gradeId ? current : createEmptySeasonSeriesGradeForm(nextPayload.seasons[0]?.seasonId ?? '', nextPayload.seriesRaces[0]?.seriesRaceId ?? '', nextPayload.grades[0]?.gradeId ?? ''))
      setEventSeriesRuleForm((current) => current.eventSeriesRuleId || current.eventId ? current : createEmptyEventSeriesRuleForm(nextPayload.events[0]?.eventId ?? '', nextPayload.seriesRaces[0]?.seriesRaceId ?? ''))
      setInspectionTemplateForm((current) => current.templateId || current.eventSeriesRuleId ? current : createEmptyInspectionTemplateForm(nextPayload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))
      setInspectionSectionForm((current) => current.sectionId || current.templateId ? current : createEmptyInspectionSectionForm(nextPayload.inspectionTemplates[0]?.templateId ?? ''))
      setInspectionItemForm((current) => current.itemId || current.sectionId ? current : createEmptyInspectionItemForm(nextPayload.inspectionTemplates[0]?.sections[0]?.sectionId ?? ''))
      setWeightRuleForm((current) => current.weightRuleId || current.eventSeriesRuleId ? current : createEmptyWeightRuleForm(nextPayload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))
      setBallastRuleForm((current) => current.ballastRuleId || current.eventSeriesRuleId ? current : createEmptyBallastRuleForm(nextPayload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))
      setTireRuleForm((current) => current.tireRuleId || current.eventSeriesRuleId ? current : createEmptyTireRuleForm(nextPayload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))
      setSponsorStickerAssetForm((current) => current.sponsorStickerAssetId || current.eventSeriesRuleId ? current : createEmptySponsorStickerAssetForm(nextPayload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))
      setPrintBackgroundAssetForm((current) => current.printBackgroundAssetId || current.eventId ? current : createEmptyPrintBackgroundAssetForm(nextPayload.events[0]?.eventId ?? ''))
      setSeasonForm((current) => current.seasonId || current.organizationId ? current : createEmptySeasonForm(nextPayload.organizations[0]?.organizationId ?? ''))
      setEventForm((current) => current.eventId || current.seasonId ? current : createEmptyEventForm(nextPayload.seasons[0]?.seasonId ?? '', nextPayload.circuits[0]?.circuitId ?? ''))
      setRaceForm((current) => current.raceId || current.eventId ? current : createEmptyRaceForm(nextPayload.events[0]?.eventId ?? ''))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    async function run() {
      await loadData(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadData])

  const eventsBySeason = useMemo(() => groupEventsBySeason(payload.events), [payload.events])
  const racesByEvent = useMemo(() => groupRacesByEvent(payload.races), [payload.races])
  const eventSeriesRulesByEvent = useMemo(() => groupEventSeriesRulesByEvent(payload.eventSeriesRules), [payload.eventSeriesRules])
  const weightRulesByEventRule = useMemo(() => groupWeightRulesByEventRule(payload.weightRules), [payload.weightRules])
  const ballastRulesByEventRule = useMemo(() => groupBallastRulesByEventRule(payload.ballastRules), [payload.ballastRules])
  const tireRulesByEventRule = useMemo(() => groupTireRulesByEventRule(payload.tireRules), [payload.tireRules])
  const sponsorStickerAssetsByEventRule = useMemo(() => groupSponsorStickerAssetsByEventRule(payload.sponsorStickerAssets), [payload.sponsorStickerAssets])
  const printBackgroundAssetsByEvent = useMemo(() => groupPrintBackgroundAssetsByEvent(payload.printBackgroundAssets), [payload.printBackgroundAssets])
  const inspectionTemplatesByEventRule = useMemo(() => groupInspectionTemplatesByEventRule(payload.inspectionTemplates), [payload.inspectionTemplates])
  const seasonSeriesBySeason = useMemo(() => groupSeasonSeriesBySeason(payload.seasonSeries), [payload.seasonSeries])
  const seasonSeriesGradesBySeries = useMemo(() => groupSeasonSeriesGradesBySeries(payload.seasonSeriesGrades), [payload.seasonSeriesGrades])
  const eventRuleGradeOptions = useMemo(() => {
    const eligibleGrades = getEligibleGradesForEventSeries(eventSeriesRuleForm.eventId, eventSeriesRuleForm.seriesRaceId, payload.events, payload.seasonSeries, payload.seasonSeriesGrades)
    if (eligibleGrades.length === 0) return payload.grades
    return payload.grades.filter((grade) => eligibleGrades.some((eligibleGrade) => eligibleGrade.gradeId === grade.gradeId))
  }, [eventSeriesRuleForm.eventId, eventSeriesRuleForm.seriesRaceId, payload.events, payload.grades, payload.seasonSeries, payload.seasonSeriesGrades])
  const inspectionSections = useMemo(() => payload.inspectionTemplates.flatMap((template) => template.sections), [payload.inspectionTemplates])
  const inspectionItems = useMemo(() => inspectionSections.flatMap((section) => section.items), [inspectionSections])
  const activeEditorMeta = settingsEditors.find((editor) => editor.key === activeEditor) ?? settingsEditors[0]
  const readiness = useMemo(() => createSettingsReadiness(payload), [payload])
  const phaseSummaries = useMemo(() => createSettingsPhaseSummaries(readiness), [readiness])

  function openEditor(editor: SettingsEditorKey) {
    setActiveEditor(editor)
    setEditorOpen(true)
  }

  function startDuplicateSeason(season: SeasonRow) {
    setDuplicateDraft({
      mode: 'season',
      sourceId: season.seasonId,
      title: `${season.year} / ${season.name}`,
      name: `${season.name} Copy`,
      year: String(season.year + 1),
      eventOrder: '',
      startsOn: '',
      endsOn: '',
      targetSeasonId: '',
    })
  }

  function startDuplicateEvent(eventRow: EventRow) {
    const nextOrder = String((eventsBySeason.get(eventRow.seasonId) ?? []).reduce((maxOrder, seasonEvent) => Math.max(maxOrder, seasonEvent.eventOrder), 0) + 1)

    setDuplicateDraft({
      mode: 'event',
      sourceId: eventRow.eventId,
      title: `${eventRow.eventOrder}. ${eventRow.name}`,
      name: `${eventRow.name} Copy`,
      year: '',
      eventOrder: nextOrder,
      startsOn: eventRow.startsOn ?? '',
      endsOn: eventRow.endsOn ?? '',
      targetSeasonId: eventRow.seasonId,
    })
  }

  async function submitDuplicate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!duplicateDraft) return

    setUpdatingKey(`duplicate-${duplicateDraft.mode}`)
    setError(null)
    setNotice(null)

    const { error: duplicateError } = duplicateDraft.mode === 'season'
      ? await supabase.rpc('duplicate_organizer_season', {
        p_source_season_id: duplicateDraft.sourceId,
        p_name: duplicateDraft.name || null,
        p_year: duplicateDraft.year ? Number(duplicateDraft.year) : null,
      })
      : await supabase.rpc('duplicate_organizer_event', {
        p_source_event_id: duplicateDraft.sourceId,
        p_target_season_id: duplicateDraft.targetSeasonId || null,
        p_name: duplicateDraft.name || null,
        p_event_order: duplicateDraft.eventOrder ? Number(duplicateDraft.eventOrder) : null,
        p_starts_on: duplicateDraft.startsOn || null,
        p_ends_on: duplicateDraft.endsOn || null,
      })

    if (duplicateError) {
      setError(duplicateError.message)
    } else {
      setDuplicateDraft(null)
      setNotice(duplicateDraft.mode === 'season' ? 'Season duplicated with events, rules, assets, and inspection templates.' : 'Event duplicated with races, rules, assets, and inspection templates.')
      await loadData()
    }

    setUpdatingKey(null)
  }

  async function saveCircuit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('circuit')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_circuit', {
      p_circuit_id: circuitForm.circuitId || null,
      p_name: circuitForm.name,
      p_location: circuitForm.location || null,
      p_country: circuitForm.country || 'Thailand',
    })

    await finishSave(error, circuitForm.circuitId ? 'Circuit updated.' : 'Circuit created.', () => setCircuitForm(createEmptyCircuitForm()))
    setUpdatingKey(null)
  }

  async function saveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('season')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_season', {
      p_season_id: seasonForm.seasonId || null,
      p_organization_id: seasonForm.organizationId || null,
      p_name: seasonForm.name,
      p_year: Number(seasonForm.year),
      p_status: seasonForm.status,
      p_is_active: seasonForm.isActive,
    })

    await finishSave(error, seasonForm.seasonId ? 'Season updated.' : 'Season created.', () => setSeasonForm(createEmptySeasonForm(payload.organizations[0]?.organizationId ?? '')))
    setUpdatingKey(null)
  }

  async function saveSeriesRace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('seriesRace')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_series_race', {
      p_series_race_id: seriesRaceForm.seriesRaceId || null,
      p_organization_id: seriesRaceForm.organizationId || null,
      p_code: seriesRaceForm.code,
      p_name: seriesRaceForm.name,
      p_ballast_type: seriesRaceForm.ballastType,
      p_is_active: seriesRaceForm.isActive,
    })

    await finishSave(error, seriesRaceForm.seriesRaceId ? 'Series Race updated.' : 'Series Race created.', () => setSeriesRaceForm(createEmptySeriesRaceForm(payload.organizations[0]?.organizationId ?? '')))
    setUpdatingKey(null)
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('grade')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_grade', {
      p_grade_id: gradeForm.gradeId || null,
      p_code: gradeForm.code,
      p_name: gradeForm.name,
      p_sort_order: Number(gradeForm.sortOrder),
    })

    await finishSave(error, gradeForm.gradeId ? 'Grade updated.' : 'Grade created.', () => setGradeForm(createEmptyGradeForm()))
    setUpdatingKey(null)
  }

  async function setSeasonSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('seasonSeries')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('set_organizer_season_series', {
      p_season_id: seasonSeriesForm.seasonId || null,
      p_series_race_id: seasonSeriesForm.seriesRaceId || null,
      p_is_active: seasonSeriesForm.isActive,
    })

    await finishSave(error, 'Season Series link saved.', () => setSeasonSeriesForm(createEmptySeasonSeriesForm(payload.seasons[0]?.seasonId ?? '', payload.seriesRaces[0]?.seriesRaceId ?? '')))
    setUpdatingKey(null)
  }

  async function setSeasonSeriesGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('seasonSeriesGrade')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('set_organizer_season_series_grade', {
      p_season_id: seasonSeriesGradeForm.seasonId || null,
      p_series_race_id: seasonSeriesGradeForm.seriesRaceId || null,
      p_grade_id: seasonSeriesGradeForm.gradeId || null,
      p_is_active: seasonSeriesGradeForm.isActive,
    })

    await finishSave(error, 'Season Grade link saved.', () => setSeasonSeriesGradeForm(createEmptySeasonSeriesGradeForm(payload.seasons[0]?.seasonId ?? '', payload.seriesRaces[0]?.seriesRaceId ?? '', payload.grades[0]?.gradeId ?? '')))
    setUpdatingKey(null)
  }

  async function saveEventSeriesRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('eventSeriesRule')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_event_series_rule', {
      p_event_series_rule_id: eventSeriesRuleForm.eventSeriesRuleId || null,
      p_event_id: eventSeriesRuleForm.eventId || null,
      p_series_race_id: eventSeriesRuleForm.seriesRaceId || null,
      p_grade_id: eventSeriesRuleForm.gradeId || null,
      p_status: eventSeriesRuleForm.status,
      p_version: Number(eventSeriesRuleForm.version),
      p_is_locked: eventSeriesRuleForm.isLocked,
      p_cloned_from_id: eventSeriesRuleForm.clonedFromId || null,
    })

    await finishSave(error, eventSeriesRuleForm.eventSeriesRuleId ? 'Event Rule updated.' : 'Event Rule created.', () => setEventSeriesRuleForm(createEmptyEventSeriesRuleForm(payload.events[0]?.eventId ?? '', payload.seriesRaces[0]?.seriesRaceId ?? '')))
    setUpdatingKey(null)
  }

  async function saveInspectionTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('inspectionTemplate')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_inspection_template_version', {
      p_template_id: inspectionTemplateForm.templateId || null,
      p_event_series_rule_id: inspectionTemplateForm.eventSeriesRuleId || null,
      p_name: inspectionTemplateForm.name,
      p_version: Number(inspectionTemplateForm.version),
      p_is_active: inspectionTemplateForm.isActive,
      p_clone_from_template_id: inspectionTemplateForm.cloneFromTemplateId || null,
    })

    await finishSave(error, inspectionTemplateForm.templateId ? 'Inspection template updated.' : 'Inspection template created.', () => setInspectionTemplateForm(createEmptyInspectionTemplateForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? '')))
    setUpdatingKey(null)
  }

  async function saveInspectionSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('inspectionSection')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_inspection_template_section', {
      p_section_id: inspectionSectionForm.sectionId || null,
      p_template_id: inspectionSectionForm.templateId || null,
      p_code: inspectionSectionForm.code,
      p_title: inspectionSectionForm.title,
      p_sort_order: Number(inspectionSectionForm.sortOrder),
      p_is_fixed: inspectionSectionForm.isFixed,
    })

    await finishSave(error, inspectionSectionForm.sectionId ? 'Inspection section updated.' : 'Inspection section created.', () => setInspectionSectionForm(createEmptyInspectionSectionForm(payload.inspectionTemplates[0]?.templateId ?? '')))
    setUpdatingKey(null)
  }

  async function saveInspectionItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('inspectionItem')
    setError(null)
    setNotice(null)

    let options: unknown[]
    try {
      const parsed = JSON.parse(inspectionItemForm.optionsText || '[]') as unknown
      if (!Array.isArray(parsed)) throw new Error('Options must be an array.')
      options = parsed
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Options must be valid JSON array.')
      setUpdatingKey(null)
      return
    }

    const { error } = await supabase.rpc('save_organizer_inspection_template_item', {
      p_item_id: inspectionItemForm.itemId || null,
      p_section_id: inspectionItemForm.sectionId || null,
      p_label_th: inspectionItemForm.labelTh,
      p_label_en: inspectionItemForm.labelEn || null,
      p_input_type: inspectionItemForm.inputType,
      p_options: options,
      p_weight_effect_type: inspectionItemForm.weightEffectType,
      p_fixed_weight_kg: inspectionItemForm.fixedWeightKg === '' ? null : Number(inspectionItemForm.fixedWeightKg),
      p_is_required: inspectionItemForm.isRequired,
      p_sort_order: Number(inspectionItemForm.sortOrder),
    })

    await finishSave(error, inspectionItemForm.itemId ? 'Inspection item updated.' : 'Inspection item created.', () => setInspectionItemForm(createEmptyInspectionItemForm(inspectionSections[0]?.sectionId ?? '')))
    setUpdatingKey(null)
  }

  async function saveWeightRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('weightRule')
    setError(null)
    setNotice(null)

    let additionalWeightRules: unknown[]

    try {
      const parsed = JSON.parse(weightRuleForm.additionalWeightRulesText || '[]') as unknown
      if (!Array.isArray(parsed)) throw new Error('Additional weight rules must be a JSON array.')
      additionalWeightRules = parsed
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Additional weight rules JSON is invalid.')
      setUpdatingKey(null)
      return
    }

    const { error } = await supabase.rpc('save_organizer_weight_rule', {
      p_weight_rule_id: weightRuleForm.weightRuleId || null,
      p_event_series_rule_id: weightRuleForm.eventSeriesRuleId || null,
      p_name: weightRuleForm.name,
      p_engine_min_cc: weightRuleForm.engineMinCc === '' ? null : Number(weightRuleForm.engineMinCc),
      p_engine_max_cc: weightRuleForm.engineMaxCc === '' ? null : Number(weightRuleForm.engineMaxCc),
      p_base_weight_kg: weightRuleForm.baseWeightKg === '' ? null : Number(weightRuleForm.baseWeightKg),
      p_additional_weight_rules: additionalWeightRules,
      p_is_active: weightRuleForm.isActive,
      p_sort_order: Number(weightRuleForm.sortOrder),
    })

    await finishSave(error, weightRuleForm.weightRuleId ? 'Weight rule updated.' : 'Weight rule created.', () => setWeightRuleForm(createEmptyWeightRuleForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? '')))
    setUpdatingKey(null)
  }

  async function saveBallastRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('ballastRule')
    setError(null)
    setNotice(null)

    let positionMatrix: Record<string, unknown>
    let removalRule: Record<string, unknown>

    try {
      positionMatrix = parseJsonObject(ballastRuleForm.positionMatrixText, 'Position matrix')
      removalRule = parseJsonObject(ballastRuleForm.removalRuleText, 'Removal rule')
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Ballast rule JSON is invalid.')
      setUpdatingKey(null)
      return
    }

    const { error } = await supabase.rpc('save_organizer_ballast_rule', {
      p_ballast_rule_id: ballastRuleForm.ballastRuleId || null,
      p_event_series_rule_id: ballastRuleForm.eventSeriesRuleId || null,
      p_ballast_type: ballastRuleForm.ballastType,
      p_max_ballast_kg: ballastRuleForm.maxBallastKg === '' ? null : Number(ballastRuleForm.maxBallastKg),
      p_join_weight_enabled: ballastRuleForm.joinWeightEnabled,
      p_position_matrix: positionMatrix,
      p_removal_rule: removalRule,
    })

    await finishSave(error, ballastRuleForm.ballastRuleId ? 'Ballast rule updated.' : 'Ballast rule created.', () => setBallastRuleForm(createEmptyBallastRuleForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? '')))
    setUpdatingKey(null)
  }

  async function saveTireRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('tireRule')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_tire_rule', {
      p_tire_rule_id: tireRuleForm.tireRuleId || null,
      p_event_series_rule_id: tireRuleForm.eventSeriesRuleId || null,
      p_tire_brand: tireRuleForm.tireBrand,
      p_tire_model: tireRuleForm.tireModel || null,
      p_is_allowed: tireRuleForm.isAllowed,
    })

    await finishSave(error, tireRuleForm.tireRuleId ? 'Tire rule updated.' : 'Tire rule created.', () => setTireRuleForm(createEmptyTireRuleForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? '')))
    setUpdatingKey(null)
  }

  async function saveSponsorStickerAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('sponsorStickerAsset')
    setError(null)
    setNotice(null)

    const selectedFile = sponsorStickerAssetForm.file
    let uploadedAsset: { path: string; filename: string; mimeType: string; sizeBytes: number } | null = null

    try {
      if (selectedFile) {
        uploadedAsset = await uploadSponsorStickerAsset(selectedFile, sponsorStickerAssetForm.eventSeriesRuleId)
      }

      const { error } = await supabase.rpc('save_organizer_sponsor_sticker_asset', {
        p_sponsor_sticker_asset_id: sponsorStickerAssetForm.sponsorStickerAssetId || null,
        p_event_series_rule_id: sponsorStickerAssetForm.eventSeriesRuleId || null,
        p_title: sponsorStickerAssetForm.title,
        p_path: uploadedAsset?.path ?? null,
        p_filename: uploadedAsset?.filename ?? null,
        p_mime_type: uploadedAsset?.mimeType ?? null,
        p_size_bytes: uploadedAsset?.sizeBytes ?? null,
      })

      await finishSave(error, sponsorStickerAssetForm.sponsorStickerAssetId ? 'Sponsor sticker updated.' : 'Sponsor sticker created.', () => setSponsorStickerAssetForm(createEmptySponsorStickerAssetForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? '')))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Sponsor sticker save failed.')
    }

    setUpdatingKey(null)
  }

  async function savePrintBackgroundAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('printBackgroundAsset')
    setError(null)
    setNotice(null)

    const selectedFile = printBackgroundAssetForm.file
    let uploadedAsset: { path: string; filename: string; mimeType: string; sizeBytes: number } | null = null

    try {
      if (selectedFile) {
        uploadedAsset = await uploadOrganizerAsset(selectedFile, `print-backgrounds/${printBackgroundAssetForm.eventId}`, ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'], 'Print background must be PNG, JPEG, WebP, or PDF.')
      }

      const { error } = await supabase.rpc('save_organizer_print_background_asset', {
        p_print_background_asset_id: printBackgroundAssetForm.printBackgroundAssetId || null,
        p_event_id: printBackgroundAssetForm.eventId || null,
        p_title: printBackgroundAssetForm.title,
        p_orientation: printBackgroundAssetForm.orientation,
        p_is_default: printBackgroundAssetForm.isDefault,
        p_path: uploadedAsset?.path ?? null,
        p_filename: uploadedAsset?.filename ?? null,
        p_mime_type: uploadedAsset?.mimeType ?? null,
        p_size_bytes: uploadedAsset?.sizeBytes ?? null,
      })

      await finishSave(error, printBackgroundAssetForm.printBackgroundAssetId ? 'A4 background updated.' : 'A4 background created.', () => setPrintBackgroundAssetForm(createEmptyPrintBackgroundAssetForm(payload.events[0]?.eventId ?? '')))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'A4 background save failed.')
    }

    setUpdatingKey(null)
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('event')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_event', {
      p_event_id: eventForm.eventId || null,
      p_season_id: eventForm.seasonId || null,
      p_circuit_id: eventForm.circuitId || null,
      p_name: eventForm.name,
      p_event_order: Number(eventForm.eventOrder),
      p_starts_on: eventForm.startsOn || null,
      p_ends_on: eventForm.endsOn || null,
      p_status: eventForm.status,
    })

    await finishSave(error, eventForm.eventId ? 'Event updated.' : 'Event created.', () => setEventForm(createEmptyEventForm(payload.seasons[0]?.seasonId ?? '', payload.circuits[0]?.circuitId ?? '')))
    setUpdatingKey(null)
  }

  async function saveRace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUpdatingKey('race')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('save_organizer_race', {
      p_race_id: raceForm.raceId || null,
      p_event_id: raceForm.eventId || null,
      p_name: raceForm.name,
      p_race_order: Number(raceForm.raceOrder),
      p_session_type: raceForm.sessionType || 'Race',
      p_scheduled_at: raceForm.scheduledAt ? new Date(raceForm.scheduledAt).toISOString() : null,
      p_results_import_unlocked: raceForm.resultsImportUnlocked,
    })

    await finishSave(error, raceForm.raceId ? 'Race updated.' : 'Race created.', () => setRaceForm(createEmptyRaceForm(payload.events[0]?.eventId ?? '')))
    setUpdatingKey(null)
  }

  async function finishSave(saveError: { message: string } | null, successMessage: string, resetForm: () => void) {
    if (saveError) {
      setError(saveError.message)
      return
    }

    resetForm()
    setNotice(successMessage)
    await loadData()
  }

  async function uploadSponsorStickerAsset(file: File, eventSeriesRuleId: string) {
    if (!eventSeriesRuleId) {
      throw new Error('Event Rule is required before uploading a sponsor sticker.')
    }

    return uploadOrganizerAsset(file, `sponsor-stickers/${eventSeriesRuleId}`, ['image/png', 'image/jpeg', 'image/webp'], 'Sponsor sticker must be PNG, JPEG, or WebP.')
  }

  async function uploadOrganizerAsset(file: File, folder: string, allowedMimeTypes: string[], invalidTypeMessage: string) {
    if (!folder) {
      throw new Error('Upload folder is required.')
    }

    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error(invalidTypeMessage)
    }

    const safeName = sanitizeFileName(file.name)
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('organizer_assets')
      .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' })

    if (uploadError) throw uploadError

    return {
      path,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }
  }

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-zinc-800"
      >
        <div className="border-l-2 border-primary pl-4">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Organizer control</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Organizer Settings</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Configure the official season calendar: circuits, seasons, events, and races. Series rules come after this foundation.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadData()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}

      {loading ? <OrganizerSkeleton /> : null}

      {!loading && !payload.canManage ? (
        <div className="mt-6 border border-red-200 bg-red-500/10 p-5 text-red-700 dark:border-red-900/60 dark:text-red-400">
          Admin role is required to manage organizer settings.
        </div>
      ) : null}

      {!loading && payload.canManage ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(18rem,24rem)_1fr]">
          <div className="grid content-start gap-5">
            <SettingsFocusPanel
              editors={settingsEditors}
              activeEditor={activeEditor}
              activeEditorMeta={activeEditorMeta}
              readiness={readiness}
              phaseSummaries={phaseSummaries}
              onSelect={openEditor}
            />

            <SettingsEditorDrawer
              open={editorOpen}
              activeEditorMeta={activeEditorMeta}
              onClose={() => setEditorOpen(false)}
            >
            <SettingsForm active={activeEditor === 'circuit'} editorKey="circuit" title="Circuit" icon={MapPinned} onSubmit={saveCircuit} updating={updatingKey === 'circuit'} buttonLabel={circuitForm.circuitId ? 'Update Circuit' : 'Create Circuit'}>
              <TextField label="Circuit name" value={circuitForm.name} onChange={(name) => setCircuitForm((current) => ({ ...current, name }))} placeholder="Chang International Circuit" />
              <TextField label="Location" value={circuitForm.location} onChange={(location) => setCircuitForm((current) => ({ ...current, location }))} placeholder="Buriram" />
              <TextField label="Country" value={circuitForm.country} onChange={(country) => setCircuitForm((current) => ({ ...current, country }))} placeholder="Thailand" />
              <EntitySelect
                label="Edit existing circuit"
                value={circuitForm.circuitId}
                emptyLabel="Create new circuit"
                options={payload.circuits.map((circuit) => ({ value: circuit.circuitId, label: circuit.name }))}
                onChange={(circuitId) => setCircuitForm(circuitId ? createCircuitForm(payload.circuits.find((circuit) => circuit.circuitId === circuitId) ?? null) : createEmptyCircuitForm())}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'season'} editorKey="season" title="Season" icon={CalendarDays} onSubmit={saveSeason} updating={updatingKey === 'season'} buttonLabel={seasonForm.seasonId ? 'Update Season' : 'Create Season'}>
              <EntitySelect
                label="Organization"
                value={seasonForm.organizationId}
                options={payload.organizations.map((organization) => ({ value: organization.organizationId, label: organization.name }))}
                onChange={(organizationId) => setSeasonForm((current) => ({ ...current, organizationId }))}
              />
              <TextField label="Season name" value={seasonForm.name} onChange={(name) => setSeasonForm((current) => ({ ...current, name }))} placeholder="2026 Season" />
              <TextField label="Year" type="number" value={seasonForm.year} onChange={(year) => setSeasonForm((current) => ({ ...current, year }))} placeholder="2026" />
              <EntitySelect label="Status" value={seasonForm.status} options={seasonStatuses.map((status) => ({ value: status, label: status }))} onChange={(status) => setSeasonForm((current) => ({ ...current, status: status as SeasonStatus }))} />
              <CheckboxField label="Set as active season" checked={seasonForm.isActive} onChange={(isActive) => setSeasonForm((current) => ({ ...current, isActive }))} />
              <EntitySelect
                label="Edit existing season"
                value={seasonForm.seasonId}
                emptyLabel="Create new season"
                options={payload.seasons.map((season) => ({ value: season.seasonId, label: `${season.year} / ${season.name}` }))}
                onChange={(seasonId) => setSeasonForm(seasonId ? createSeasonForm(payload.seasons.find((season) => season.seasonId === seasonId) ?? null) : createEmptySeasonForm(payload.organizations[0]?.organizationId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'seriesRace'} editorKey="seriesRace" title="Series Race" icon={Trophy} onSubmit={saveSeriesRace} updating={updatingKey === 'seriesRace'} buttonLabel={seriesRaceForm.seriesRaceId ? 'Update Series' : 'Create Series'}>
              <EntitySelect
                label="Organization"
                value={seriesRaceForm.organizationId}
                options={payload.organizations.map((organization) => ({ value: organization.organizationId, label: organization.name }))}
                onChange={(organizationId) => setSeriesRaceForm((current) => ({ ...current, organizationId }))}
              />
              <TextField label="Series code" value={seriesRaceForm.code} onChange={(code) => setSeriesRaceForm((current) => ({ ...current, code }))} placeholder="SIAM_ECO" />
              <TextField label="Series name" value={seriesRaceForm.name} onChange={(name) => setSeriesRaceForm((current) => ({ ...current, name }))} placeholder="Siam Eco Series" />
              <EntitySelect label="Ballast type" value={seriesRaceForm.ballastType} options={ballastTypes.map((ballastType) => ({ value: ballastType, label: ballastType }))} onChange={(ballastType) => setSeriesRaceForm((current) => ({ ...current, ballastType: ballastType as BallastType }))} />
              <CheckboxField label="Series Race is active" checked={seriesRaceForm.isActive} onChange={(isActive) => setSeriesRaceForm((current) => ({ ...current, isActive }))} />
              <EntitySelect
                label="Edit existing series"
                value={seriesRaceForm.seriesRaceId}
                emptyLabel="Create new series"
                options={payload.seriesRaces.map((seriesRace) => ({ value: seriesRace.seriesRaceId, label: `${seriesRace.code} / ${seriesRace.name}` }))}
                onChange={(seriesRaceId) => setSeriesRaceForm(seriesRaceId ? createSeriesRaceForm(payload.seriesRaces.find((seriesRace) => seriesRace.seriesRaceId === seriesRaceId) ?? null) : createEmptySeriesRaceForm(payload.organizations[0]?.organizationId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'grade'} editorKey="grade" title="Grade" icon={Layers3} onSubmit={saveGrade} updating={updatingKey === 'grade'} buttonLabel={gradeForm.gradeId ? 'Update Grade' : 'Create Grade'}>
              <TextField label="Grade code" value={gradeForm.code} onChange={(code) => setGradeForm((current) => ({ ...current, code }))} placeholder="PRO" />
              <TextField label="Grade name" value={gradeForm.name} onChange={(name) => setGradeForm((current) => ({ ...current, name }))} placeholder="Professional" />
              <TextField label="Sort order" type="number" value={gradeForm.sortOrder} onChange={(sortOrder) => setGradeForm((current) => ({ ...current, sortOrder }))} placeholder="1" />
              <EntitySelect
                label="Edit existing grade"
                value={gradeForm.gradeId}
                emptyLabel="Create new grade"
                options={payload.grades.map((grade) => ({ value: grade.gradeId, label: `${grade.sortOrder}. ${grade.code} / ${grade.name}` }))}
                onChange={(gradeId) => setGradeForm(gradeId ? createGradeForm(payload.grades.find((grade) => grade.gradeId === gradeId) ?? null) : createEmptyGradeForm())}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'seasonSeries'} editorKey="seasonSeries" title="Season Series" icon={Trophy} onSubmit={setSeasonSeries} updating={updatingKey === 'seasonSeries'} buttonLabel="Save Season Series">
              <EntitySelect label="Season" value={seasonSeriesForm.seasonId} options={payload.seasons.map((season) => ({ value: season.seasonId, label: `${season.year} / ${season.name}` }))} onChange={(seasonId) => setSeasonSeriesForm((current) => ({ ...current, seasonId }))} />
              <EntitySelect label="Series Race" value={seasonSeriesForm.seriesRaceId} options={payload.seriesRaces.map((seriesRace) => ({ value: seriesRace.seriesRaceId, label: `${seriesRace.code} / ${seriesRace.name}` }))} onChange={(seriesRaceId) => setSeasonSeriesForm((current) => ({ ...current, seriesRaceId }))} />
              <CheckboxField label="Activate this series in selected season" checked={seasonSeriesForm.isActive} onChange={(isActive) => setSeasonSeriesForm((current) => ({ ...current, isActive }))} />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'seasonSeriesGrade'} editorKey="seasonSeriesGrade" title="Season Grade" icon={Layers3} onSubmit={setSeasonSeriesGrade} updating={updatingKey === 'seasonSeriesGrade'} buttonLabel="Save Season Grade">
              <EntitySelect label="Season" value={seasonSeriesGradeForm.seasonId} options={payload.seasons.map((season) => ({ value: season.seasonId, label: `${season.year} / ${season.name}` }))} onChange={(seasonId) => setSeasonSeriesGradeForm((current) => ({ ...current, seasonId }))} />
              <EntitySelect label="Series Race" value={seasonSeriesGradeForm.seriesRaceId} options={payload.seriesRaces.map((seriesRace) => ({ value: seriesRace.seriesRaceId, label: `${seriesRace.code} / ${seriesRace.name}` }))} onChange={(seriesRaceId) => setSeasonSeriesGradeForm((current) => ({ ...current, seriesRaceId }))} />
              <EntitySelect label="Grade" value={seasonSeriesGradeForm.gradeId} options={payload.grades.map((grade) => ({ value: grade.gradeId, label: `${grade.code} / ${grade.name}` }))} onChange={(gradeId) => setSeasonSeriesGradeForm((current) => ({ ...current, gradeId }))} />
              <CheckboxField label="Activate this grade for selected season series" checked={seasonSeriesGradeForm.isActive} onChange={(isActive) => setSeasonSeriesGradeForm((current) => ({ ...current, isActive }))} />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'eventSeriesRule'} editorKey="eventSeriesRule" title="Event Rule" icon={ClipboardList} onSubmit={saveEventSeriesRule} updating={updatingKey === 'eventSeriesRule'} buttonLabel={eventSeriesRuleForm.eventSeriesRuleId ? 'Update Event Rule' : 'Create Event Rule'}>
              <EntitySelect label="Event" value={eventSeriesRuleForm.eventId} options={payload.events.map((event) => ({ value: event.eventId, label: `${event.eventOrder}. ${event.name}` }))} onChange={(eventId) => setEventSeriesRuleForm((current) => ({ ...current, eventId }))} />
              <EntitySelect label="Series Race" value={eventSeriesRuleForm.seriesRaceId} options={payload.seriesRaces.map((seriesRace) => ({ value: seriesRace.seriesRaceId, label: `${seriesRace.code} / ${seriesRace.name}` }))} onChange={(seriesRaceId) => setEventSeriesRuleForm((current) => ({ ...current, seriesRaceId, gradeId: '' }))} />
              <EntitySelect label="Grade" value={eventSeriesRuleForm.gradeId} options={eventRuleGradeOptions.map((grade) => ({ value: grade.gradeId, label: `${grade.code} / ${grade.name}` }))} onChange={(gradeId) => setEventSeriesRuleForm((current) => ({ ...current, gradeId }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <EntitySelect label="Rule status" value={eventSeriesRuleForm.status} options={ruleStatuses.map((status) => ({ value: status, label: status }))} onChange={(status) => setEventSeriesRuleForm((current) => ({ ...current, status: status as RuleStatus, isLocked: status === 'Locked' ? true : current.isLocked }))} />
                <TextField label="Version" type="number" value={eventSeriesRuleForm.version} onChange={(version) => setEventSeriesRuleForm((current) => ({ ...current, version }))} placeholder="1" />
              </div>
              <CheckboxField label="Lock this Event Rule after save" checked={eventSeriesRuleForm.isLocked} onChange={(isLocked) => setEventSeriesRuleForm((current) => ({ ...current, isLocked, status: isLocked ? 'Locked' : current.status }))} />
              <EntitySelect
                label="Clone reference"
                value={eventSeriesRuleForm.clonedFromId}
                emptyLabel="No clone reference"
                options={payload.eventSeriesRules.map((rule) => ({ value: rule.eventSeriesRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / v${rule.version}` }))}
                onChange={(clonedFromId) => setEventSeriesRuleForm((current) => ({ ...current, clonedFromId }))}
              />
              <EntitySelect
                label="Edit existing Event Rule"
                value={eventSeriesRuleForm.eventSeriesRuleId}
                emptyLabel="Create new Event Rule"
                options={payload.eventSeriesRules.map((rule) => ({ value: rule.eventSeriesRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / v${rule.version}` }))}
                onChange={(eventSeriesRuleId) => setEventSeriesRuleForm(eventSeriesRuleId ? createEventSeriesRuleForm(payload.eventSeriesRules.find((rule) => rule.eventSeriesRuleId === eventSeriesRuleId) ?? null) : createEmptyEventSeriesRuleForm(payload.events[0]?.eventId ?? '', payload.seriesRaces[0]?.seriesRaceId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'inspectionTemplate'} editorKey="inspectionTemplate" title="Inspection Template" icon={ClipboardList} onSubmit={saveInspectionTemplate} updating={updatingKey === 'inspectionTemplate'} buttonLabel={inspectionTemplateForm.templateId ? 'Update Template' : 'Create Template'}>
              <EntitySelect
                label="Event Rule"
                value={inspectionTemplateForm.eventSeriesRuleId}
                options={payload.eventSeriesRules.map((rule) => ({ value: rule.eventSeriesRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / v${rule.version}` }))}
                onChange={(eventSeriesRuleId) => setInspectionTemplateForm((current) => ({ ...current, eventSeriesRuleId }))}
              />
              <TextField label="Template name" value={inspectionTemplateForm.name} onChange={(name) => setInspectionTemplateForm((current) => ({ ...current, name }))} placeholder="Baseline Trackside Inspection" />
              <TextField label="Version" type="number" value={inspectionTemplateForm.version} onChange={(version) => setInspectionTemplateForm((current) => ({ ...current, version }))} placeholder="1" />
              <CheckboxField label="Set as active template for this Event Rule" checked={inspectionTemplateForm.isActive} onChange={(isActive) => setInspectionTemplateForm((current) => ({ ...current, isActive }))} />
              <EntitySelect
                label="Clone from template"
                value={inspectionTemplateForm.cloneFromTemplateId}
                emptyLabel="No clone source"
                options={payload.inspectionTemplates.map((template) => ({ value: template.templateId, label: `${template.eventName} / ${template.seriesName} / ${template.gradeName} / v${template.version}` }))}
                onChange={(cloneFromTemplateId) => setInspectionTemplateForm((current) => ({ ...current, cloneFromTemplateId }))}
              />
              <EntitySelect
                label="Edit existing template"
                value={inspectionTemplateForm.templateId}
                emptyLabel="Create new template"
                options={payload.inspectionTemplates.map((template) => ({ value: template.templateId, label: `${template.name} / ${template.seriesName} / ${template.gradeName} / v${template.version}` }))}
                onChange={(templateId) => setInspectionTemplateForm(templateId ? createInspectionTemplateForm(payload.inspectionTemplates.find((template) => template.templateId === templateId) ?? null) : createEmptyInspectionTemplateForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'inspectionSection'} editorKey="inspectionSection" title="Inspection Section" icon={Layers3} onSubmit={saveInspectionSection} updating={updatingKey === 'inspectionSection'} buttonLabel={inspectionSectionForm.sectionId ? 'Update Section' : 'Create Section'}>
              <EntitySelect label="Template" value={inspectionSectionForm.templateId} options={payload.inspectionTemplates.map((template) => ({ value: template.templateId, label: `${template.name} / ${template.seriesName} / ${template.gradeName} / v${template.version}` }))} onChange={(templateId) => setInspectionSectionForm((current) => ({ ...current, templateId }))} />
              <TextField label="Section code" value={inspectionSectionForm.code} onChange={(code) => setInspectionSectionForm((current) => ({ ...current, code }))} placeholder="safety" />
              <TextField label="Section title" value={inspectionSectionForm.title} onChange={(title) => setInspectionSectionForm((current) => ({ ...current, title }))} placeholder="Safety" />
              <TextField label="Sort order" type="number" value={inspectionSectionForm.sortOrder} onChange={(sortOrder) => setInspectionSectionForm((current) => ({ ...current, sortOrder }))} placeholder="10" />
              <CheckboxField label="Fixed baseline section" checked={inspectionSectionForm.isFixed} onChange={(isFixed) => setInspectionSectionForm((current) => ({ ...current, isFixed }))} />
              <EntitySelect
                label="Edit existing section"
                value={inspectionSectionForm.sectionId}
                emptyLabel="Create new section"
                options={inspectionSections.map((section) => ({ value: section.sectionId, label: `${section.sortOrder}. ${section.title}` }))}
                onChange={(sectionId) => setInspectionSectionForm(sectionId ? createInspectionSectionForm(inspectionSections.find((section) => section.sectionId === sectionId) ?? null) : createEmptyInspectionSectionForm(payload.inspectionTemplates[0]?.templateId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'inspectionItem'} editorKey="inspectionItem" title="Inspection Item" icon={Wrench} onSubmit={saveInspectionItem} updating={updatingKey === 'inspectionItem'} buttonLabel={inspectionItemForm.itemId ? 'Update Item' : 'Create Item'}>
              <EntitySelect label="Section" value={inspectionItemForm.sectionId} options={inspectionSections.map((section) => ({ value: section.sectionId, label: `${section.title} / ${section.code}` }))} onChange={(sectionId) => setInspectionItemForm((current) => ({ ...current, sectionId }))} />
              <TextField label="Label TH" value={inspectionItemForm.labelTh} onChange={(labelTh) => setInspectionItemForm((current) => ({ ...current, labelTh }))} placeholder="น้ำหนัก BOP พื้นฐาน" />
              <TextField label="Label EN" value={inspectionItemForm.labelEn} onChange={(labelEn) => setInspectionItemForm((current) => ({ ...current, labelEn }))} placeholder="Base BOP weight" />
              <div className="grid gap-3 sm:grid-cols-2">
                <EntitySelect label="Input type" value={inspectionItemForm.inputType} options={inspectionInputTypes.map((inputType) => ({ value: inputType, label: inputType }))} onChange={(inputType) => setInspectionItemForm((current) => ({ ...current, inputType: inputType as InspectionInputType }))} />
                <EntitySelect label="Weight effect" value={inspectionItemForm.weightEffectType} options={weightEffectTypes.map((effectType) => ({ value: effectType, label: effectType }))} onChange={(weightEffectType) => setInspectionItemForm((current) => ({ ...current, weightEffectType: weightEffectType as WeightEffectType }))} />
              </div>
              <TextField label="Fixed weight kg" type="number" value={inspectionItemForm.fixedWeightKg} onChange={(fixedWeightKg) => setInspectionItemForm((current) => ({ ...current, fixedWeightKg }))} placeholder="0.00" />
              <TextAreaField label="Options JSON array" value={inspectionItemForm.optionsText} onChange={(optionsText) => setInspectionItemForm((current) => ({ ...current, optionsText }))} placeholder='["Yes", "No"]' />
              <TextField label="Sort order" type="number" value={inspectionItemForm.sortOrder} onChange={(sortOrder) => setInspectionItemForm((current) => ({ ...current, sortOrder }))} placeholder="10" />
              <CheckboxField label="Required item" checked={inspectionItemForm.isRequired} onChange={(isRequired) => setInspectionItemForm((current) => ({ ...current, isRequired }))} />
              <EntitySelect
                label="Edit existing item"
                value={inspectionItemForm.itemId}
                emptyLabel="Create new item"
                options={inspectionItems.map((item) => ({ value: item.itemId, label: `${item.sortOrder}. ${item.labelTh}` }))}
                onChange={(itemId) => setInspectionItemForm(itemId ? createInspectionItemForm(inspectionItems.find((item) => item.itemId === itemId) ?? null) : createEmptyInspectionItemForm(inspectionSections[0]?.sectionId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'weightRule'} editorKey="weightRule" title="Weight Rule" icon={Scale} onSubmit={saveWeightRule} updating={updatingKey === 'weightRule'} buttonLabel={weightRuleForm.weightRuleId ? 'Update Weight Rule' : 'Create Weight Rule'}>
              <EntitySelect
                label="Event Rule"
                value={weightRuleForm.eventSeriesRuleId}
                options={payload.eventSeriesRules.map((rule) => ({ value: rule.eventSeriesRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / v${rule.version}` }))}
                onChange={(eventSeriesRuleId) => setWeightRuleForm((current) => ({ ...current, eventSeriesRuleId }))}
              />
              <TextField label="Rule name" value={weightRuleForm.name} onChange={(name) => setWeightRuleForm((current) => ({ ...current, name }))} placeholder="1,500 cc baseline" />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Engine min cc" type="number" value={weightRuleForm.engineMinCc} onChange={(engineMinCc) => setWeightRuleForm((current) => ({ ...current, engineMinCc }))} placeholder="0" />
                <TextField label="Engine max cc" type="number" value={weightRuleForm.engineMaxCc} onChange={(engineMaxCc) => setWeightRuleForm((current) => ({ ...current, engineMaxCc }))} placeholder="1500" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Base weight kg" type="number" value={weightRuleForm.baseWeightKg} onChange={(baseWeightKg) => setWeightRuleForm((current) => ({ ...current, baseWeightKg }))} placeholder="950" />
                <TextField label="Sort order" type="number" value={weightRuleForm.sortOrder} onChange={(sortOrder) => setWeightRuleForm((current) => ({ ...current, sortOrder }))} placeholder="10" />
              </div>
              <TextAreaField label="Additional weight rules JSON array" value={weightRuleForm.additionalWeightRulesText} onChange={(additionalWeightRulesText) => setWeightRuleForm((current) => ({ ...current, additionalWeightRulesText }))} placeholder='[{"code":"turbo","label":"Turbo","weightKg":30}]' />
              <CheckboxField label="Weight rule is active" checked={weightRuleForm.isActive} onChange={(isActive) => setWeightRuleForm((current) => ({ ...current, isActive }))} />
              <EntitySelect
                label="Edit existing weight rule"
                value={weightRuleForm.weightRuleId}
                emptyLabel="Create new weight rule"
                options={payload.weightRules.map((rule) => ({ value: rule.weightRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / ${rule.name}` }))}
                onChange={(weightRuleId) => setWeightRuleForm(weightRuleId ? createWeightRuleForm(payload.weightRules.find((rule) => rule.weightRuleId === weightRuleId) ?? null) : createEmptyWeightRuleForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'ballastRule'} editorKey="ballastRule" title="Success Ballast" icon={Trophy} onSubmit={saveBallastRule} updating={updatingKey === 'ballastRule'} buttonLabel={ballastRuleForm.ballastRuleId ? 'Update Ballast Rule' : 'Create Ballast Rule'}>
              <EntitySelect
                label="Event Rule"
                value={ballastRuleForm.eventSeriesRuleId}
                options={payload.eventSeriesRules.map((rule) => ({ value: rule.eventSeriesRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / v${rule.version}` }))}
                onChange={(eventSeriesRuleId) => setBallastRuleForm((current) => ({ ...current, eventSeriesRuleId }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <EntitySelect label="Ballast type" value={ballastRuleForm.ballastType} options={ballastTypes.map((ballastType) => ({ value: ballastType, label: ballastType }))} onChange={(ballastType) => setBallastRuleForm((current) => ({ ...current, ballastType: ballastType as BallastType }))} />
                <TextField label="Maximum ballast kg" type="number" value={ballastRuleForm.maxBallastKg} onChange={(maxBallastKg) => setBallastRuleForm((current) => ({ ...current, maxBallastKg }))} placeholder="80" />
              </div>
              <CheckboxField label="Allow join weight ledger for this rule" checked={ballastRuleForm.joinWeightEnabled} onChange={(joinWeightEnabled) => setBallastRuleForm((current) => ({ ...current, joinWeightEnabled }))} />
              <TextAreaField label="Position matrix JSON" value={ballastRuleForm.positionMatrixText} onChange={(positionMatrixText) => setBallastRuleForm((current) => ({ ...current, positionMatrixText }))} placeholder='{"1": 30, "2": 20, "3": 10}' />
              <TextAreaField label="Removal rule JSON" value={ballastRuleForm.removalRuleText} onChange={(removalRuleText) => setBallastRuleForm((current) => ({ ...current, removalRuleText }))} placeholder='{"note": "Future rule for ballast removal"}' />
              <EntitySelect
                label="Edit existing ballast rule"
                value={ballastRuleForm.ballastRuleId}
                emptyLabel="Create new ballast rule"
                options={payload.ballastRules.map((rule) => ({ value: rule.ballastRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / ${rule.ballastType}` }))}
                onChange={(ballastRuleId) => setBallastRuleForm(ballastRuleId ? createBallastRuleForm(payload.ballastRules.find((rule) => rule.ballastRuleId === ballastRuleId) ?? null) : createEmptyBallastRuleForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'tireRule'} editorKey="tireRule" title="Tire Rule" icon={Wrench} onSubmit={saveTireRule} updating={updatingKey === 'tireRule'} buttonLabel={tireRuleForm.tireRuleId ? 'Update Tire Rule' : 'Create Tire Rule'}>
              <EntitySelect
                label="Event Rule"
                value={tireRuleForm.eventSeriesRuleId}
                options={payload.eventSeriesRules.map((rule) => ({ value: rule.eventSeriesRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / v${rule.version}` }))}
                onChange={(eventSeriesRuleId) => setTireRuleForm((current) => ({ ...current, eventSeriesRuleId }))}
              />
              <TextField label="Tire brand" value={tireRuleForm.tireBrand} onChange={(tireBrand) => setTireRuleForm((current) => ({ ...current, tireBrand }))} placeholder="Yokohama" />
              <TextField label="Tire model" value={tireRuleForm.tireModel} onChange={(tireModel) => setTireRuleForm((current) => ({ ...current, tireModel }))} placeholder="A050 (optional)" />
              <CheckboxField label="Allowed for this Event Rule" checked={tireRuleForm.isAllowed} onChange={(isAllowed) => setTireRuleForm((current) => ({ ...current, isAllowed }))} />
              <EntitySelect
                label="Edit existing tire rule"
                value={tireRuleForm.tireRuleId}
                emptyLabel="Create new tire rule"
                options={payload.tireRules.map((rule) => ({ value: rule.tireRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / ${rule.tireBrand}${rule.tireModel ? ` ${rule.tireModel}` : ''} / ${rule.isAllowed ? 'Allowed' : 'Disallowed'}` }))}
                onChange={(tireRuleId) => setTireRuleForm(tireRuleId ? createTireRuleForm(payload.tireRules.find((rule) => rule.tireRuleId === tireRuleId) ?? null) : createEmptyTireRuleForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'sponsorStickerAsset'} editorKey="sponsorStickerAsset" title="Sponsor Sticker" icon={Image} onSubmit={saveSponsorStickerAsset} updating={updatingKey === 'sponsorStickerAsset'} buttonLabel={sponsorStickerAssetForm.sponsorStickerAssetId ? 'Update Sponsor Sticker' : 'Create Sponsor Sticker'}>
              <EntitySelect
                label="Event Rule"
                value={sponsorStickerAssetForm.eventSeriesRuleId}
                options={payload.eventSeriesRules.map((rule) => ({ value: rule.eventSeriesRuleId, label: `${rule.eventName} / ${rule.seriesName} / ${rule.gradeName} / v${rule.version}` }))}
                onChange={(eventSeriesRuleId) => setSponsorStickerAssetForm((current) => ({ ...current, eventSeriesRuleId }))}
              />
              <TextField label="Sticker title" value={sponsorStickerAssetForm.title} onChange={(title) => setSponsorStickerAssetForm((current) => ({ ...current, title }))} placeholder="Door sponsor sticker" />
              <FileField
                label="Sticker image"
                accept="image/png,image/jpeg,image/webp"
                helperText={sponsorStickerAssetForm.sponsorStickerAssetId ? 'Choose a new image only if replacing the existing sticker file.' : 'PNG, JPEG, or WebP. Maximum 10 MB.'}
                onChange={(file) => setSponsorStickerAssetForm((current) => ({ ...current, file }))}
              />
              {sponsorStickerAssetForm.existingFilename ? (
                <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <p className="font-medium">Current file</p>
                  <p className="mt-1 break-all font-mono text-xs text-zinc-500">{sponsorStickerAssetForm.existingFilename}</p>
                  <p className="mt-1 break-all font-mono text-xs text-zinc-500">{sponsorStickerAssetForm.existingPath}</p>
                </div>
              ) : null}
              <EntitySelect
                label="Edit existing sponsor sticker"
                value={sponsorStickerAssetForm.sponsorStickerAssetId}
                emptyLabel="Create new sponsor sticker"
                options={payload.sponsorStickerAssets.map((asset) => ({ value: asset.sponsorStickerAssetId, label: `${asset.eventName} / ${asset.seriesName} / ${asset.gradeName} / ${asset.title}` }))}
                onChange={(sponsorStickerAssetId) => setSponsorStickerAssetForm(sponsorStickerAssetId ? createSponsorStickerAssetForm(payload.sponsorStickerAssets.find((asset) => asset.sponsorStickerAssetId === sponsorStickerAssetId) ?? null) : createEmptySponsorStickerAssetForm(payload.eventSeriesRules[0]?.eventSeriesRuleId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'printBackgroundAsset'} editorKey="printBackgroundAsset" title="A4 Background" icon={Image} onSubmit={savePrintBackgroundAsset} updating={updatingKey === 'printBackgroundAsset'} buttonLabel={printBackgroundAssetForm.printBackgroundAssetId ? 'Update A4 Background' : 'Create A4 Background'}>
              <EntitySelect
                label="Event"
                value={printBackgroundAssetForm.eventId}
                options={payload.events.map((event) => ({ value: event.eventId, label: `${event.eventOrder}. ${event.name}` }))}
                onChange={(eventId) => setPrintBackgroundAssetForm((current) => ({ ...current, eventId }))}
              />
              <TextField label="Background title" value={printBackgroundAssetForm.title} onChange={(title) => setPrintBackgroundAssetForm((current) => ({ ...current, title }))} placeholder="Official A4 entry background" />
              <EntitySelect
                label="A4 layout"
                value={printBackgroundAssetForm.orientation}
                options={[
                  { value: 'portrait', label: 'Portrait A4' },
                  { value: 'landscape', label: 'Landscape A4' },
                ]}
                onChange={(orientation) => setPrintBackgroundAssetForm((current) => ({ ...current, orientation: orientation as PrintBackgroundAssetForm['orientation'] }))}
              />
              <CheckboxField label="Use as default for this Event and A4 layout" checked={printBackgroundAssetForm.isDefault} onChange={(isDefault) => setPrintBackgroundAssetForm((current) => ({ ...current, isDefault }))} />
              <FileField
                label="Background file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                helperText={printBackgroundAssetForm.printBackgroundAssetId ? 'Choose a new file only if replacing the existing A4 background.' : 'PNG, JPEG, WebP, or PDF. Maximum 10 MB.'}
                onChange={(file) => setPrintBackgroundAssetForm((current) => ({ ...current, file }))}
              />
              {printBackgroundAssetForm.existingFilename ? (
                <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <p className="font-medium">Current file</p>
                  <p className="mt-1 break-all font-mono text-xs text-zinc-500">{printBackgroundAssetForm.existingFilename}</p>
                  <p className="mt-1 break-all font-mono text-xs text-zinc-500">{printBackgroundAssetForm.existingPath}</p>
                </div>
              ) : null}
              <EntitySelect
                label="Edit existing A4 background"
                value={printBackgroundAssetForm.printBackgroundAssetId}
                emptyLabel="Create new A4 background"
                options={payload.printBackgroundAssets.map((asset) => ({ value: asset.printBackgroundAssetId, label: `${asset.eventName} / ${formatOrientation(asset.orientation)} / ${asset.title}${asset.isDefault ? ' / Default' : ''}` }))}
                onChange={(printBackgroundAssetId) => setPrintBackgroundAssetForm(printBackgroundAssetId ? createPrintBackgroundAssetForm(payload.printBackgroundAssets.find((asset) => asset.printBackgroundAssetId === printBackgroundAssetId) ?? null) : createEmptyPrintBackgroundAssetForm(payload.events[0]?.eventId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'event'} editorKey="event" title="Event" icon={Flag} onSubmit={saveEvent} updating={updatingKey === 'event'} buttonLabel={eventForm.eventId ? 'Update Event' : 'Create Event'}>
              <EntitySelect label="Season" value={eventForm.seasonId} options={payload.seasons.map((season) => ({ value: season.seasonId, label: `${season.year} / ${season.name}` }))} onChange={(seasonId) => setEventForm((current) => ({ ...current, seasonId }))} />
              <EntitySelect label="Circuit" value={eventForm.circuitId} emptyLabel="No circuit" options={payload.circuits.map((circuit) => ({ value: circuit.circuitId, label: circuit.name }))} onChange={(circuitId) => setEventForm((current) => ({ ...current, circuitId }))} />
              <TextField label="Event name" value={eventForm.name} onChange={(name) => setEventForm((current) => ({ ...current, name }))} placeholder="Event 1" />
              <TextField label="Event order" type="number" value={eventForm.eventOrder} onChange={(eventOrder) => setEventForm((current) => ({ ...current, eventOrder }))} placeholder="1" />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Starts on" type="date" value={eventForm.startsOn} onChange={(startsOn) => setEventForm((current) => ({ ...current, startsOn }))} />
                <TextField label="Ends on" type="date" value={eventForm.endsOn} onChange={(endsOn) => setEventForm((current) => ({ ...current, endsOn }))} />
              </div>
              <EntitySelect label="Status" value={eventForm.status} options={eventStatuses.map((status) => ({ value: status, label: status }))} onChange={(status) => setEventForm((current) => ({ ...current, status: status as EventStatus }))} />
              <EntitySelect
                label="Edit existing event"
                value={eventForm.eventId}
                emptyLabel="Create new event"
                options={payload.events.map((event) => ({ value: event.eventId, label: `${event.eventOrder}. ${event.name}` }))}
                onChange={(eventId) => setEventForm(eventId ? createEventForm(payload.events.find((event) => event.eventId === eventId) ?? null) : createEmptyEventForm(payload.seasons[0]?.seasonId ?? '', payload.circuits[0]?.circuitId ?? ''))}
              />
            </SettingsForm>

            <SettingsForm active={activeEditor === 'race'} editorKey="race" title="Race" icon={Wrench} onSubmit={saveRace} updating={updatingKey === 'race'} buttonLabel={raceForm.raceId ? 'Update Race' : 'Create Race'}>
              <EntitySelect label="Event" value={raceForm.eventId} options={payload.events.map((event) => ({ value: event.eventId, label: `${event.eventOrder}. ${event.name}` }))} onChange={(eventId) => setRaceForm((current) => ({ ...current, eventId }))} />
              <TextField label="Race name" value={raceForm.name} onChange={(name) => setRaceForm((current) => ({ ...current, name }))} placeholder="Race 1" />
              <TextField label="Race order" type="number" value={raceForm.raceOrder} onChange={(raceOrder) => setRaceForm((current) => ({ ...current, raceOrder }))} placeholder="1" />
              <EntitySelect label="Session type" value={raceForm.sessionType} options={sessionTypes.map((sessionType) => ({ value: sessionType, label: sessionType }))} onChange={(sessionType) => setRaceForm((current) => ({ ...current, sessionType }))} />
              <TextField label="Scheduled at" type="datetime-local" value={raceForm.scheduledAt} onChange={(scheduledAt) => setRaceForm((current) => ({ ...current, scheduledAt }))} />
              <CheckboxField label="Unlock results import for this race" checked={raceForm.resultsImportUnlocked} onChange={(resultsImportUnlocked) => setRaceForm((current) => ({ ...current, resultsImportUnlocked }))} />
              <EntitySelect
                label="Edit existing race"
                value={raceForm.raceId}
                emptyLabel="Create new race"
                options={payload.races.map((race) => ({ value: race.raceId, label: `${race.raceOrder}. ${race.name}` }))}
                onChange={(raceId) => setRaceForm(raceId ? createRaceForm(payload.races.find((race) => race.raceId === raceId) ?? null) : createEmptyRaceForm(payload.events[0]?.eventId ?? ''))}
              />
            </SettingsForm>
            </SettingsEditorDrawer>
          </div>

          <section className="border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Live structure</p>
              <h2 className="mt-2 text-xl font-semibold">Season Structure</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                This is the configuration map. Choose a workflow step on the left, or click any existing item here to edit it in the drawer.
              </p>
            </div>
            <div className="grid gap-3 border-b border-zinc-200 p-4 sm:grid-cols-4 dark:border-zinc-800">
              <SummaryCard label="Seasons" value={payload.seasons.length} />
              <SummaryCard label="Events" value={payload.events.length} />
              <SummaryCard label="Races" value={payload.races.length} />
              <SummaryCard label="Series" value={payload.seriesRaces.length} />
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payload.seasons.length === 0 ? <EmptyState /> : null}
              {payload.seasons.map((season) => (
                <SeasonPanel
                  key={season.seasonId}
                  season={season}
                  events={eventsBySeason.get(season.seasonId) ?? []}
                  racesByEvent={racesByEvent}
                  printBackgroundAssetsByEvent={printBackgroundAssetsByEvent}
                  eventSeriesRulesByEvent={eventSeriesRulesByEvent}
                  weightRulesByEventRule={weightRulesByEventRule}
                  ballastRulesByEventRule={ballastRulesByEventRule}
                  tireRulesByEventRule={tireRulesByEventRule}
                  sponsorStickerAssetsByEventRule={sponsorStickerAssetsByEventRule}
                  inspectionTemplatesByEventRule={inspectionTemplatesByEventRule}
                  seasonSeries={seasonSeriesBySeason.get(season.seasonId) ?? []}
                  seasonSeriesGradesBySeries={seasonSeriesGradesBySeries}
                  onEditSeason={() => {
                    setSeasonForm(createSeasonForm(season))
                    openEditor('season')
                  }}
                  onDuplicateSeason={() => startDuplicateSeason(season)}
                  onEditEvent={(event) => {
                    setEventForm(createEventForm(event))
                    openEditor('event')
                  }}
                  onDuplicateEvent={startDuplicateEvent}
                  onEditRace={(race) => {
                    setRaceForm(createRaceForm(race))
                    openEditor('race')
                  }}
                  onEditPrintBackgroundAsset={(asset) => {
                    setPrintBackgroundAssetForm(createPrintBackgroundAssetForm(asset))
                    openEditor('printBackgroundAsset')
                  }}
                  onEditEventSeriesRule={(rule) => {
                    setEventSeriesRuleForm(createEventSeriesRuleForm(rule))
                    openEditor('eventSeriesRule')
                  }}
                  onEditWeightRule={(rule) => {
                    setWeightRuleForm(createWeightRuleForm(rule))
                    openEditor('weightRule')
                  }}
                  onEditBallastRule={(rule) => {
                    setBallastRuleForm(createBallastRuleForm(rule))
                    openEditor('ballastRule')
                  }}
                  onEditTireRule={(rule) => {
                    setTireRuleForm(createTireRuleForm(rule))
                    openEditor('tireRule')
                  }}
                  onEditSponsorStickerAsset={(asset) => {
                    setSponsorStickerAssetForm(createSponsorStickerAssetForm(asset))
                    openEditor('sponsorStickerAsset')
                  }}
                  onEditInspectionTemplate={(template) => {
                    setInspectionTemplateForm(createInspectionTemplateForm(template))
                    openEditor('inspectionTemplate')
                  }}
                  onEditInspectionSection={(section) => {
                    setInspectionSectionForm(createInspectionSectionForm(section))
                    openEditor('inspectionSection')
                  }}
                  onEditInspectionItem={(item) => {
                    setInspectionItemForm(createInspectionItemForm(item))
                    openEditor('inspectionItem')
                  }}
                />
              ))}
            </div>
          </section>

          <DuplicateConfigDialog
            draft={duplicateDraft}
            seasons={payload.seasons}
            updating={updatingKey === 'duplicate-season' || updatingKey === 'duplicate-event'}
            onChange={setDuplicateDraft}
            onClose={() => setDuplicateDraft(null)}
            onSubmit={submitDuplicate}
          />
        </div>
      ) : null}
    </section>
  )
}

function SettingsForm({
  active,
  title,
  icon: Icon,
  editorKey,
  children,
  onSubmit,
  updating,
  buttonLabel,
}: {
  active: boolean
  title: string
  icon: typeof Wrench
  editorKey: SettingsEditorKey
  children: React.ReactNode
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  updating: boolean
  buttonLabel: string
}) {
  if (!active) return null

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      onSubmit={onSubmit}
      className="border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="flex items-start gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Icon className="mt-1 text-primary" size={20} />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Configure</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>
      </div>
      <EditorGuidance editorKey={editorKey} />
      <div className="mt-5 space-y-4">{children}</div>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={updating}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {updating ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {buttonLabel}
      </motion.button>
    </motion.form>
  )
}

function EditorGuidance({ editorKey }: { editorKey: SettingsEditorKey }) {
  const guidance = getEditorGuidance(editorKey)

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Configuration path</p>
      <p className="mt-2 text-sm font-semibold">{guidance.title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{guidance.body}</p>
    </div>
  )
}

function DuplicateConfigDialog({
  draft,
  seasons,
  updating,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: DuplicateDraft | null
  seasons: SeasonRow[]
  updating: boolean
  onChange: (draft: DuplicateDraft | null) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <AnimatePresence>
      {draft ? (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close duplicate dialog"
            className="absolute inset-0 bg-zinc-950/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
          />
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.16 }}
            onSubmit={onSubmit}
            className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 border border-zinc-200 bg-zinc-50 p-5 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-dialog-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Duplicate configuration</p>
                <h2 id="duplicate-dialog-title" className="mt-1 text-2xl font-semibold">
                  {draft.mode === 'season' ? 'Duplicate Season' : 'Duplicate Event'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Source: {draft.title}. This copies organizer setup only, not competitor submissions, inspection results, weigh-ins, or race results.
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
                aria-label="Close duplicate dialog"
              >
                <X size={18} />
              </motion.button>
            </div>

            <div className="mt-5 space-y-4">
              <TextField
                label={draft.mode === 'season' ? 'New season name' : 'New event name'}
                value={draft.name}
                onChange={(name) => onChange({ ...draft, name })}
              />

              {draft.mode === 'season' ? (
                <TextField
                  label="New season year"
                  type="number"
                  value={draft.year}
                  onChange={(year) => onChange({ ...draft, year })}
                />
              ) : (
                <>
                  <EntitySelect
                    label="Target season"
                    value={draft.targetSeasonId}
                    options={seasons.map((season) => ({ value: season.seasonId, label: `${season.year} / ${season.name}` }))}
                    onChange={(targetSeasonId) => onChange({ ...draft, targetSeasonId })}
                  />
                  <TextField
                    label="New event order"
                    type="number"
                    value={draft.eventOrder}
                    onChange={(eventOrder) => onChange({ ...draft, eventOrder })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Starts on" type="date" value={draft.startsOn} onChange={(startsOn) => onChange({ ...draft, startsOn })} />
                    <TextField label="Ends on" type="date" value={draft.endsOn} onChange={(endsOn) => onChange({ ...draft, endsOn })} />
                  </div>
                </>
              )}

              <div className="rounded-md border border-amber-200 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:border-amber-900/60 dark:text-amber-300">
                The copy is created as Draft. Event Rules are unlocked Draft copies linked back to the source rule for traceability.
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-800"
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={updating}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updating ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                Duplicate {draft.mode === 'season' ? 'Season' : 'Event'}
              </motion.button>
            </div>
          </motion.form>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

function getEditorGuidance(editorKey: SettingsEditorKey) {
  const guidance: Record<SettingsEditorKey, { title: string; body: string }> = {
    season: {
      title: 'Start with the racing year.',
      body: 'Create the Season first. You can duplicate a previous Season from the Season Structure to copy all Events, Races, Event Rules, technical rules, assets, and inspection templates into a new Draft Season.',
    },
    circuit: {
      title: 'Circuits are reusable track records.',
      body: 'Create Circuits before Events so each Event can point to the correct venue. Duplicating Events keeps the same Circuit reference unless you edit it later.',
    },
    seriesRace: {
      title: 'Series defines the competition group.',
      body: 'Create the Series Race before linking it to a Season. The ballast type here becomes the baseline expectation for technical rule setup.',
    },
    grade: {
      title: 'Grades define class levels.',
      body: 'Create grades such as PRO or AM once, then activate them per Season Series. Sort order controls how grades appear in admin lists.',
    },
    seasonSeries: {
      title: 'Activate Series inside the Season.',
      body: 'A Series must be linked to the Season before Event Rules can use it. Duplicating an Event into another Season will auto-enable required Series links for that copied rule package.',
    },
    seasonSeriesGrade: {
      title: 'Activate Grades for each Season Series.',
      body: 'Event Rules require the selected Series and Grade to be active in that Season. Duplicating an Event also creates missing Grade links when needed.',
    },
    event: {
      title: 'Events are race weekends inside a Season.',
      body: 'Create or edit Event date/order here. Use Duplicate Event from the Season Structure to copy races, rules, assets, and inspection templates as a new Draft Event.',
    },
    race: {
      title: 'Races are sessions inside an Event.',
      body: 'Add practice, qualifying, and race sessions after the Event exists. Race results and weigh-in workflows depend on these sessions later.',
    },
    eventSeriesRule: {
      title: 'Event Rule is the rule package anchor.',
      body: 'Bind Event, Series, Grade, and version here before adding Weight, Ballast, Tire, Sponsor Sticker, and Inspection Template configuration.',
    },
    weightRule: {
      title: 'Weight Rules feed Target Weight.',
      body: 'Set base weight and optional add-on weight rules for the selected Event Rule. These values drive scrutineering and weigh-in calculations.',
    },
    ballastRule: {
      title: 'Success Ballast controls carried weight.',
      body: 'Configure ballast type, maximum cap, and position matrix after the Event Rule exists. Keep JSON precise because race result publishing uses it.',
    },
    tireRule: {
      title: 'Tire Rules define allowed equipment.',
      body: 'Set allowed or disallowed tire brand/model per Event Rule. This becomes part of the official event-specific technical rule package.',
    },
    sponsorStickerAsset: {
      title: 'Sponsor Stickers attach official artwork.',
      body: 'Upload sticker images per Event Rule. Duplicated Events copy the configuration row and reuse the same uploaded file reference.',
    },
    printBackgroundAsset: {
      title: 'A4 Backgrounds attach printable artwork.',
      body: 'Upload Event-level print backgrounds for PDF/export layouts. Duplicated Events copy the background configuration and reuse the same uploaded file reference.',
    },
    inspectionTemplate: {
      title: 'Template comes before sections and items.',
      body: 'Create the inspection form version for an Event Rule first. Duplicating an Event copies templates, sections, and items together.',
    },
    inspectionSection: {
      title: 'Sections group inspection items.',
      body: 'Add clear sections after the template exists. Use stable codes and sort order so forms remain predictable for scrutineers.',
    },
    inspectionItem: {
      title: 'Items are the actual inspection fields.',
      body: 'Add fields, options, required status, and weight effect behavior. Weight-effect fields can feed suggested BOP values during inspection.',
    },
  }

  return guidance[editorKey]
}

function SettingsEditorDrawer({
  open,
  activeEditorMeta,
  onClose,
  children,
}: {
  open: boolean
  activeEditorMeta: SettingsEditor
  onClose: () => void
  children: React.ReactNode
}) {
  const Icon = activeEditorMeta.icon

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close settings editor"
            className="absolute inset-0 bg-zinc-950/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-zinc-200 bg-zinc-50 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-editor-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-start gap-3">
                <Icon className="mt-1 text-primary" size={20} />
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Off-canvas editor</p>
                  <h2 id="settings-editor-title" className="mt-1 text-2xl font-semibold">{activeEditorMeta.label}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">{activeEditorMeta.hint}</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
                aria-label="Close editor"
              >
                <X size={18} />
              </motion.button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {children}
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

function SettingsFocusPanel({
  editors,
  activeEditor,
  activeEditorMeta,
  readiness,
  phaseSummaries,
  onSelect,
}: {
  editors: SettingsEditor[]
  activeEditor: SettingsEditorKey
  activeEditorMeta: SettingsEditor
  readiness: SettingsReadinessItem[]
  phaseSummaries: SettingsPhaseSummary[]
  onSelect: (editor: SettingsEditorKey) => void
}) {
  const phases = [...new Set(editors.map((editor) => editor.phase))]

  return (
    <section className="border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Setup cockpit</p>
        <h2 className="mt-2 text-xl font-semibold">Open one editor, keep the map clean</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Select a workflow step to open the off-canvas editor. The season structure stays on this page, so you never lose context.
        </p>
      </div>

      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Selected editor</p>
          <div className="mt-3 flex items-start gap-3">
            <activeEditorMeta.icon className="mt-1 text-primary" size={19} />
            <div>
              <p className="font-semibold">{activeEditorMeta.label}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{activeEditorMeta.phase} / {activeEditorMeta.hint}</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onSelect(activeEditor)}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white"
          >
            Open {activeEditorMeta.label}
          </motion.button>
        </div>

        <div className="mt-3 grid gap-2">
          {phaseSummaries.map((summary) => (
            <div key={summary.phase} className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{summary.phase}</p>
                <p className="font-mono text-xs text-zinc-500">{summary.complete}/{summary.total}</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-1.5 rounded-full bg-primary"
                  style={{ width: `${Math.round((summary.complete / summary.total) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {readiness.map((item) => (
            <div key={item.label} className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-500">{item.label}</p>
              <p className={`mt-1 text-lg font-semibold ${item.ready ? 'text-zinc-950 dark:text-zinc-50' : 'text-amber-700 dark:text-amber-400'}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {phases.map((phase) => (
          <div key={phase}>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{phase}</p>
            <div className="mt-2 grid gap-2">
              {editors.filter((editor) => editor.phase === phase).map((editor) => {
                const Icon = editor.icon
                const isActive = editor.key === activeEditor

                return (
                  <motion.button
                    key={editor.key}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => onSelect(editor.key)}
                    className={`flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? 'border-zinc-300 border-l-2 border-l-primary bg-orange-500/5 dark:border-zinc-700 dark:border-l-primary'
                        : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon size={17} className={isActive ? 'text-primary' : 'text-zinc-500'} />
                    <span className="font-semibold">{editor.label}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SeasonPanel({
  season,
  events,
  racesByEvent,
  printBackgroundAssetsByEvent,
  eventSeriesRulesByEvent,
  weightRulesByEventRule,
  ballastRulesByEventRule,
  tireRulesByEventRule,
  sponsorStickerAssetsByEventRule,
  inspectionTemplatesByEventRule,
  seasonSeries,
  seasonSeriesGradesBySeries,
  onEditSeason,
  onDuplicateSeason,
  onEditEvent,
  onDuplicateEvent,
  onEditRace,
  onEditPrintBackgroundAsset,
  onEditEventSeriesRule,
  onEditWeightRule,
  onEditBallastRule,
  onEditTireRule,
  onEditSponsorStickerAsset,
  onEditInspectionTemplate,
  onEditInspectionSection,
  onEditInspectionItem,
}: {
  season: SeasonRow
  events: EventRow[]
  racesByEvent: Map<string, RaceRow[]>
  printBackgroundAssetsByEvent: Map<string, PrintBackgroundAssetRow[]>
  eventSeriesRulesByEvent: Map<string, EventSeriesRuleRow[]>
  weightRulesByEventRule: Map<string, WeightRuleRow[]>
  ballastRulesByEventRule: Map<string, BallastRuleRow[]>
  tireRulesByEventRule: Map<string, TireRuleRow[]>
  sponsorStickerAssetsByEventRule: Map<string, SponsorStickerAssetRow[]>
  inspectionTemplatesByEventRule: Map<string, InspectionTemplateRow[]>
  seasonSeries: SeasonSeriesRow[]
  seasonSeriesGradesBySeries: Map<string, SeasonSeriesGradeRow[]>
  onEditSeason: () => void
  onDuplicateSeason: () => void
  onEditEvent: (event: EventRow) => void
  onDuplicateEvent: (event: EventRow) => void
  onEditRace: (race: RaceRow) => void
  onEditPrintBackgroundAsset: (asset: PrintBackgroundAssetRow) => void
  onEditEventSeriesRule: (rule: EventSeriesRuleRow) => void
  onEditWeightRule: (rule: WeightRuleRow) => void
  onEditBallastRule: (rule: BallastRuleRow) => void
  onEditTireRule: (rule: TireRuleRow) => void
  onEditSponsorStickerAsset: (asset: SponsorStickerAssetRow) => void
  onEditInspectionTemplate: (template: InspectionTemplateRow) => void
  onEditInspectionSection: (section: InspectionTemplateSectionRow) => void
  onEditInspectionItem: (item: InspectionTemplateItemRow) => void
}) {
  return (
    <details className="group p-4" open={season.isActive || events.length === 0}>
      <summary className="flex cursor-pointer list-none flex-col gap-3 rounded-md border border-zinc-200 p-4 transition hover:border-zinc-400 lg:flex-row lg:items-start lg:justify-between dark:border-zinc-800 dark:hover:border-zinc-600">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{season.year} / {season.name}</span>
            <StatusBadge label={season.status} tone={season.isActive ? 'success' : 'neutral'} />
          </div>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
            {events.length} event(s) / {seasonSeries.length} series link(s)
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 group-open:hidden">Expand</span>
          <span className="hidden font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 group-open:inline">Collapse</span>
          <TextButton label="Edit season" onClick={onEditSeason} />
          <TextButton label="Duplicate season" onClick={onDuplicateSeason} />
        </span>
      </summary>
      <div className="mt-4 border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">Series and grades</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {seasonSeries.length === 0 ? <span className="text-sm text-zinc-500">No series linked to this season.</span> : null}
          {seasonSeries.map((series) => {
            const grades = seasonSeriesGradesBySeries.get(series.seasonSeriesId) ?? []

            return (
              <span key={series.seasonSeriesId} className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold dark:border-zinc-800">
                {series.seriesName} / {grades.length > 0 ? grades.map((grade) => grade.gradeName).join(', ') : 'No grades'}
              </span>
            )
          })}
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {events.length === 0 ? <p className="text-sm text-zinc-500">No events configured for this season.</p> : null}
        {events.map((event) => {
          const printBackgroundAssets = printBackgroundAssetsByEvent.get(event.eventId) ?? []

          return (
          <details key={event.eventId} className="group/event border border-zinc-200 p-3 dark:border-zinc-800" open={events.length === 1}>
            <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <span>
                <span className="font-medium">{event.eventOrder}. {event.name}</span>
                <span className="mt-1 block text-sm text-zinc-500">{event.circuitName ?? 'No circuit'} / {formatDateRange(event.startsOn, event.endsOn)}</span>
                <span className="mt-2 block font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
                  {(racesByEvent.get(event.eventId) ?? []).length} race(s) / {(eventSeriesRulesByEvent.get(event.eventId) ?? []).length} rule package(s)
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge label={event.status} tone={event.status === 'Active' ? 'success' : 'neutral'} />
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 group-open/event:hidden">Expand</span>
                <span className="hidden font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 group-open/event:inline">Collapse</span>
                <TextButton label="Edit event" onClick={() => onEditEvent(event)} />
                <TextButton label="Duplicate event" onClick={() => onDuplicateEvent(event)} />
              </span>
            </summary>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              {printBackgroundAssets.length === 0 ? <span className="text-xs text-zinc-500">No A4 background.</span> : null}
              {printBackgroundAssets.map((asset) => (
                <button
                  key={asset.printBackgroundAssetId}
                  type="button"
                  onClick={() => onEditPrintBackgroundAsset(asset)}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  A4 {formatOrientation(asset.orientation)} / {asset.title} / {asset.isDefault ? 'Default' : 'Optional'}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              {(eventSeriesRulesByEvent.get(event.eventId) ?? []).map((rule) => {
                const templates = inspectionTemplatesByEventRule.get(rule.eventSeriesRuleId) ?? []
                const weightRules = weightRulesByEventRule.get(rule.eventSeriesRuleId) ?? []
                const ballastRules = ballastRulesByEventRule.get(rule.eventSeriesRuleId) ?? []
                const tireRules = tireRulesByEventRule.get(rule.eventSeriesRuleId) ?? []
                const sponsorStickerAssets = sponsorStickerAssetsByEventRule.get(rule.eventSeriesRuleId) ?? []

                return (
                  <details key={rule.eventSeriesRuleId} className="group/rule rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                    <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <span>
                        <span className="text-sm font-semibold">{rule.seriesName} / {rule.gradeName}</span>
                        <span className="mt-1 block font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">v{rule.version} / {rule.status}</span>
                        <span className="mt-1 block text-xs text-zinc-500">
                          {weightRules.length} weight / {ballastRules.length} ballast / {tireRules.length} tire / {templates.length} template
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 group-open/rule:hidden">Expand</span>
                        <span className="hidden font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 group-open/rule:inline">Collapse</span>
                        <TextButton label="Edit rule" onClick={() => onEditEventSeriesRule(rule)} />
                      </span>
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      {weightRules.length === 0 ? <span className="text-xs text-zinc-500">No weight rule.</span> : null}
                      {weightRules.map((weightRule) => (
                        <button
                          key={weightRule.weightRuleId}
                          type="button"
                          onClick={() => onEditWeightRule(weightRule)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                        >
                          Weight / {weightRule.name} / base {weightRule.baseWeightKg} kg
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ballastRules.length === 0 ? <span className="text-xs text-zinc-500">No ballast rule.</span> : null}
                      {ballastRules.map((ballastRule) => (
                        <button
                          key={ballastRule.ballastRuleId}
                          type="button"
                          onClick={() => onEditBallastRule(ballastRule)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                        >
                          Ballast / {ballastRule.ballastType} / max {ballastRule.maxBallastKg ?? 'none'} kg
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tireRules.length === 0 ? <span className="text-xs text-zinc-500">No tire rule.</span> : null}
                      {tireRules.map((tireRule) => (
                        <button
                          key={tireRule.tireRuleId}
                          type="button"
                          onClick={() => onEditTireRule(tireRule)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                        >
                          Tire / {tireRule.tireBrand}{tireRule.tireModel ? ` ${tireRule.tireModel}` : ''} / {tireRule.isAllowed ? 'Allowed' : 'Disallowed'}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sponsorStickerAssets.length === 0 ? <span className="text-xs text-zinc-500">No sponsor sticker.</span> : null}
                      {sponsorStickerAssets.map((asset) => (
                        <button
                          key={asset.sponsorStickerAssetId}
                          type="button"
                          onClick={() => onEditSponsorStickerAsset(asset)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                        >
                          Sticker / {asset.title} / {asset.filename}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {templates.length === 0 ? <span className="text-xs text-zinc-500">No inspection template.</span> : null}
                      {templates.map((template) => (
                        <button
                          key={template.templateId}
                          type="button"
                          onClick={() => onEditInspectionTemplate(template)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                        >
                          Template / {template.name} / v{template.version} / {template.isActive ? 'Active' : 'Inactive'}
                        </button>
                      ))}
                    </div>
                    {templates.map((template) => (
                      <div key={`${template.templateId}-sections`} className="mt-2 flex flex-wrap gap-2">
                        {template.sections.map((section) => (
                          <button
                            key={section.sectionId}
                            type="button"
                            onClick={() => onEditInspectionSection(section)}
                            className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                          >
                            Section / {section.title} / {section.items.length} item(s)
                          </button>
                        ))}
                        {template.sections.flatMap((section) => section.items).map((item) => (
                          <button
                            key={item.itemId}
                            type="button"
                            onClick={() => onEditInspectionItem(item)}
                            className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                          >
                            Item / {item.labelTh} / {item.inputType}
                          </button>
                        ))}
                      </div>
                    ))}
                  </details>
                )
              })}
              {(racesByEvent.get(event.eventId) ?? []).map((race) => (
                <button
                  key={race.raceId}
                  type="button"
                  onClick={() => onEditRace(race)}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs font-semibold transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  {race.raceOrder}. {race.name} / {race.sessionType}
                </button>
              ))}
              {(racesByEvent.get(event.eventId) ?? []).length === 0 ? <span className="text-sm text-zinc-500">No races.</span> : null}
            </div>
          </details>
          )
        })}
      </div>
    </details>
  )
}

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      />
    </label>
  )
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      />
    </label>
  )
}

function FileField({ label, accept, helperText, onChange }: { label: string; accept: string; helperText: string; onChange: (file: File | null) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-primary dark:border-zinc-800 dark:bg-zinc-950 dark:file:bg-zinc-100 dark:file:text-zinc-950"
      />
      <span className="mt-2 block text-xs text-zinc-500">{helperText}</span>
    </label>
  )
}

function EntitySelect({ label, value, options, onChange, emptyLabel }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; emptyLabel?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-950">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: 'success' | 'neutral' }) {
  const className = tone === 'success'
    ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
    : 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'

  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>
}

function TextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-xs font-semibold dark:border-zinc-800"
    >
      {label}
    </motion.button>
  )
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className = tone === 'success'
    ? 'mt-5 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
    : 'mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400'

  return <div className={className}>{message}</div>
}

function OrganizerSkeleton() {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,27rem)_1fr]">
      <div className="h-96 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      <div className="h-96 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
    </div>
  )
}

function EmptyState() {
  return <div className="p-5 text-sm text-zinc-500">No seasons configured. Create the first season to start building events and races.</div>
}

function createSettingsReadiness(payload: OrganizerPayload): SettingsReadinessItem[] {
  return [
    { label: 'Seasons', value: payload.seasons.length, ready: payload.seasons.length > 0 },
    { label: 'Events', value: payload.events.length, ready: payload.events.length > 0 },
    { label: 'Races', value: payload.races.length, ready: payload.races.length > 0 },
    { label: 'Series', value: payload.seriesRaces.length, ready: payload.seriesRaces.length > 0 },
    { label: 'Rules', value: payload.eventSeriesRules.length, ready: payload.eventSeriesRules.length > 0 },
    { label: 'Templates', value: payload.inspectionTemplates.length, ready: payload.inspectionTemplates.length > 0 },
  ]
}

function createSettingsPhaseSummaries(readiness: SettingsReadinessItem[]): SettingsPhaseSummary[] {
  const ready = new Map(readiness.map((item) => [item.label, item.ready]))

  return [
    { phase: 'Foundation', complete: countReady(ready, ['Seasons']), total: 1 },
    { phase: 'Classes', complete: countReady(ready, ['Series']), total: 1 },
    { phase: 'Calendar', complete: countReady(ready, ['Events', 'Races']), total: 2 },
    { phase: 'Rules', complete: countReady(ready, ['Rules', 'Templates']), total: 2 },
  ]
}

function countReady(ready: Map<string, boolean>, labels: string[]) {
  return labels.filter((label) => ready.get(label)).length
}

function createEmptyCircuitForm(): CircuitForm {
  return { circuitId: '', name: '', location: '', country: 'Thailand' }
}

function createCircuitForm(circuit: CircuitOption | null): CircuitForm {
  if (!circuit) return createEmptyCircuitForm()
  return {
    circuitId: circuit.circuitId,
    name: circuit.name,
    location: circuit.location ?? '',
    country: circuit.country,
  }
}

function createEmptySeasonForm(organizationId = ''): SeasonForm {
  const year = String(new Date().getFullYear())
  return { seasonId: '', organizationId, name: `${year} Season`, year, status: 'Draft', isActive: false }
}

function createSeasonForm(season: SeasonRow | null): SeasonForm {
  if (!season) return createEmptySeasonForm()
  return {
    seasonId: season.seasonId,
    organizationId: season.organizationId,
    name: season.name,
    year: String(season.year),
    status: season.status,
    isActive: season.isActive,
  }
}

function createEmptySeriesRaceForm(organizationId = ''): SeriesRaceForm {
  return { seriesRaceId: '', organizationId, code: '', name: '', ballastType: 'None', isActive: true }
}

function createSeriesRaceForm(seriesRace: SeriesRaceRow | null): SeriesRaceForm {
  if (!seriesRace) return createEmptySeriesRaceForm()
  return {
    seriesRaceId: seriesRace.seriesRaceId,
    organizationId: seriesRace.organizationId,
    code: seriesRace.code,
    name: seriesRace.name,
    ballastType: seriesRace.ballastType,
    isActive: seriesRace.isActive,
  }
}

function createEmptyGradeForm(): GradeForm {
  return { gradeId: '', code: '', name: '', sortOrder: '0' }
}

function createGradeForm(grade: GradeRow | null): GradeForm {
  if (!grade) return createEmptyGradeForm()
  return {
    gradeId: grade.gradeId,
    code: grade.code,
    name: grade.name,
    sortOrder: String(grade.sortOrder),
  }
}

function createEmptySeasonSeriesForm(seasonId = '', seriesRaceId = ''): SeasonSeriesForm {
  return { seasonId, seriesRaceId, isActive: true }
}

function createEmptySeasonSeriesGradeForm(seasonId = '', seriesRaceId = '', gradeId = ''): SeasonSeriesGradeForm {
  return { seasonId, seriesRaceId, gradeId, isActive: true }
}

function createEmptyEventSeriesRuleForm(eventId = '', seriesRaceId = ''): EventSeriesRuleForm {
  return { eventSeriesRuleId: '', eventId, seriesRaceId, gradeId: '', status: 'Draft', version: '1', isLocked: false, clonedFromId: '' }
}

function createEventSeriesRuleForm(rule: EventSeriesRuleRow | null): EventSeriesRuleForm {
  if (!rule) return createEmptyEventSeriesRuleForm()
  return {
    eventSeriesRuleId: rule.eventSeriesRuleId,
    eventId: rule.eventId,
    seriesRaceId: rule.seriesRaceId,
    gradeId: rule.gradeId,
    status: rule.status,
    version: String(rule.version),
    isLocked: rule.isLocked,
    clonedFromId: rule.clonedFromId ?? '',
  }
}

function createEmptyInspectionTemplateForm(eventSeriesRuleId = ''): InspectionTemplateForm {
  return { templateId: '', eventSeriesRuleId, name: '', version: '1', isActive: true, cloneFromTemplateId: '' }
}

function createInspectionTemplateForm(template: InspectionTemplateRow | null): InspectionTemplateForm {
  if (!template) return createEmptyInspectionTemplateForm()
  return {
    templateId: template.templateId,
    eventSeriesRuleId: template.eventSeriesRuleId,
    name: template.name,
    version: String(template.version),
    isActive: template.isActive,
    cloneFromTemplateId: '',
  }
}

function createEmptyInspectionSectionForm(templateId = ''): InspectionSectionForm {
  return { sectionId: '', templateId, code: '', title: '', sortOrder: '10', isFixed: false }
}

function createInspectionSectionForm(section: InspectionTemplateSectionRow | null): InspectionSectionForm {
  if (!section) return createEmptyInspectionSectionForm()
  return {
    sectionId: section.sectionId,
    templateId: section.templateId,
    code: section.code,
    title: section.title,
    sortOrder: String(section.sortOrder),
    isFixed: section.isFixed,
  }
}

function createEmptyInspectionItemForm(sectionId = ''): InspectionItemForm {
  return { itemId: '', sectionId, labelTh: '', labelEn: '', inputType: 'Checkbox', optionsText: '[]', weightEffectType: 'None', fixedWeightKg: '', isRequired: false, sortOrder: '10' }
}

function createInspectionItemForm(item: InspectionTemplateItemRow | null): InspectionItemForm {
  if (!item) return createEmptyInspectionItemForm()
  return {
    itemId: item.itemId,
    sectionId: item.sectionId,
    labelTh: item.labelTh,
    labelEn: item.labelEn ?? '',
    inputType: item.inputType,
    optionsText: JSON.stringify(item.options ?? []),
    weightEffectType: item.weightEffectType,
    fixedWeightKg: item.fixedWeightKg === null ? '' : String(item.fixedWeightKg),
    isRequired: item.isRequired,
    sortOrder: String(item.sortOrder),
  }
}

function createEmptyWeightRuleForm(eventSeriesRuleId = ''): WeightRuleForm {
  return {
    weightRuleId: '',
    eventSeriesRuleId,
    name: '',
    engineMinCc: '',
    engineMaxCc: '',
    baseWeightKg: '',
    additionalWeightRulesText: '[]',
    isActive: true,
    sortOrder: '10',
  }
}

function createWeightRuleForm(rule: WeightRuleRow | null): WeightRuleForm {
  if (!rule) return createEmptyWeightRuleForm()
  return {
    weightRuleId: rule.weightRuleId,
    eventSeriesRuleId: rule.eventSeriesRuleId,
    name: rule.name,
    engineMinCc: rule.engineMinCc === null ? '' : String(rule.engineMinCc),
    engineMaxCc: rule.engineMaxCc === null ? '' : String(rule.engineMaxCc),
    baseWeightKg: String(rule.baseWeightKg),
    additionalWeightRulesText: JSON.stringify(rule.additionalWeightRules ?? [], null, 2),
    isActive: rule.isActive,
    sortOrder: String(rule.sortOrder),
  }
}

function createEmptyBallastRuleForm(eventSeriesRuleId = ''): BallastRuleForm {
  return {
    ballastRuleId: '',
    eventSeriesRuleId,
    ballastType: 'SuccessBallast',
    maxBallastKg: '',
    joinWeightEnabled: false,
    positionMatrixText: '{"1": 30, "2": 20, "3": 10}',
    removalRuleText: '{}',
  }
}

function createBallastRuleForm(rule: BallastRuleRow | null): BallastRuleForm {
  if (!rule) return createEmptyBallastRuleForm()
  return {
    ballastRuleId: rule.ballastRuleId,
    eventSeriesRuleId: rule.eventSeriesRuleId,
    ballastType: rule.ballastType,
    maxBallastKg: rule.maxBallastKg === null ? '' : String(rule.maxBallastKg),
    joinWeightEnabled: rule.joinWeightEnabled,
    positionMatrixText: JSON.stringify(rule.positionMatrix ?? {}, null, 2),
    removalRuleText: JSON.stringify(rule.removalRule ?? {}, null, 2),
  }
}

function createEmptyTireRuleForm(eventSeriesRuleId = ''): TireRuleForm {
  return {
    tireRuleId: '',
    eventSeriesRuleId,
    tireBrand: '',
    tireModel: '',
    isAllowed: true,
  }
}

function createTireRuleForm(rule: TireRuleRow | null): TireRuleForm {
  if (!rule) return createEmptyTireRuleForm()
  return {
    tireRuleId: rule.tireRuleId,
    eventSeriesRuleId: rule.eventSeriesRuleId,
    tireBrand: rule.tireBrand,
    tireModel: rule.tireModel ?? '',
    isAllowed: rule.isAllowed,
  }
}

function createEmptySponsorStickerAssetForm(eventSeriesRuleId = ''): SponsorStickerAssetForm {
  return {
    sponsorStickerAssetId: '',
    eventSeriesRuleId,
    title: '',
    file: null,
    existingFilename: '',
    existingPath: '',
  }
}

function createSponsorStickerAssetForm(asset: SponsorStickerAssetRow | null): SponsorStickerAssetForm {
  if (!asset) return createEmptySponsorStickerAssetForm()
  return {
    sponsorStickerAssetId: asset.sponsorStickerAssetId,
    eventSeriesRuleId: asset.eventSeriesRuleId,
    title: asset.title,
    file: null,
    existingFilename: asset.filename,
    existingPath: asset.path,
  }
}

function createEmptyPrintBackgroundAssetForm(eventId = ''): PrintBackgroundAssetForm {
  return {
    printBackgroundAssetId: '',
    eventId,
    title: '',
    orientation: 'portrait',
    isDefault: false,
    file: null,
    existingFilename: '',
    existingPath: '',
  }
}

function createPrintBackgroundAssetForm(asset: PrintBackgroundAssetRow | null): PrintBackgroundAssetForm {
  if (!asset) return createEmptyPrintBackgroundAssetForm()
  return {
    printBackgroundAssetId: asset.printBackgroundAssetId,
    eventId: asset.eventId,
    title: asset.title,
    orientation: asset.orientation,
    isDefault: asset.isDefault,
    file: null,
    existingFilename: asset.filename,
    existingPath: asset.path,
  }
}

function formatOrientation(orientation: 'portrait' | 'landscape') {
  return orientation === 'landscape' ? 'Landscape' : 'Portrait'
}

function createEmptyEventForm(seasonId = '', circuitId = ''): EventForm {
  return { eventId: '', seasonId, circuitId, name: '', eventOrder: '1', startsOn: '', endsOn: '', status: 'Draft' }
}

function createEventForm(event: EventRow | null): EventForm {
  if (!event) return createEmptyEventForm()
  return {
    eventId: event.eventId,
    seasonId: event.seasonId,
    circuitId: event.circuitId ?? '',
    name: event.name,
    eventOrder: String(event.eventOrder),
    startsOn: event.startsOn ?? '',
    endsOn: event.endsOn ?? '',
    status: event.status,
  }
}

function createEmptyRaceForm(eventId = ''): RaceForm {
  return { raceId: '', eventId, name: '', raceOrder: '1', sessionType: 'Race', scheduledAt: '', resultsImportUnlocked: false }
}

function createRaceForm(race: RaceRow | null): RaceForm {
  if (!race) return createEmptyRaceForm()
  return {
    raceId: race.raceId,
    eventId: race.eventId,
    name: race.name,
    raceOrder: String(race.raceOrder),
    sessionType: race.sessionType,
    scheduledAt: toDateTimeLocal(race.scheduledAt),
    resultsImportUnlocked: race.resultsImportUnlocked,
  }
}

function groupEventsBySeason(events: EventRow[]) {
  const map = new Map<string, EventRow[]>()
  events.forEach((event) => {
    map.set(event.seasonId, [...(map.get(event.seasonId) ?? []), event])
  })
  return map
}

function groupRacesByEvent(races: RaceRow[]) {
  const map = new Map<string, RaceRow[]>()
  races.forEach((race) => {
    map.set(race.eventId, [...(map.get(race.eventId) ?? []), race])
  })
  return map
}

function parseJsonObject(value: string, label: string) {
  const parsed = JSON.parse(value || '{}') as unknown
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed as Record<string, unknown>
}

function sanitizeFileName(filename: string) {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
  return sanitized || 'upload.bin'
}

function formatDateRange(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return 'Dates not set'
  if (startsOn && endsOn) return `${startsOn} to ${endsOn}`
  return startsOn ?? endsOn ?? 'Dates not set'
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}
