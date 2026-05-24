import { motion } from 'framer-motion'
import { Building2, RefreshCcw, Save, Send, ShieldCheck, UserCheck, UserMinus, Users, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { supabase } from '@/lib/supabase'
import { createTeamInfoForm, createTeamInfoPayload, getTeamInfoCompletionLabel, type TeamInfo, type TeamInfoForm } from './teamPageHelpers'

type TeamMembership = {
  id: string
  teamId: string
  teamName: string
  managerName: string | null
  seasonId: string
  seasonName: string
  competitorProfileId: string
  competitorName: string | null
  competitorNameEn: string | null
  competitorEmail: string | null
  acceptedAt: string | null
}

type TeamInvitation = {
  id: string
  teamId: string
  teamName: string
  managerName: string | null
  seasonId: string
  seasonName: string
  competitorProfileId: string
  competitorName: string | null
  competitorNameEn: string | null
  competitorEmail: string | null
  direction: 'ManagerToCompetitor' | 'CompetitorToManager'
  status: string
  expiresAt: string | null
  createdAt: string | null
}

type TeamRelationships = {
  isTeamManager: boolean
  isCompetitor: boolean
  myTeam: TeamInfo | null
  activeMemberships: TeamMembership[]
  pendingReceived: TeamInvitation[]
  pendingSent: TeamInvitation[]
}

const emptyRelationships: TeamRelationships = {
  isTeamManager: false,
  isCompetitor: false,
  myTeam: null,
  activeMemberships: [],
  pendingReceived: [],
  pendingSent: [],
}

export function TeamPage() {
  const { roles } = useAuth()
  const [relationships, setRelationships] = useState<TeamRelationships>(emptyRelationships)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingTeamInfo, setSavingTeamInfo] = useState(false)
  const [email, setEmail] = useState('')
  const [teamInfoForm, setTeamInfoForm] = useState<TeamInfoForm>(() => createTeamInfoForm())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const isTeamManager = relationships.isTeamManager || roles.includes('TEAM_MANAGER')
  const isCompetitor = relationships.isCompetitor || roles.includes('COMPETITOR')
  const formLabel = isTeamManager ? 'Competitor email' : 'Team Manager email'
  const formDescription = isTeamManager
    ? 'Send an invitation to a competitor. They must accept before you can manage documents for them.'
    : 'Ask a Team Manager to represent you. They must accept before they can act on your behalf.'

  const loadRelationships = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_current_team_relationships')

    if (!isActive()) return

    if (error) {
      setRelationships(emptyRelationships)
      setTeamInfoForm(createTeamInfoForm())
      setError(error.message)
    } else {
      const nextRelationships = normalizeRelationships(data)
      setRelationships(nextRelationships)
      setTeamInfoForm(createTeamInfoForm(nextRelationships.myTeam))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    async function run() {
      await loadRelationships(() => active)
    }

    run()

    return () => {
      active = false
    }
  }, [loadRelationships])

  const primaryMembership = useMemo(() => {
    if (!isCompetitor) return null
    return relationships.activeMemberships[0] ?? null
  }, [isCompetitor, relationships.activeMemberships])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotice(null)

    const trimmedEmail = email.trim()
    const rpcName = isTeamManager ? 'invite_competitor_to_team' : 'request_team_manager'
    const params = isTeamManager ? { p_competitor_email: trimmedEmail } : { p_manager_email: trimmedEmail }
    const { error } = await supabase.rpc(rpcName, params)

    if (error) {
      setError(error.message)
    } else {
      setEmail('')
      setNotice(isTeamManager ? 'Invitation sent to competitor.' : 'Request sent to Team Manager.')
      await loadRelationships()
    }

    setSubmitting(false)
  }

  async function handleTeamInfoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingTeamInfo(true)
    setError(null)
    setNotice(null)

    if (!teamInfoForm.teamName.trim()) {
      setError('Team name is required.')
      setSavingTeamInfo(false)
      return
    }

    const { error } = await supabase.rpc('complete_team_manager_onboarding', createTeamInfoPayload(teamInfoForm))

    if (error) {
      setError(error.message)
    } else {
      setNotice('Team Info updated.')
      await loadRelationships()
    }

    setSavingTeamInfo(false)
  }

  async function respondToInvitation(invitationId: string, accept: boolean) {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('respond_team_invitation', {
      p_invitation_id: invitationId,
      p_accept: accept,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice(accept ? 'Relationship accepted.' : 'Request rejected.')
      await loadRelationships()
    }

    setSubmitting(false)
  }

  async function cancelInvitation(invitationId: string) {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('cancel_team_invitation', {
      p_invitation_id: invitationId,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('Pending request cancelled.')
      await loadRelationships()
    }

    setSubmitting(false)
  }

  async function revokeMembership(membershipId: string) {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('revoke_team_membership', {
      p_membership_id: membershipId,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('Team Manager access revoked.')
      await loadRelationships()
    }

    setSubmitting(false)
  }

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-zinc-800"
      >
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Team relationship</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Team & Competitor Access</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Team Managers can only act for competitors who accepted consent. Competitors can revoke access at any time.
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadRelationships()}
          disabled={loading || submitting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          {isTeamManager ? <TeamInfoEditor form={teamInfoForm} loading={loading} saving={savingTeamInfo} onChange={setTeamInfoForm} onSubmit={handleTeamInfoSubmit} /> : null}

          <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: 0.04 }}
            className="border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div className="flex items-start gap-3">
              <Send className="mt-1 text-primary" size={20} />
              <div>
                <h2 className="text-xl font-semibold">Create Request</h2>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">{formDescription}</p>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium" htmlFor="relationship-email">
                {formLabel}
              </label>
              <input
                id="relationship-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                required
              />
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || submitting || (!isTeamManager && !isCompetitor)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Send size={16} />
                {isTeamManager ? 'Invite Competitor' : 'Request Team Manager'}
              </motion.button>
            </form>

            <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Current scope</p>
              {relationships.myTeam ? (
                <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">{relationships.myTeam.teamName}</p>
                  <p className="mt-1">{relationships.myTeam.managerName ?? 'Team Manager name not set'}</p>
                </div>
              ) : primaryMembership ? (
                <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">{primaryMembership.teamName}</p>
                  <p className="mt-1">Accepted Team Manager relationship</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No active team relationship yet.</p>
              )}
            </div>
          </motion.article>
        </div>

        <div className="space-y-4">
          <RelationshipPanel
            title="Pending Received"
            icon={UserCheck}
            loading={loading}
            emptyText="No requests waiting for your approval."
          >
            {relationships.pendingReceived.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                disabled={submitting}
                onAccept={() => respondToInvitation(invitation.id, true)}
                onReject={() => respondToInvitation(invitation.id, false)}
              />
            ))}
          </RelationshipPanel>

          <RelationshipPanel title="Pending Sent" icon={Send} loading={loading} emptyText="No outgoing requests.">
            {relationships.pendingSent.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                disabled={submitting}
                onCancel={() => cancelInvitation(invitation.id)}
              />
            ))}
          </RelationshipPanel>

          <RelationshipPanel
            title={isTeamManager ? 'Accepted Competitors' : 'Active Team Manager'}
            icon={Users}
            loading={loading}
            emptyText="No accepted relationship yet."
          >
            {relationships.activeMemberships.map((membership) => (
              <MembershipRow
                key={membership.id}
                membership={membership}
                canRevoke={isCompetitor}
                showManager={isCompetitor}
                disabled={submitting}
                onRevoke={() => revokeMembership(membership.id)}
              />
            ))}
          </RelationshipPanel>
        </div>
      </section>
    </div>
  )
}

