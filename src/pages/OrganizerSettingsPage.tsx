import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CalendarDays, ClipboardList, Flag, Image, Layers3, Loader2, MapPinned, RefreshCcw, Save, Scale, Trophy, Wrench, X } from 'lucide-react'
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
  createOrganizerSetupBoard,
  getRulePackageReadiness,
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
  type OrganizerSetupBoard,
  type RulePackageReadiness,
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

type OrganizerScope = 'global' | 'season' | 'event' | 'rule' | 'race'

type OrganizerScopeTab = {
  key: OrganizerScope
  label: string
  description: string
}

type ScopeFilter = {
  query: string
  needsAttentionOnly: boolean
}

const organizerScopeTabs: OrganizerScopeTab[] = [
  { key: 'global', label: 'Global Library', description: 'Reusable master data.' },
  { key: 'season', label: 'Season Setup', description: 'Racing year setup.' },
  { key: 'event', label: 'Event Setup', description: 'Race weekend setup.' },
  { key: 'rule', label: 'Rule Packages', description: 'Event class rules.' },
  { key: 'race', label: 'Race Sessions', description: 'Practice, qualifying, race.' },
]

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
  const [activeScope, setActiveScope] = useState<OrganizerScope>('season')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>({ query: '', needsAttentionOnly: false })
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
  const setupBoard = useMemo(() => createOrganizerSetupBoard(payload), [payload])

  function openEditor(editor: SettingsEditorKey) {
    setActiveEditor(editor)
    setEditorOpen(true)
  }

  function selectScope(scope: OrganizerScope) {
    setActiveScope(scope)
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
        <div className="mt-6 space-y-5">
          <ScopeDashboard setupBoard={setupBoard} activeScope={activeScope} />
          <ScopeSwitcher activeScope={activeScope} onSelectScope={selectScope} />
          <ScopeToolbar filter={scopeFilter} onChange={setScopeFilter} />
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
              <TextAreaField label="Dropdown choices" helperText={'Advanced format for now: write choices as a list, for example ["Yes", "No"].'} value={inspectionItemForm.optionsText} onChange={(optionsText) => setInspectionItemForm((current) => ({ ...current, optionsText }))} placeholder='["Yes", "No"]' />
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
              <TextAreaField label="Additional weight options" helperText="Advanced format for now: each option needs a code, label, and weight kg." value={weightRuleForm.additionalWeightRulesText} onChange={(additionalWeightRulesText) => setWeightRuleForm((current) => ({ ...current, additionalWeightRulesText }))} placeholder='[{"code":"turbo","label":"Turbo","weightKg":30}]' />
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
              <TextAreaField label="Ballast by finishing position" helperText="Advanced format for now: position number on the left, ballast kg on the right." value={ballastRuleForm.positionMatrixText} onChange={(positionMatrixText) => setBallastRuleForm((current) => ({ ...current, positionMatrixText }))} placeholder='{"1": 30, "2": 20, "3": 10}' />
              <TextAreaField label="Ballast removal notes" helperText="Optional advanced rule for how carried ballast is reduced in later races." value={ballastRuleForm.removalRuleText} onChange={(removalRuleText) => setBallastRuleForm((current) => ({ ...current, removalRuleText }))} placeholder='{"note": "Future rule for ballast removal"}' />
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

          <ScopeBoard
            activeScope={activeScope}
            filter={scopeFilter}
            payload={payload}
            eventsBySeason={eventsBySeason}
            racesByEvent={racesByEvent}
            eventSeriesRulesByEvent={eventSeriesRulesByEvent}
            weightRulesByEventRule={weightRulesByEventRule}
            ballastRulesByEventRule={ballastRulesByEventRule}
            tireRulesByEventRule={tireRulesByEventRule}
            sponsorStickerAssetsByEventRule={sponsorStickerAssetsByEventRule}
            printBackgroundAssetsByEvent={printBackgroundAssetsByEvent}
            inspectionTemplatesByEventRule={inspectionTemplatesByEventRule}
            seasonSeriesBySeason={seasonSeriesBySeason}
            seasonSeriesGradesBySeries={seasonSeriesGradesBySeries}
            onCreateCircuit={() => {
              setCircuitForm(createEmptyCircuitForm())
              openEditor('circuit')
            }}
            onEditCircuit={(circuit) => {
              setCircuitForm(createCircuitForm(circuit))
              openEditor('circuit')
            }}
            onCreateSeriesRace={() => {
              setSeriesRaceForm(createEmptySeriesRaceForm(payload.organizations[0]?.organizationId ?? ''))
              openEditor('seriesRace')
            }}
            onEditSeriesRace={(seriesRace) => {
              setSeriesRaceForm(createSeriesRaceForm(seriesRace))
              openEditor('seriesRace')
            }}
            onCreateGrade={() => {
              setGradeForm(createEmptyGradeForm())
              openEditor('grade')
            }}
            onEditGrade={(grade) => {
              setGradeForm(createGradeForm(grade))
              openEditor('grade')
            }}
            onCreateSeason={() => {
              setSeasonForm(createEmptySeasonForm(payload.organizations[0]?.organizationId ?? ''))
              openEditor('season')
            }}
            onEditSeason={(season) => {
              setSeasonForm(createSeasonForm(season))
              openEditor('season')
            }}
            onDuplicateSeason={startDuplicateSeason}
            onCreateSeasonSeries={(season) => {
              setSeasonSeriesForm(createEmptySeasonSeriesForm(season?.seasonId ?? payload.seasons[0]?.seasonId ?? '', payload.seriesRaces[0]?.seriesRaceId ?? ''))
              openEditor('seasonSeries')
            }}
            onCreateSeasonGrade={(season) => {
              setSeasonSeriesGradeForm(createEmptySeasonSeriesGradeForm(season?.seasonId ?? payload.seasons[0]?.seasonId ?? '', payload.seriesRaces[0]?.seriesRaceId ?? '', payload.grades[0]?.gradeId ?? ''))
              openEditor('seasonSeriesGrade')
            }}
            onCreateEvent={(season) => {
              setEventForm(createEmptyEventForm(season?.seasonId ?? payload.seasons[0]?.seasonId ?? '', payload.circuits[0]?.circuitId ?? ''))
              openEditor('event')
            }}
            onEditEvent={(event) => {
              setEventForm(createEventForm(event))
              openEditor('event')
            }}
            onDuplicateEvent={startDuplicateEvent}
            onCreatePrintBackgroundAsset={(event) => {
              setPrintBackgroundAssetForm(createEmptyPrintBackgroundAssetForm(event?.eventId ?? payload.events[0]?.eventId ?? ''))
              openEditor('printBackgroundAsset')
            }}
            onEditPrintBackgroundAsset={(asset) => {
              setPrintBackgroundAssetForm(createPrintBackgroundAssetForm(asset))
              openEditor('printBackgroundAsset')
            }}
            onCreateEventSeriesRule={(event) => {
              setEventSeriesRuleForm(createEmptyEventSeriesRuleForm(event?.eventId ?? payload.events[0]?.eventId ?? '', payload.seriesRaces[0]?.seriesRaceId ?? ''))
              openEditor('eventSeriesRule')
            }}
            onEditEventSeriesRule={(rule) => {
              setEventSeriesRuleForm(createEventSeriesRuleForm(rule))
              openEditor('eventSeriesRule')
            }}
            onCreateWeightRule={(rule) => {
              setWeightRuleForm(createEmptyWeightRuleForm(rule.eventSeriesRuleId))
              openEditor('weightRule')
            }}
            onEditWeightRule={(rule) => {
              setWeightRuleForm(createWeightRuleForm(rule))
              openEditor('weightRule')
            }}
            onCreateBallastRule={(rule) => {
              setBallastRuleForm(createEmptyBallastRuleForm(rule.eventSeriesRuleId))
              openEditor('ballastRule')
            }}
            onEditBallastRule={(rule) => {
              setBallastRuleForm(createBallastRuleForm(rule))
              openEditor('ballastRule')
            }}
            onCreateTireRule={(rule) => {
              setTireRuleForm(createEmptyTireRuleForm(rule.eventSeriesRuleId))
              openEditor('tireRule')
            }}
            onEditTireRule={(rule) => {
              setTireRuleForm(createTireRuleForm(rule))
              openEditor('tireRule')
            }}
            onCreateSponsorStickerAsset={(rule) => {
              setSponsorStickerAssetForm(createEmptySponsorStickerAssetForm(rule.eventSeriesRuleId))
              openEditor('sponsorStickerAsset')
            }}
            onEditSponsorStickerAsset={(asset) => {
              setSponsorStickerAssetForm(createSponsorStickerAssetForm(asset))
              openEditor('sponsorStickerAsset')
            }}
            onCreateInspectionTemplate={(rule) => {
              setInspectionTemplateForm(createEmptyInspectionTemplateForm(rule.eventSeriesRuleId))
              openEditor('inspectionTemplate')
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
            onCreateRace={(event) => {
              setRaceForm(createEmptyRaceForm(event?.eventId ?? payload.events[0]?.eventId ?? ''))
              openEditor('race')
            }}
            onEditRace={(race) => {
              setRaceForm(createRaceForm(race))
              openEditor('race')
            }}
          />

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
  const guidance = getEditorGuidance(editorKey)
  const mapLocation = getEditorMapLocation(editorKey)

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      onSubmit={onSubmit}
      className="border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-start gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800">
        <Icon className="mt-1 text-primary" size={20} />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Focused editor</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">{mapLocation}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{guidance.title}</p>
        </div>
      </div>
      <EditorGuidance editorKey={editorKey} />
      <div className="space-y-4 p-5">{children}</div>
      <div className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={updating}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updating ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {buttonLabel}
        </motion.button>
        <p className="mt-2 text-xs leading-5 text-zinc-500">Saved changes refresh the active scope board automatically.</p>
      </div>
    </motion.form>
  )
}

function EditorGuidance({ editorKey }: { editorKey: SettingsEditorKey }) {
  const guidance = getEditorGuidance(editorKey)
  const mapLocation = getEditorMapLocation(editorKey)

  return (
    <div className="border-b border-zinc-200 bg-zinc-100/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Where this appears</p>
      <p className="mt-2 text-sm font-semibold">{mapLocation}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{guidance.body}</p>
    </div>
  )
}

function getEditorMapLocation(editorKey: SettingsEditorKey) {
  const locations: Record<SettingsEditorKey, string> = {
    season: 'Season Setup / Season card',
    circuit: 'Global Library / Circuit card',
    seriesRace: 'Global Library / Series card',
    grade: 'Global Library / Grade card',
    seasonSeries: 'Season Setup / Season Series card',
    seasonSeriesGrade: 'Season Setup / Season Grade card',
    event: 'Event Setup / Event card',
    race: 'Race Sessions / Session card',
    eventSeriesRule: 'Rule Packages / Package card',
    weightRule: 'Rule Packages / Weight Rule card',
    ballastRule: 'Rule Packages / Success Ballast card',
    tireRule: 'Rule Packages / Tire Rule card',
    sponsorStickerAsset: 'Rule Packages / Sponsor Sticker card',
    printBackgroundAsset: 'Event Setup / Official Assets card',
    inspectionTemplate: 'Rule Packages / Inspection Form card',
    inspectionSection: 'Rule Packages / Inspection Form section',
    inspectionItem: 'Rule Packages / Inspection Form item',
  }

  return locations[editorKey]
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

type ScopeBoardProps = {
  activeScope: OrganizerScope
  filter: ScopeFilter
  payload: OrganizerPayload
  eventsBySeason: Map<string, EventRow[]>
  racesByEvent: Map<string, RaceRow[]>
  eventSeriesRulesByEvent: Map<string, EventSeriesRuleRow[]>
  weightRulesByEventRule: Map<string, WeightRuleRow[]>
  ballastRulesByEventRule: Map<string, BallastRuleRow[]>
  tireRulesByEventRule: Map<string, TireRuleRow[]>
  sponsorStickerAssetsByEventRule: Map<string, SponsorStickerAssetRow[]>
  printBackgroundAssetsByEvent: Map<string, PrintBackgroundAssetRow[]>
  inspectionTemplatesByEventRule: Map<string, InspectionTemplateRow[]>
  seasonSeriesBySeason: Map<string, SeasonSeriesRow[]>
  seasonSeriesGradesBySeries: Map<string, SeasonSeriesGradeRow[]>
  onCreateCircuit: () => void
  onEditCircuit: (circuit: CircuitOption) => void
  onCreateSeriesRace: () => void
  onEditSeriesRace: (seriesRace: SeriesRaceRow) => void
  onCreateGrade: () => void
  onEditGrade: (grade: GradeRow) => void
  onCreateSeason: () => void
  onEditSeason: (season: SeasonRow) => void
  onDuplicateSeason: (season: SeasonRow) => void
  onCreateSeasonSeries: (season: SeasonRow | null) => void
  onCreateSeasonGrade: (season: SeasonRow | null) => void
  onCreateEvent: (season: SeasonRow | null) => void
  onEditEvent: (event: EventRow) => void
  onDuplicateEvent: (event: EventRow) => void
  onCreatePrintBackgroundAsset: (event: EventRow | null) => void
  onEditPrintBackgroundAsset: (asset: PrintBackgroundAssetRow) => void
  onCreateEventSeriesRule: (event: EventRow | null) => void
  onEditEventSeriesRule: (rule: EventSeriesRuleRow) => void
  onCreateWeightRule: (rule: EventSeriesRuleRow) => void
  onEditWeightRule: (rule: WeightRuleRow) => void
  onCreateBallastRule: (rule: EventSeriesRuleRow) => void
  onEditBallastRule: (rule: BallastRuleRow) => void
  onCreateTireRule: (rule: EventSeriesRuleRow) => void
  onEditTireRule: (rule: TireRuleRow) => void
  onCreateSponsorStickerAsset: (rule: EventSeriesRuleRow) => void
  onEditSponsorStickerAsset: (asset: SponsorStickerAssetRow) => void
  onCreateInspectionTemplate: (rule: EventSeriesRuleRow) => void
  onEditInspectionTemplate: (template: InspectionTemplateRow) => void
  onEditInspectionSection: (section: InspectionTemplateSectionRow) => void
  onEditInspectionItem: (item: InspectionTemplateItemRow) => void
  onCreateRace: (event: EventRow | null) => void
  onEditRace: (race: RaceRow) => void
}

function ScopeDashboard({ setupBoard, activeScope }: { setupBoard: OrganizerSetupBoard; activeScope: OrganizerScope }) {
  const activeTab = organizerScopeTabs.find((tab) => tab.key === activeScope) ?? organizerScopeTabs[1]

  return (
    <section className="border border-zinc-200 dark:border-zinc-800">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
        <div className="border-l-2 border-primary pl-4">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Current board</p>
          <h2 className="mt-2 text-2xl font-semibold">{activeTab.label}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{activeTab.description} Default work starts at Season Setup, then moves to Events and Rule Packages.</p>
        </div>
        <SummaryCard label="Setup" value={setupBoard.completionPercent} suffix="%" />
        <SummaryCard label="Missing" value={setupBoard.missingCount} />
        <SummaryCard label="Steps" value={setupBoard.steps.length} />
        <div className="border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Active season</p>
          <p className="mt-2 text-lg font-semibold">{setupBoard.activeSeasonLabel}</p>
        </div>
      </div>
    </section>
  )
}

function ScopeSwitcher({ activeScope, onSelectScope }: { activeScope: OrganizerScope; onSelectScope: (scope: OrganizerScope) => void }) {
  return (
    <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Organizer setting scopes">
      {organizerScopeTabs.map((tab) => {
        const isActive = tab.key === activeScope

        return (
          <motion.button
            key={tab.key}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onSelectScope(tab.key)}
            className={`min-h-20 rounded-md border p-3 text-left transition ${
              isActive
                ? 'border-zinc-300 border-l-2 border-l-primary bg-zinc-50 dark:border-zinc-700 dark:border-l-primary dark:bg-zinc-950'
                : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
            }`}
          >
            <span className="block font-semibold">{tab.label}</span>
            <span className="mt-1 block text-sm leading-5 text-zinc-500">{tab.description}</span>
          </motion.button>
        )
      })}
    </nav>
  )
}

function ScopeToolbar({ filter, onChange }: { filter: ScopeFilter; onChange: (filter: ScopeFilter) => void }) {
  return (
    <div className="grid gap-3 border border-zinc-200 p-4 md:grid-cols-[1fr_auto] md:items-end dark:border-zinc-800">
      <label className="block">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Find setting</span>
        <input
          type="search"
          value={filter.query}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
          placeholder="Search season, event, series, grade, circuit..."
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
        />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-zinc-200 px-3 text-sm font-semibold dark:border-zinc-800">
        <input
          type="checkbox"
          checked={filter.needsAttentionOnly}
          onChange={(event) => onChange({ ...filter, needsAttentionOnly: event.target.checked })}
          className="size-4 accent-primary"
        />
        Needs attention only
      </label>
    </div>
  )
}

function ScopeBoard(props: ScopeBoardProps) {
  const activeSeason = props.payload.seasons.find((season) => season.isActive) ?? props.payload.seasons[0] ?? null
  const activeSeasonEvents = activeSeason ? props.eventsBySeason.get(activeSeason.seasonId) ?? [] : []
  const firstEvent = activeSeasonEvents[0] ?? props.payload.events[0] ?? null

  return (
    <section className="border border-zinc-200 dark:border-zinc-800">
      {props.activeScope === 'global' ? <GlobalScopeBoard {...props} /> : null}
      {props.activeScope === 'season' ? <SeasonScopeBoard {...props} activeSeason={activeSeason} /> : null}
      {props.activeScope === 'event' ? <EventScopeBoard {...props} activeSeason={activeSeason} events={activeSeasonEvents} /> : null}
      {props.activeScope === 'rule' ? <RuleScopeBoard {...props} event={firstEvent} events={activeSeasonEvents.length > 0 ? activeSeasonEvents : props.payload.events} /> : null}
      {props.activeScope === 'race' ? <RaceScopeBoard {...props} event={firstEvent} events={activeSeasonEvents.length > 0 ? activeSeasonEvents : props.payload.events} /> : null}
    </section>
  )
}

function ScopeBoardHeader({ scope, title, description, actionLabel, onAction }: { scope: OrganizerScope; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
      <div>
        <ScopeBadge scope={scope} />
        <h2 className="mt-3 text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      {actionLabel && onAction ? <PrimaryActionButton label={actionLabel} onClick={onAction} /> : null}
    </div>
  )
}

function filterByQuery<T>(items: T[], query: string, getValues: (item: T) => string[]) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return items
  return items.filter((item) => getValues(item).some((value) => value.toLowerCase().includes(normalizedQuery)))
}

