import { motion } from 'framer-motion'
import { Loader2, MailPlus, RefreshCcw, Search, ShieldCheck, UserRoundCog, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { supabase } from '@/lib/supabase'

type RoleOption = {
  roleId: string
  code: string
  name: string
  description: string | null
}

type SeasonOption = {
  seasonId: string
  name: string
  year: number
  isActive: boolean
}

type UserRole = {
  userRoleId: string
  roleId: string
  code: string
  name: string
  seasonId: string | null
  seasonLabel: string
  isActive: boolean
  createdAt: string
}

type ManagedUser = {
  profileId: string
  authUserId: string
  displayName: string
  email: string
  onboardingStatus: string
  roles: UserRole[]
}

type RoleInvitation = {
  invitationId: string
  email: string
  roleCode: string
  roleName: string
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Expired' | 'Revoked' | 'Cancelled'
  expiresAt: string | null
  createdAt: string
  invitedProfileId: string | null
  invitedByName: string
}

type RoleManagementPayload = {
  canManage: boolean
  users: ManagedUser[]
  roles: RoleOption[]
  seasons: SeasonOption[]
  invitations: RoleInvitation[]
}

const emptyPayload: RoleManagementPayload = {
  canManage: false,
  users: [],
  roles: [],
  seasons: [],
  invitations: [],
}

export function UserRolePage() {
  const { refreshRoles } = useAuth()
  const [payload, setPayload] = useState<RoleManagementPayload>(emptyPayload)
  const [loading, setLoading] = useState(true)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedRoleCode, setSelectedRoleCode] = useState('')
  const [selectedSeasonId, setSelectedSeasonId] = useState('global')
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleCode, setInviteRoleCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadData = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_user_role_management')

    if (!isActive()) return

    if (error) {
      setPayload(emptyPayload)
      setError(error.message)
    } else {
      const nextPayload = normalizePayload(data as RoleManagementPayload | null)
      const firstElevatedRoleCode = getFirstElevatedRoleCode(nextPayload.roles)
      setPayload(nextPayload)
      setSelectedProfileId((current) => current || nextPayload.users[0]?.profileId || '')
      setSelectedRoleCode((current) => keepElevatedRoleCode(current, nextPayload.roles) || firstElevatedRoleCode)
      setInviteRoleCode((current) => keepElevatedRoleCode(current, nextPayload.roles) || firstElevatedRoleCode)
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

  const elevatedRoles = useMemo(
    () => payload.roles.filter((role) => !['COMPETITOR', 'TEAM_MANAGER'].includes(role.code)),
    [payload.roles],
  )

  const filteredAssignableUsers = useMemo(
    () => filterAssignableUsers(payload.users, userSearch, userRoleFilter),
    [payload.users, userRoleFilter, userSearch],
  )

  const effectiveSelectedProfileId = filteredAssignableUsers.some((user) => user.profileId === selectedProfileId)
    ? selectedProfileId
    : filteredAssignableUsers[0]?.profileId ?? ''

  const selectedUser = useMemo(
    () => payload.users.find((user) => user.profileId === effectiveSelectedProfileId) ?? null,
    [effectiveSelectedProfileId, payload.users],
  )

  async function assignRole() {
    if (!effectiveSelectedProfileId || !selectedRoleCode) return

    setUpdatingKey('assign')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('assign_user_role', {
      p_profile_id: effectiveSelectedProfileId,
      p_role_code: selectedRoleCode,
      p_season_id: selectedSeasonId === 'global' ? null : selectedSeasonId,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('Role assigned.')
      await loadData()
      await refreshRoles()
    }

    setUpdatingKey(null)
  }

  async function inviteRoleByEmail() {
    if (!inviteEmail.trim() || !inviteRoleCode) return

    setUpdatingKey('invite')
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('invite_user_role_by_email', {
      p_email: inviteEmail.trim(),
      p_role_code: inviteRoleCode,
      p_expires_days: 14,
    })

    if (error) {
      setError(error.message)
    } else {
      setInviteEmail('')
      setNotice('Role invitation recorded. If the user has already signed up, the role is active now.')
      await loadData()
    }

    setUpdatingKey(null)
  }

  async function cancelInvitation(invitation: RoleInvitation) {
    const confirmed = window.confirm(`Cancel ${invitation.roleName} invitation for ${invitation.email}?`)
    if (!confirmed) return

    setUpdatingKey(invitation.invitationId)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('cancel_role_invitation', {
      p_invitation_id: invitation.invitationId,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('Invitation cancelled.')
      await loadData()
    }

    setUpdatingKey(null)
  }

  async function deactivateRole(role: UserRole) {
    const confirmed = window.confirm(`Deactivate ${role.name} for ${selectedUser?.displayName ?? 'this user'}?`)
    if (!confirmed) return

    setUpdatingKey(role.userRoleId)
    setError(null)
    setNotice(null)

    const { error } = await supabase.rpc('deactivate_user_role', {
      p_user_role_id: role.userRoleId,
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('Role deactivated.')
      await loadData()
      await refreshRoles()
    }

    setUpdatingKey(null)
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Access control</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">User & Role</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Assign operational roles to registered users. Every role change is audited server-side.
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

      {loading ? <RoleSkeleton /> : null}

      {!loading && !payload.canManage ? (
        <div className="mt-6 border border-red-200 bg-red-500/10 p-5 text-red-700 dark:border-red-900/60 dark:text-red-400">
          Admin role is required to manage users.
        </div>
      ) : null}

      {!loading && payload.canManage ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,24rem)_1fr]">
          <div className="grid gap-5">
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="flex items-start gap-3">
                <MailPlus className="mt-1 text-primary" size={20} />
                <div>
                  <h2 className="text-xl font-semibold">Invite Official</h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Pre-authorize an official role by email before the user signs up.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">Email</span>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="official@example.com"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Role</span>
                  <select
                    value={inviteRoleCode}
                    onChange={(event) => setInviteRoleCode(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {elevatedRoles.map((role) => (
                      <option key={role.code} value={role.code}>{role.name}</option>
                    ))}
                  </select>
                </label>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={inviteRoleByEmail}
                  disabled={updatingKey === 'invite' || !inviteEmail.trim() || !inviteRoleCode}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {updatingKey === 'invite' ? <Loader2 size={17} className="animate-spin" /> : <MailPlus size={17} />}
                  Record Invitation
                </motion.button>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="flex items-start gap-3">
                <UserRoundCog className="mt-1 text-primary" size={20} />
                <div>
                  <h2 className="text-xl font-semibold">Assign Existing User</h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Use global roles for officials who work across the season.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_0.85fr]">
                  <label className="block">
                    <span className="text-sm font-medium">Search name or email</span>
                    <span className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 transition focus-within:border-primary dark:border-zinc-800 dark:bg-zinc-950">
                      <Search size={16} className="text-zinc-500" />
                      <input
                        type="search"
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        className="min-h-10 w-full bg-transparent text-base outline-none"
                        placeholder="Driver, official, email"
                      />
                    </span>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Filter by active role</span>
                    <select
                      value={userRoleFilter}
                      onChange={(event) => setUserRoleFilter(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="all">All roles</option>
                      <option value="none">No active role</option>
                      {payload.roles.map((role) => (
                        <option key={role.code} value={role.code}>{role.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-medium">User</span>
                  <select
                    value={effectiveSelectedProfileId}
                    onChange={(event) => setSelectedProfileId(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {filteredAssignableUsers.length === 0 ? <option value="">No matching users</option> : null}
                    {filteredAssignableUsers.map((user) => (
                      <option key={user.profileId} value={user.profileId}>{user.displayName} / {user.email || 'no email'}</option>
                    ))}
                  </select>
                  <span className="mt-2 block font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
                    {filteredAssignableUsers.length} / {payload.users.length} user(s)
                  </span>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Role</span>
                  <select
                    value={selectedRoleCode}
                    onChange={(event) => setSelectedRoleCode(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {elevatedRoles.map((role) => (
                      <option key={role.code} value={role.code}>{role.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Scope</span>
                  <select
                    value={selectedSeasonId}
                    onChange={(event) => setSelectedSeasonId(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="global">Global</option>
                    {payload.seasons.map((season) => (
                      <option key={season.seasonId} value={season.seasonId}>{season.name} / {season.year}{season.isActive ? ' / active' : ''}</option>
                    ))}
                  </select>
                </label>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={assignRole}
                  disabled={updatingKey === 'assign' || !effectiveSelectedProfileId || !selectedRoleCode}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {updatingKey === 'assign' ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                  Assign Role
                </motion.button>
              </div>
            </motion.section>
          </div>

          <section className="border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Registered users</p>
              <h2 className="mt-2 text-xl font-semibold">Role Matrix</h2>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <InvitationList invitations={payload.invitations} updatingKey={updatingKey} onCancel={cancelInvitation} />
              {payload.users.map((user) => (
                <UserRoleRow
                  key={user.profileId}
                  user={user}
                  updatingKey={updatingKey}
                  onDeactivate={deactivateRole}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function InvitationList({
  invitations,
  updatingKey,
  onCancel,
}: {
  invitations: RoleInvitation[]
  updatingKey: string | null
  onCancel: (invitation: RoleInvitation) => Promise<void>
}) {
  if (invitations.length === 0) return null

  return (
    <div className="bg-zinc-100/70 p-4 dark:bg-zinc-900/50">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Role invitations</p>
      <div className="mt-3 grid gap-2">
        {invitations.map((invitation) => (
          <div key={invitation.invitationId} className="flex flex-col gap-2 border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <p className="font-medium">{invitation.email}</p>
              <p className="mt-1 text-sm text-zinc-500">{invitation.roleName} / {invitation.status}</p>
            </div>
            {invitation.status === 'Pending' ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onCancel(invitation)}
                disabled={updatingKey === invitation.invitationId}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
              >
                {updatingKey === invitation.invitationId ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Cancel
              </motion.button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function UserRoleRow({
  user,
  updatingKey,
  onDeactivate,
}: {
  user: ManagedUser
  updatingKey: string | null
  onDeactivate: (role: UserRole) => Promise<void>
}) {
  return (
    <article className="p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-semibold">{user.displayName}</h3>
          <p className="mt-1 text-sm text-zinc-500">{user.email || 'No email'} / {user.onboardingStatus}</p>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">{user.roles.filter((role) => role.isActive).length} active role(s)</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {user.roles.length === 0 ? <span className="text-sm text-zinc-500">No roles assigned.</span> : null}
        {user.roles.map((role) => (
          <span
            key={role.userRoleId}
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-semibold ${role.isActive ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400' : 'border-zinc-200 text-zinc-500 dark:border-zinc-800'}`}
          >
            {role.name} / {role.seasonLabel}
            {role.isActive ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onDeactivate(role)}
                disabled={updatingKey === role.userRoleId}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-current disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Deactivate ${role.name}`}
              >
                {updatingKey === role.userRoleId ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              </motion.button>
            ) : null}
          </span>
        ))}
      </div>
    </article>
  )
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className =
    tone === 'success'
      ? 'mt-5 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
      : 'mt-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400'
  return <div className={className}>{message}</div>
}

function RoleSkeleton() {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,24rem)_1fr]">
      <div className="h-80 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      <div className="h-80 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
    </div>
  )
}

function normalizePayload(payload: RoleManagementPayload | null): RoleManagementPayload {
  return {
    canManage: Boolean(payload?.canManage),
    users: payload?.users ?? [],
    roles: payload?.roles ?? [],
    seasons: payload?.seasons ?? [],
    invitations: payload?.invitations ?? [],
  }
}

function getFirstElevatedRoleCode(roles: RoleOption[]) {
  return roles.find((role) => !['COMPETITOR', 'TEAM_MANAGER'].includes(role.code))?.code ?? ''
}

function keepElevatedRoleCode(current: string, roles: RoleOption[]) {
  return roles.some((role) => role.code === current && !['COMPETITOR', 'TEAM_MANAGER'].includes(role.code))
    ? current
    : ''
}

function filterAssignableUsers(users: ManagedUser[], search: string, roleFilter: string) {
  const normalizedSearch = search.trim().toLowerCase()

  return users.filter((user) => {
    const matchesSearch = normalizedSearch.length === 0
      || user.displayName.toLowerCase().includes(normalizedSearch)
      || user.email.toLowerCase().includes(normalizedSearch)

    return matchesSearch && userMatchesRoleFilter(user, roleFilter)
  })
}

function userMatchesRoleFilter(user: ManagedUser, roleFilter: string) {
  if (roleFilter === 'all') return true
  const activeRoles = user.roles.filter((role) => role.isActive)
  if (roleFilter === 'none') return activeRoles.length === 0
  return activeRoles.some((role) => role.code === roleFilter)
}