function TeamInfoEditor({ form, loading, saving, onChange, onSubmit }: { form: TeamInfoForm; loading: boolean; saving: boolean; onChange: (form: TeamInfoForm) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  function updateField(field: keyof TeamInfoForm, value: string) {
    onChange({ ...form, [field]: value })
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: 0.03 }}
      onSubmit={onSubmit}
      className="border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 text-primary" size={20} />
          <div>
            <h2 className="text-xl font-semibold">Team Info</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Keep official team details current for Entry Form prefills and team documents.</p>
          </div>
        </div>
        <span className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 px-3 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800">
          {getTeamInfoCompletionLabel(form)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TeamTextField label="Team Name" value={form.teamName} onChange={(value) => updateField('teamName', value)} required />
        <TeamTextField label="Manager Name" value={form.managerName} onChange={(value) => updateField('managerName', value)} />
        <TeamTextField label="Manager Mobile No." value={form.managerPhone} onChange={(value) => updateField('managerPhone', value)} inputMode="tel" />
        <TeamTextField label="Postcode" value={form.postcode} onChange={(value) => updateField('postcode', value)} inputMode="numeric" />
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Document Address</span>
          <textarea
            value={form.address}
            onChange={(event) => updateField('address', event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading || saving}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Save size={16} />
          {saving ? 'Saving Team Info' : 'Save Team Info'}
        </motion.button>
      </div>
    </motion.form>
  )
}

function TeamTextField({ label, value, onChange, required = false, inputMode }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; inputMode?: 'text' | 'tel' | 'numeric' }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      />
    </label>
  )
}