function ScopeEmptyMessage({ filter, defaultMessage }: { filter: ScopeFilter; defaultMessage: string }) {
  const message = filter.needsAttentionOnly
    ? 'No attention items in this card.'
    : filter.query.trim()
      ? 'No matching settings found.'
      : defaultMessage

  return <p className="text-sm leading-6 text-zinc-500">{message}</p>
}

function GlobalScopeBoard({ payload, filter, onCreateCircuit, onEditCircuit, onCreateSeriesRace, onEditSeriesRace, onCreateGrade, onEditGrade }: ScopeBoardProps) {
  const circuits = filter.needsAttentionOnly ? [] : filterByQuery(payload.circuits, filter.query, (circuit) => [circuit.name, circuit.country, circuit.location ?? ''])
  const seriesRaces = filter.needsAttentionOnly ? [] : filterByQuery(payload.seriesRaces, filter.query, (seriesRace) => [seriesRace.code, seriesRace.name, seriesRace.ballastType])
  const grades = filter.needsAttentionOnly ? [] : filterByQuery(payload.grades, filter.query, (grade) => [grade.code, grade.name])

  return (
    <>
      <ScopeBoardHeader scope="global" title="Global Library" description="Reusable settings that can be used by many seasons and events. These are not tied to one race weekend." />
      <div className="grid gap-3 p-4 lg:grid-cols-3">
        <ScopeCard scope="global" title="Circuits" description="Tracks that Events can select." statusLabel={`${payload.circuits.length} configured`} actionLabel="Add Circuit" onAction={onCreateCircuit}>
          {circuits.length === 0 ? <ScopeEmptyMessage filter={filter} defaultMessage="No circuits configured yet." /> : null}
          {circuits.map((circuit) => <AssetPill key={circuit.circuitId} label={`${circuit.name} / ${circuit.country}`} onClick={() => onEditCircuit(circuit)} />)}
        </ScopeCard>
        <ScopeCard scope="global" title="Series" description="Competition groups reused across seasons." statusLabel={`${payload.seriesRaces.length} configured`} actionLabel="Add Series" onAction={onCreateSeriesRace}>
          {seriesRaces.length === 0 ? <ScopeEmptyMessage filter={filter} defaultMessage="No series configured yet." /> : null}
          {seriesRaces.map((seriesRace) => <AssetPill key={seriesRace.seriesRaceId} label={`${seriesRace.code} / ${seriesRace.name}`} onClick={() => onEditSeriesRace(seriesRace)} />)}
        </ScopeCard>
        <ScopeCard scope="global" title="Grades" description="Class levels such as PRO or AM." statusLabel={`${payload.grades.length} configured`} actionLabel="Add Grade" onAction={onCreateGrade}>
          {grades.length === 0 ? <ScopeEmptyMessage filter={filter} defaultMessage="No grades configured yet." /> : null}
          {grades.map((grade) => <AssetPill key={grade.gradeId} label={`${grade.code} / ${grade.name}`} onClick={() => onEditGrade(grade)} />)}
        </ScopeCard>
      </div>
    </>
  )
}

