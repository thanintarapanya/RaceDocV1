import { motion } from 'framer-motion'
import { CalendarDays, Flag, Loader2, MapPinned, RefreshCcw, Save, Wrench } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type OrganizationOption = {
  organizationId: string
  name: string
  slug: string
  isActive: boolean
}

type CircuitOption = {
  circuitId: string
  name: string
  location: string | null
  country: string
}

type SeasonRow = {
  seasonId: string
  organizationId: string
  name: string
  year: number
  status: SeasonStatus
  isActive: boolean
  activatedAt: string | null
}

type EventRow = {
  eventId: string
  seasonId: string
  circuitId: string | null
  circuitName: string | null
  name: string
  eventOrder: number
  startsOn: string | null
  endsOn: string | null
  status: EventStatus
}

type RaceRow = {
  raceId: string
  eventId: string
  name: string
  raceOrder: number
  sessionType: string
  scheduledAt: string | null
  resultsImportUnlocked: boolean
}

type OrganizerPayload = {
  canManage: boolean
  organizations: OrganizationOption[]
  circuits: CircuitOption[]
  seasons: SeasonRow[]
  events: EventRow[]
  races: RaceRow[]
}

type SeasonStatus = 'Draft' | 'Active' | 'Completed' | 'Archived'
type EventStatus = 'Draft' | 'RegistrationOpen' | 'Active' | 'Completed' | 'Cancelled'

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

const emptyPayload: OrganizerPayload = {
  canManage: false,
  organizations: [],
  circuits: [],
  seasons: [],
  events: [],
  races: [],
}

const seasonStatuses: SeasonStatus[] = ['Draft', 'Active', 'Completed', 'Archived']
const eventStatuses: EventStatus[] = ['Draft', 'RegistrationOpen', 'Active', 'Completed', 'Cancelled']
const sessionTypes = ['Practice', 'Qualifying', 'Race']

export function OrganizerSettingsPage() {
  const [payload, setPayload] = useState<OrganizerPayload>(emptyPayload)
  const [loading, setLoading] = useState(true)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [circuitForm, setCircuitForm] = useState<CircuitForm>(() => createEmptyCircuitForm())
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(() => createEmptySeasonForm())
  const [eventForm, setEventForm] = useState<EventForm>(() => createEmptyEventForm())
  const [raceForm, setRaceForm] = useState<RaceForm>(() => createEmptyRaceForm())

  const loadData = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_organizer_settings')

    if (!isActive()) return

    if (error) {
      setPayload(emptyPayload)
      setError(error.message)
    } else {
      const nextPayload = normalizePayload(data as OrganizerPayload | null)
      setPayload(nextPayload)
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
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,27rem)_1fr]">
          <div className="grid gap-5">
            <SettingsForm title="Circuit" icon={MapPinned} onSubmit={saveCircuit} updating={updatingKey === 'circuit'} buttonLabel={circuitForm.circuitId ? 'Update Circuit' : 'Create Circuit'}>
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

            <SettingsForm title="Season" icon={CalendarDays} onSubmit={saveSeason} updating={updatingKey === 'season'} buttonLabel={seasonForm.seasonId ? 'Update Season' : 'Create Season'}>
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

            <SettingsForm title="Event" icon={Flag} onSubmit={saveEvent} updating={updatingKey === 'event'} buttonLabel={eventForm.eventId ? 'Update Event' : 'Create Event'}>
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

            <SettingsForm title="Race" icon={Wrench} onSubmit={saveRace} updating={updatingKey === 'race'} buttonLabel={raceForm.raceId ? 'Update Race' : 'Create Race'}>
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
          </div>

          <section className="border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Calendar foundation</p>
              <h2 className="mt-2 text-xl font-semibold">Season Structure</h2>
            </div>
            <div className="grid gap-3 border-b border-zinc-200 p-4 sm:grid-cols-4 dark:border-zinc-800">
              <SummaryCard label="Seasons" value={payload.seasons.length} />
              <SummaryCard label="Events" value={payload.events.length} />
              <SummaryCard label="Races" value={payload.races.length} />
              <SummaryCard label="Circuits" value={payload.circuits.length} />
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payload.seasons.length === 0 ? <EmptyState /> : null}
              {payload.seasons.map((season) => (
                <SeasonPanel
                  key={season.seasonId}
                  season={season}
                  events={eventsBySeason.get(season.seasonId) ?? []}
                  racesByEvent={racesByEvent}
                  onEditSeason={() => setSeasonForm(createSeasonForm(season))}
                  onEditEvent={(event) => setEventForm(createEventForm(event))}
                  onEditRace={(race) => setRaceForm(createRaceForm(race))}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function SettingsForm({
  title,
  icon: Icon,
  children,
  onSubmit,
  updating,
  buttonLabel,
}: {
  title: string
  icon: typeof Wrench
  children: React.ReactNode
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  updating: boolean
  buttonLabel: string
}) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      onSubmit={onSubmit}
      className="border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-1 text-primary" size={20} />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
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

function SeasonPanel({
  season,
  events,
  racesByEvent,
  onEditSeason,
  onEditEvent,
  onEditRace,
}: {
  season: SeasonRow
  events: EventRow[]
  racesByEvent: Map<string, RaceRow[]>
  onEditSeason: () => void
  onEditEvent: (event: EventRow) => void
  onEditRace: (race: RaceRow) => void
}) {
  return (
    <article className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{season.year} / {season.name}</h3>
            <StatusBadge label={season.status} tone={season.isActive ? 'success' : 'neutral'} />
          </div>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">{events.length} event(s)</p>
        </div>
        <TextButton label="Edit season" onClick={onEditSeason} />
      </div>
      <div className="mt-4 grid gap-3">
        {events.length === 0 ? <p className="text-sm text-zinc-500">No events configured for this season.</p> : null}
        {events.map((event) => (
          <div key={event.eventId} className="border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{event.eventOrder}. {event.name}</p>
                <p className="mt-1 text-sm text-zinc-500">{event.circuitName ?? 'No circuit'} / {formatDateRange(event.startsOn, event.endsOn)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={event.status} tone={event.status === 'Active' ? 'success' : 'neutral'} />
                <TextButton label="Edit event" onClick={() => onEditEvent(event)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        ))}
      </div>
    </article>
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
      onClick={onClick}
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

function normalizePayload(payload: OrganizerPayload | null): OrganizerPayload {
  return {
    canManage: Boolean(payload?.canManage),
    organizations: payload?.organizations ?? [],
    circuits: payload?.circuits ?? [],
    seasons: payload?.seasons ?? [],
    events: payload?.events ?? [],
    races: payload?.races ?? [],
  }
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