function RelationshipPanel({
  title,
  icon: Icon,
  loading,
  emptyText,
  children,
}: {
  title: string
  icon: LucideIcon
  loading: boolean
  emptyText: string
  children: ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: 0.08 }}
      className="border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-1 text-primary" size={20} />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
        {loading ? <div className="h-20 animate-pulse bg-zinc-100 dark:bg-zinc-900" /> : null}
        {!loading && hasChildren ? children : null}
        {!loading && !hasChildren ? <p className="py-5 text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p> : null}
      </div>
    </motion.section>
  )
}

function InvitationRow({
  invitation,
  disabled,
  onAccept,
  onReject,
  onCancel,
}: {
  invitation: TeamInvitation
  disabled: boolean
  onAccept?: () => void
  onReject?: () => void
  onCancel?: () => void
}) {
  return (
    <article className="py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-medium">{getInvitationTitle(invitation)}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {invitation.seasonName} / expires {formatDate(invitation.expiresAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAccept ? <SmallAction label="Accept" disabled={disabled} onClick={onAccept} primary /> : null}
          {onReject ? <SmallAction label="Reject" disabled={disabled} onClick={onReject} /> : null}
          {onCancel ? <SmallAction label="Cancel" disabled={disabled} onClick={onCancel} /> : null}
        </div>
      </div>
    </article>
  )
}

function MembershipRow({
  membership,
  canRevoke,
  showManager,
  disabled,
  onRevoke,
}: {
  membership: TeamMembership
  canRevoke: boolean
  showManager: boolean
  disabled: boolean
  onRevoke: () => void
}) {
  const primaryName = showManager
    ? membership.managerName ?? membership.teamName
    : membership.competitorName ?? membership.competitorNameEn ?? membership.teamName
  const detail = showManager
    ? `${membership.teamName} / ${membership.seasonName} / accepted ${formatDate(membership.acceptedAt)}`
    : `${membership.competitorEmail ?? 'Competitor email not set'} / ${membership.seasonName} / accepted ${formatDate(membership.acceptedAt)}`

  return (
    <article className="py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-medium">{primaryName}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{detail}</p>
        </div>
        {canRevoke ? (
          <SmallAction label="Revoke" disabled={disabled} onClick={onRevoke} icon={<UserMinus size={15} />} />
        ) : (
          <span className="inline-flex min-h-8 items-center rounded-md border border-emerald-200 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400">
            <ShieldCheck className="mr-2" size={14} />
            Accepted
          </span>
        )}
      </div>
    </article>
  )
}

function SmallAction({
  label,
  disabled,
  onClick,
  primary = false,
  icon,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  primary?: boolean
  icon?: ReactNode
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        primary
          ? 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
          : 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800'
      }
    >
      {icon}
      {label}
    </motion.button>
  )
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className =
    tone === 'success'
      ? 'mt-6 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
      : 'mt-6 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400'

  return <div className={className}>{message}</div>
}

function normalizeRelationships(data: unknown): TeamRelationships {
  const input = data && typeof data === 'object' ? (data as Partial<TeamRelationships>) : {}
  return {
    isTeamManager: Boolean(input.isTeamManager),
    isCompetitor: Boolean(input.isCompetitor),
    myTeam: input.myTeam ?? null,
    activeMemberships: Array.isArray(input.activeMemberships) ? input.activeMemberships : [],
    pendingReceived: Array.isArray(input.pendingReceived) ? input.pendingReceived : [],
    pendingSent: Array.isArray(input.pendingSent) ? input.pendingSent : [],
  }
}

function getInvitationTitle(invitation: TeamInvitation) {
  const competitorName = invitation.competitorName ?? invitation.competitorNameEn ?? invitation.competitorEmail ?? 'Competitor'
  if (invitation.direction === 'ManagerToCompetitor') {
    return `${invitation.teamName} invited ${competitorName}`
  }
  return `${competitorName} requested ${invitation.teamName}`
}

function formatDate(value: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