function SeasonScopeBoard({ payload, activeSeason, filter, seasonSeriesBySeason, seasonSeriesGradesBySeries, onCreateSeason, onEditSeason, onDuplicateSeason, onCreateSeasonSeries, onCreateSeasonGrade }: ScopeBoardProps & { activeSeason: SeasonRow | null }) {
  const seasons = filterByQuery(payload.seasons, filter.query, (season) => [season.name, String(season.year), season.status, season.isActive ? 'active season' : 'inactive season'])
    .filter((season) => !filter.needsAttentionOnly || seasonNeedsAttention(season, seasonSeriesBySeason, seasonSeriesGradesBySeries))
  const showNoActiveSeason = !activeSeason && (!filter.query.trim() || 'no active season missing'.includes(filter.query.trim().toLowerCase()))

  return (
    <>
      <ScopeBoardHeader scope="season" title="Season Setup" description="This board controls the racing year: Season record, active Series, and available Grades. Start here before Events and Rule Packages." actionLabel="Create Season" onAction={onCreateSeason} />
      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {seasons.length === 0 && payload.seasons.length === 0 ? <ScopeCard scope="season" title="No Seasons yet" description="Create the first racing year before building Events and Rule Packages." statusLabel="Missing" actionLabel="Create Season" onAction={onCreateSeason}><ScopeEmptyMessage filter={filter} defaultMessage="No seasons configured. Create the first season to start building events and races." /></ScopeCard> : null}
        {seasons.length === 0 && payload.seasons.length > 0 ? <ScopeCard scope="season" title="No Seasons match" description="Adjust search or clear the attention filter to return to the Season board." statusLabel="Filtered"><ScopeEmptyMessage filter={filter} defaultMessage="No seasons configured." /></ScopeCard> : null}
        {seasons.map((season) => {
          const seasonSeries = seasonSeriesBySeason.get(season.seasonId) ?? []
          const gradeCount = seasonSeries.reduce((total, series) => total + (seasonSeriesGradesBySeries.get(series.seasonSeriesId) ?? []).length, 0)

          return (
            <ScopeCard key={season.seasonId} scope="season" title={`${season.year} / ${season.name}`} description={season.isActive ? 'Active racing season.' : 'Season configuration.'} statusLabel={season.status} actionLabel="Edit Season" onAction={() => onEditSeason(season)}>
              <div className="flex flex-wrap gap-2">
                <TextButton label="Duplicate Season" onClick={() => onDuplicateSeason(season)} />
                <TextButton label="Add Season Series" onClick={() => onCreateSeasonSeries(season)} />
                <TextButton label="Add Season Grade" onClick={() => onCreateSeasonGrade(season)} />
              </div>
              <p className="text-sm text-zinc-500">{seasonSeries.length} series link(s) / {gradeCount} grade link(s)</p>
              {seasonSeries.length === 0 ? <p className="text-sm text-amber-700 dark:text-amber-400">Season series missing.</p> : null}
              {seasonSeries.length > 0 && gradeCount === 0 ? <p className="text-sm text-amber-700 dark:text-amber-400">Season grades missing.</p> : null}
              {seasonSeries.map((series) => {
                const grades = seasonSeriesGradesBySeries.get(series.seasonSeriesId) ?? []
                return <AssetPill key={series.seasonSeriesId} label={`${series.seriesName} / ${grades.length > 0 ? grades.map((grade) => grade.gradeName).join(', ') : 'No grades'}`} onClick={() => onCreateSeasonGrade(season)} />
              })}
            </ScopeCard>
          )
        })}
        {showNoActiveSeason ? <ScopeCard scope="season" title="No active season" description="Create or activate a Season before building Events." statusLabel="Missing" actionLabel="Create Season" onAction={onCreateSeason} /> : null}
      </div>
    </>
  )
}

function EventScopeBoard({ events, filter, printBackgroundAssetsByEvent, onCreateEvent, onEditEvent, onDuplicateEvent, onCreatePrintBackgroundAsset, onEditPrintBackgroundAsset, activeSeason }: ScopeBoardProps & { events: EventRow[]; activeSeason: SeasonRow | null }) {
  const filteredEvents = filterByQuery(events, filter.query, (event) => [event.name, event.circuitName ?? 'no circuit', event.status, String(event.eventOrder), formatDateRange(event.startsOn, event.endsOn)])
    .filter((event) => !filter.needsAttentionOnly || eventNeedsAttention(event, printBackgroundAssetsByEvent))

  return (
    <>
      <ScopeBoardHeader scope="event" title="Event Setup" description="Event-level settings belong to one race weekend: circuit, dates, status, and A4 print backgrounds." actionLabel="Create Event" onAction={() => onCreateEvent(activeSeason)} />
      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {filteredEvents.length === 0 ? <ScopeCard scope="event" title={events.length === 0 ? 'No Events yet' : 'No Events match'} description={events.length === 0 ? 'Create the first race weekend for this Season.' : 'Adjust search or clear the attention filter to return to the Event board.'} statusLabel={events.length === 0 ? 'Missing' : 'Filtered'} actionLabel={events.length === 0 ? 'Create Event' : undefined} onAction={events.length === 0 ? () => onCreateEvent(activeSeason) : undefined}><ScopeEmptyMessage filter={filter} defaultMessage="No events configured yet." /></ScopeCard> : null}
        {filteredEvents.map((event) => {
          const assets = printBackgroundAssetsByEvent.get(event.eventId) ?? []
          return (
            <ScopeCard key={event.eventId} scope="event" title={`Event ${event.eventOrder}: ${event.name}`} description={`${event.circuitName ?? 'No circuit'} / ${formatDateRange(event.startsOn, event.endsOn)}`} statusLabel={event.status} actionLabel="Edit Event" onAction={() => onEditEvent(event)}>
              <div className="flex flex-wrap gap-2">
                <TextButton label="Duplicate Event" onClick={() => onDuplicateEvent(event)} />
                <TextButton label="Add A4 Background" onClick={() => onCreatePrintBackgroundAsset(event)} />
              </div>
              {!event.circuitId ? <p className="text-sm text-amber-700 dark:text-amber-400">Circuit missing.</p> : null}
              {assets.length === 0 ? <p className="text-sm text-amber-700 dark:text-amber-400">A4 background missing.</p> : null}
              {assets.map((asset) => <AssetPill key={asset.printBackgroundAssetId} label={`${formatOrientation(asset.orientation)} / ${asset.title}${asset.isDefault ? ' / Default' : ''}`} onClick={() => onEditPrintBackgroundAsset(asset)} />)}
            </ScopeCard>
          )
        })}
      </div>
    </>
  )
}

function RuleScopeBoard(props: ScopeBoardProps & { event: EventRow | null; events: EventRow[] }) {
  const rules = props.events.flatMap((event) => props.eventSeriesRulesByEvent.get(event.eventId) ?? [])
  const filteredRules = filterByQuery(rules, props.filter.query, (rule) => [rule.eventName, rule.seriesName, rule.gradeName, rule.status, `v${rule.version}`])
    .filter((rule) => !props.filter.needsAttentionOnly || !getRulePackageReadiness(rule, props.weightRulesByEventRule, props.ballastRulesByEventRule, props.tireRulesByEventRule, props.sponsorStickerAssetsByEventRule, props.inspectionTemplatesByEventRule).ready)

  return (
    <>
      <ScopeBoardHeader scope="rule" title="Rule Packages" description="Rule Package-level settings are specific to one Event + Series + Grade. They drive Entry Forms, Inspection, Weight-In, sponsor stickers, and official documents." actionLabel="Create Rule Package" onAction={() => props.onCreateEventSeriesRule(props.event)} />
      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {filteredRules.length === 0 ? <ScopeCard scope="rule" title={rules.length === 0 ? 'No Rule Packages yet' : 'No Rule Packages match'} description={rules.length === 0 ? 'Create one for each Series and Grade running in the selected Event.' : 'Adjust search or clear the attention filter to return to all Rule Packages.'} statusLabel={rules.length === 0 ? 'Missing' : 'Filtered'} actionLabel={rules.length === 0 ? 'Create Rule Package' : undefined} onAction={rules.length === 0 ? () => props.onCreateEventSeriesRule(props.event) : undefined}><ScopeEmptyMessage filter={props.filter} defaultMessage="No rule packages configured yet." /></ScopeCard> : null}
        {filteredRules.map((rule) => (
          <RulePackageCard
            key={rule.eventSeriesRuleId}
            rule={rule}
            readiness={getRulePackageReadiness(rule, props.weightRulesByEventRule, props.ballastRulesByEventRule, props.tireRulesByEventRule, props.sponsorStickerAssetsByEventRule, props.inspectionTemplatesByEventRule)}
            weightRules={props.weightRulesByEventRule.get(rule.eventSeriesRuleId) ?? []}
            ballastRules={props.ballastRulesByEventRule.get(rule.eventSeriesRuleId) ?? []}
            tireRules={props.tireRulesByEventRule.get(rule.eventSeriesRuleId) ?? []}
            sponsorStickerAssets={props.sponsorStickerAssetsByEventRule.get(rule.eventSeriesRuleId) ?? []}
            templates={props.inspectionTemplatesByEventRule.get(rule.eventSeriesRuleId) ?? []}
            onEditRule={props.onEditEventSeriesRule}
            onCreateWeightRule={props.onCreateWeightRule}
            onCreateBallastRule={props.onCreateBallastRule}
            onCreateTireRule={props.onCreateTireRule}
            onCreateSponsorStickerAsset={props.onCreateSponsorStickerAsset}
            onCreateInspectionTemplate={props.onCreateInspectionTemplate}
            onEditWeightRule={props.onEditWeightRule}
            onEditBallastRule={props.onEditBallastRule}
            onEditTireRule={props.onEditTireRule}
            onEditSponsorStickerAsset={props.onEditSponsorStickerAsset}
            onEditInspectionTemplate={props.onEditInspectionTemplate}
            onEditInspectionSection={props.onEditInspectionSection}
            onEditInspectionItem={props.onEditInspectionItem}
          />
        ))}
      </div>
    </>
  )
}

function RaceScopeBoard({ event, events, filter, racesByEvent, onCreateRace, onEditRace }: ScopeBoardProps & { event: EventRow | null; events: EventRow[] }) {
  const filteredEvents = filterByQuery(events, filter.query, (eventRow) => [eventRow.name, eventRow.circuitName ?? '', eventRow.status, String(eventRow.eventOrder), ...(racesByEvent.get(eventRow.eventId) ?? []).flatMap((race) => [race.name, race.sessionType, String(race.raceOrder)])])
    .filter((eventRow) => !filter.needsAttentionOnly || (racesByEvent.get(eventRow.eventId) ?? []).length === 0)

  return (
    <>
      <ScopeBoardHeader scope="race" title="Race Sessions" description="Race-level settings are sessions inside Events. They do not control technical rules." actionLabel="Create Race Session" onAction={() => onCreateRace(event)} />
      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {filteredEvents.length === 0 ? <ScopeCard scope="race" title={events.length === 0 ? 'No Events yet' : 'No Race Session groups match'} description={events.length === 0 ? 'Create an Event before adding Race Sessions.' : 'Adjust search or clear the attention filter to return to Race Sessions.'} statusLabel={events.length === 0 ? 'Waiting' : 'Filtered'}><ScopeEmptyMessage filter={filter} defaultMessage={events.length === 0 ? 'No Events available for Race Sessions yet.' : 'No race session groups found.'} /></ScopeCard> : null}
        {filteredEvents.map((eventRow) => {
          const races = racesByEvent.get(eventRow.eventId) ?? []
          return (
            <ScopeCard key={eventRow.eventId} scope="race" title={`Event ${eventRow.eventOrder}: ${eventRow.name}`} description="Practice, qualifying, and race sessions." statusLabel={`${races.length} session(s)`} actionLabel="Add Race Session" onAction={() => onCreateRace(eventRow)}>
              {races.length === 0 ? <p className="text-sm text-amber-700 dark:text-amber-400">No race sessions yet.</p> : null}
              {races.map((race) => <AssetPill key={race.raceId} label={`${race.raceOrder}. ${race.name} / ${race.sessionType}`} onClick={() => onEditRace(race)} />)}
            </ScopeCard>
          )
        })}
      </div>
    </>
  )
}

function seasonNeedsAttention(season: SeasonRow, seasonSeriesBySeason: Map<string, SeasonSeriesRow[]>, seasonSeriesGradesBySeries: Map<string, SeasonSeriesGradeRow[]>) {
  const seasonSeries = seasonSeriesBySeason.get(season.seasonId) ?? []
  return seasonSeries.length === 0 || seasonSeries.some((series) => (seasonSeriesGradesBySeries.get(series.seasonSeriesId) ?? []).length === 0)
}

function eventNeedsAttention(event: EventRow, printBackgroundAssetsByEvent: Map<string, PrintBackgroundAssetRow[]>) {
  return !event.circuitId || (printBackgroundAssetsByEvent.get(event.eventId) ?? []).length === 0
}

function ScopeCard({ scope, title, description, statusLabel, actionLabel, onAction, children }: { scope: OrganizerScope; title: string; description: string; statusLabel: string; actionLabel?: string; onAction?: () => void; children?: React.ReactNode }) {
  return (
    <article className="flex min-h-64 flex-col rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <ScopeBadge scope={scope} />
        <StatusBadge label={statusLabel} tone={statusLabel.toLowerCase().includes('missing') ? 'warning' : 'neutral'} />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      <div className="mt-4 flex flex-1 flex-wrap content-start gap-2">{children}</div>
      {actionLabel && onAction ? <div className="mt-4"><TextButton label={actionLabel} onClick={onAction} /></div> : null}
    </article>
  )
}

function ScopeBadge({ scope }: { scope: OrganizerScope }) {
  const labels: Record<OrganizerScope, string> = {
    global: 'Global',
    season: 'Season level',
    event: 'Event level',
    rule: 'Rule package',
    race: 'Race level',
  }

  return <span className="rounded-md border border-zinc-200 px-2 py-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800">{labels[scope]}</span>
}

function PrimaryActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white">
      {label}
      <ArrowRight size={16} />
    </motion.button>
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
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Focused editor</p>
                  <h2 id="settings-editor-title" className="mt-1 text-2xl font-semibold">{activeEditorMeta.label}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Opened from a scope card. Complete this one setup item, then return to the board.</p>
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

function RulePackageCard({
  rule,
  readiness,
  weightRules,
  ballastRules,
  tireRules,
  sponsorStickerAssets,
  templates,
  onEditRule,
  onCreateWeightRule,
  onCreateBallastRule,
  onCreateTireRule,
  onCreateSponsorStickerAsset,
  onCreateInspectionTemplate,
  onEditWeightRule,
  onEditBallastRule,
  onEditTireRule,
  onEditSponsorStickerAsset,
  onEditInspectionTemplate,
  onEditInspectionSection,
  onEditInspectionItem,
}: {
  rule: EventSeriesRuleRow
  readiness: RulePackageReadiness
  weightRules: WeightRuleRow[]
  ballastRules: BallastRuleRow[]
  tireRules: TireRuleRow[]
  sponsorStickerAssets: SponsorStickerAssetRow[]
  templates: InspectionTemplateRow[]
  onEditRule: (rule: EventSeriesRuleRow) => void
  onCreateWeightRule: (rule: EventSeriesRuleRow) => void
  onCreateBallastRule: (rule: EventSeriesRuleRow) => void
  onCreateTireRule: (rule: EventSeriesRuleRow) => void
  onCreateSponsorStickerAsset: (rule: EventSeriesRuleRow) => void
  onCreateInspectionTemplate: (rule: EventSeriesRuleRow) => void
  onEditWeightRule: (rule: WeightRuleRow) => void
  onEditBallastRule: (rule: BallastRuleRow) => void
  onEditTireRule: (rule: TireRuleRow) => void
  onEditSponsorStickerAsset: (asset: SponsorStickerAssetRow) => void
  onEditInspectionTemplate: (template: InspectionTemplateRow) => void
  onEditInspectionSection: (section: InspectionTemplateSectionRow) => void
  onEditInspectionItem: (item: InspectionTemplateItemRow) => void
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{rule.seriesName} / {rule.gradeName}</p>
            <StatusBadge label={readiness.ready ? 'Ready' : 'Missing setup'} tone={readiness.ready ? 'success' : 'warning'} />
          </div>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">Rule package v{rule.version} / {rule.status}</p>
          {readiness.missingLabels.length > 0 ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Missing: {readiness.missingLabels.join(', ')}</p> : null}
        </div>
        <TextButton label="Edit package" onClick={() => onEditRule(rule)} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <RuleAssetGroup title="Weight Rule" emptyLabel="Missing weight rule" onCreate={() => onCreateWeightRule(rule)}>
          {weightRules.map((weightRule) => (
            <AssetPill key={weightRule.weightRuleId} label={`${weightRule.name} / base ${weightRule.baseWeightKg} kg`} onClick={() => onEditWeightRule(weightRule)} />
          ))}
        </RuleAssetGroup>
        <RuleAssetGroup title="Success Ballast" emptyLabel="Missing success ballast" onCreate={() => onCreateBallastRule(rule)}>
          {ballastRules.map((ballastRule) => (
            <AssetPill key={ballastRule.ballastRuleId} label={`${ballastRule.ballastType} / max ${ballastRule.maxBallastKg ?? 'none'} kg`} onClick={() => onEditBallastRule(ballastRule)} />
          ))}
        </RuleAssetGroup>
        <RuleAssetGroup title="Tire Rule" emptyLabel="Missing tire rule" onCreate={() => onCreateTireRule(rule)}>
          {tireRules.map((tireRule) => (
            <AssetPill key={tireRule.tireRuleId} label={`${tireRule.tireBrand}${tireRule.tireModel ? ` ${tireRule.tireModel}` : ''} / ${tireRule.isAllowed ? 'Allowed' : 'Disallowed'}`} onClick={() => onEditTireRule(tireRule)} />
          ))}
        </RuleAssetGroup>
        <RuleAssetGroup title="Sponsor Sticker" emptyLabel="Missing sponsor sticker" onCreate={() => onCreateSponsorStickerAsset(rule)}>
          {sponsorStickerAssets.map((asset) => (
            <AssetPill key={asset.sponsorStickerAssetId} label={`${asset.title} / ${asset.filename}`} onClick={() => onEditSponsorStickerAsset(asset)} />
          ))}
        </RuleAssetGroup>
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Inspection Form</p>
            <p className="mt-1 text-xs text-zinc-500">Template, sections, and field items for scrutineering.</p>
          </div>
          {templates.length === 0 ? <TextButton label="Missing inspection form" onClick={() => onCreateInspectionTemplate(rule)} /> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {templates.map((template) => (
            <AssetPill key={template.templateId} label={`${template.name} / v${template.version} / ${template.isActive ? 'Active' : 'Inactive'}`} onClick={() => onEditInspectionTemplate(template)} />
          ))}
          {templates.flatMap((template) => template.sections).map((section) => (
            <AssetPill key={section.sectionId} label={`Section / ${section.title} / ${section.items.length} item(s)`} onClick={() => onEditInspectionSection(section)} />
          ))}
          {templates.flatMap((template) => template.sections).flatMap((section) => section.items).map((item) => (
            <AssetPill key={item.itemId} label={`Item / ${item.labelTh} / ${item.inputType}`} onClick={() => onEditInspectionItem(item)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RuleAssetGroup({ title, emptyLabel, onCreate, children }: { title: string; emptyLabel: string; onCreate: () => void; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {hasChildren ? children : <TextButton label={emptyLabel} onClick={onCreate} />}
      </div>
    </div>
  )
}

function AssetPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs font-semibold transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
      {label}
    </button>
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

function TextAreaField({ label, value, onChange, placeholder, helperText }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; helperText?: string }) {
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
      {helperText ? <span className="mt-2 block text-xs leading-5 text-zinc-500">{helperText}</span> : null}
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

function SummaryCard({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}{suffix}</p>
    </div>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'neutral' }) {
  const className = tone === 'success'
    ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
    : tone === 'warning'
      ? 'border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-900/60 dark:text-amber-400'
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
