import { motion } from 'framer-motion'
import { AlertCircle, BadgeCheck, IdCard, Loader2, RefreshCcw, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { supabase } from '@/lib/supabase'

type ProfileSettingsPayload = {
  profile: ProfileSettingsData | null
  roles: string[]
}

type ProfileSettingsData = {
  id: string
  authUserId: string
  firstNameTh: string | null
  lastNameTh: string | null
  firstNameEn: string | null
  lastNameEn: string | null
  phone: string | null
  identityNo: string | null
  passportNo: string | null
  dateOfBirth: string | null
  bloodType: string | null
  nationality: string | null
  address: string | null
  postcode: string | null
  lineId: string | null
  facebook: string | null
  instagram: string | null
  youtube: string | null
  tiktok: string | null
  onboardingStatus: string
  createdAt: string
  updatedAt: string
}

type ProfileForm = {
  firstNameTh: string
  lastNameTh: string
  firstNameEn: string
  lastNameEn: string
  phone: string
  identityNo: string
  passportNo: string
  dateOfBirth: string
  bloodType: string
  nationality: string
  address: string
  postcode: string
  lineId: string
  facebook: string
  instagram: string
  youtube: string
  tiktok: string
}

const bloodTypes = ['', 'A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const emptyPayload: ProfileSettingsPayload = {
  profile: null,
  roles: [],
}

const emptyForm: ProfileForm = {
  firstNameTh: '',
  lastNameTh: '',
  firstNameEn: '',
  lastNameEn: '',
  phone: '',
  identityNo: '',
  passportNo: '',
  dateOfBirth: '',
  bloodType: '',
  nationality: '',
  address: '',
  postcode: '',
  lineId: '',
  facebook: '',
  instagram: '',
  youtube: '',
  tiktok: '',
}

export function ProfileSettingsPage() {
  const { user, refreshAuth } = useAuth()
  const [payload, setPayload] = useState<ProfileSettingsPayload>(emptyPayload)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.rpc('get_profile_settings')

    if (error) {
      setPayload(emptyPayload)
      setForm(emptyForm)
      setError(error.message)
    } else {
      const nextPayload = normalizePayload(data)
      setPayload(nextPayload)
      setForm(createForm(nextPayload.profile))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    async function loadInitialProfile() {
      const { data, error } = await supabase.rpc('get_profile_settings')

      if (!active) return

      if (error) {
        setPayload(emptyPayload)
        setForm(emptyForm)
        setError(error.message)
      } else {
        const nextPayload = normalizePayload(data)
        setPayload(nextPayload)
        setForm(createForm(nextPayload.profile))
      }

      setLoading(false)
    }

    loadInitialProfile()

    return () => {
      active = false
    }
  }, [])

  const completion = useMemo(() => calculateCompletion(form), [form])

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!form.identityNo.trim() && !form.passportNo.trim()) {
      setError('Identity number or passport number is required.')
      return
    }

    setSaving(true)

    const { data, error } = await supabase.rpc('save_profile_settings', {
      p_first_name_th: clean(form.firstNameTh),
      p_last_name_th: clean(form.lastNameTh),
      p_first_name_en: clean(form.firstNameEn),
      p_last_name_en: clean(form.lastNameEn),
      p_phone: clean(form.phone),
      p_identity_no: clean(form.identityNo),
      p_passport_no: clean(form.passportNo),
      p_date_of_birth: clean(form.dateOfBirth),
      p_blood_type: clean(form.bloodType),
      p_nationality: clean(form.nationality),
      p_address: clean(form.address),
      p_postcode: clean(form.postcode),
      p_line_id: clean(form.lineId),
      p_facebook: clean(form.facebook),
      p_instagram: clean(form.instagram),
      p_youtube: clean(form.youtube),
      p_tiktok: clean(form.tiktok),
    })

    if (error) {
      setError(error.message)
    } else {
      const nextPayload = normalizePayload(data)
      setPayload(nextPayload)
      setForm(createForm(nextPayload.profile))
      setNotice('Profile saved. Future Entry Forms will use the updated profile snapshot.')
      await refreshAuth()
    }

    setSaving(false)
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
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Account identity</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Profile Settings</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Keep your racing identity, contact details, and public social links accurate before creating race documents.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => loadProfile()}
          disabled={loading || saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800"
        >
          <RefreshCcw size={17} />
          Refresh
        </motion.button>
      </motion.header>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}

      {loading ? <ProfileSkeleton /> : null}

      {!loading && !payload.profile ? (
        <section className="mt-6 border border-amber-200 bg-amber-500/10 p-5 text-amber-800 dark:border-amber-900/60 dark:text-amber-500">
          <AlertCircle size={22} />
          <h2 className="mt-3 text-xl font-semibold">Profile not found.</h2>
          <p className="mt-2 text-sm">Complete onboarding first or sign in again.</p>
        </section>
      ) : null}

      {!loading && payload.profile ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,22rem)_1fr]">
          <aside className="space-y-5">
            <IdentityCard payload={payload} email={user?.email ?? null} completion={completion} />
            <GuidanceCard />
          </aside>

          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            onSubmit={saveProfile}
            className="border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <FormSection title="Legal Name" icon={IdCard}>
              <TextField label="ชื่อ (ภาษาไทย) / Name Thai" value={form.firstNameTh} onChange={(value) => updateField('firstNameTh', value)} />
              <TextField label="นามสกุล (ภาษาไทย) / Surname Thai" value={form.lastNameTh} onChange={(value) => updateField('lastNameTh', value)} />
              <TextField label="Name (English)" value={form.firstNameEn} onChange={(value) => updateField('firstNameEn', value)} />
              <TextField label="Surname (English)" value={form.lastNameEn} onChange={(value) => updateField('lastNameEn', value)} />
            </FormSection>

            <FormSection title="Identity & Contact" icon={ShieldCheck}>
              <TextField label="Mobile No." value={form.phone} onChange={(value) => updateField('phone', value)} inputMode="tel" />
              <TextField label="Nationality" value={form.nationality} onChange={(value) => updateField('nationality', value)} />
              <TextField label="I.D. Card No." value={form.identityNo} onChange={(value) => updateField('identityNo', value)} />
              <TextField label="Passport No." value={form.passportNo} onChange={(value) => updateField('passportNo', value)} />
              <TextField label="Date of Birth" value={form.dateOfBirth} onChange={(value) => updateField('dateOfBirth', value)} type="date" />
              <label className="block">
                <span className="text-sm font-medium">Blood Type</span>
                <select
                  value={form.bloodType}
                  onChange={(event) => updateField('bloodType', event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {bloodTypes.map((bloodType) => (
                    <option key={bloodType || 'empty'} value={bloodType}>{bloodType || 'Select blood type'}</option>
                  ))}
                </select>
              </label>
              <TextField label="Address" value={form.address} onChange={(value) => updateField('address', value)} className="sm:col-span-2" />
              <TextField label="Postcode" value={form.postcode} onChange={(value) => updateField('postcode', value)} inputMode="numeric" />
            </FormSection>

            <FormSection title="Social & Paddock Contact" icon={UserRound}>
              <TextField label="ID Line" value={form.lineId} onChange={(value) => updateField('lineId', value)} />
              <TextField label="Facebook" value={form.facebook} onChange={(value) => updateField('facebook', value)} />
              <TextField label="Instagram / IG" value={form.instagram} onChange={(value) => updateField('instagram', value)} />
              <TextField label="YouTube" value={form.youtube} onChange={(value) => updateField('youtube', value)} />
              <TextField label="TikTok" value={form.tiktok} onChange={(value) => updateField('tiktok', value)} />
            </FormSection>

            <footer className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <p className="text-sm text-zinc-500">
                At least one of I.D. Card No. or Passport No. is required.
              </p>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                Save Profile
              </motion.button>
            </footer>
          </motion.form>
        </div>
      ) : null}
    </section>
  )
}

function IdentityCard({ payload, email, completion }: { payload: ProfileSettingsPayload; email: string | null; completion: number }) {
  const profile = payload.profile
  const displayName = profile ? getDisplayName(profile) : 'Profile'

  return (
    <section className="border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-start gap-3">
        <BadgeCheck className="mt-1 text-primary" size={22} />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Racing profile</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{displayName}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{email || 'No email available'}</p>
        </div>
      </div>
      <div className="mt-5 border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Profile completeness</span>
          <span className="font-mono text-xl font-semibold tabular-nums">{completion}%</span>
        </div>
        <div className="mt-3 h-2 bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full bg-primary" style={{ width: `${completion}%` }} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {payload.roles.length === 0 ? <RoleBadge label="No active role" /> : payload.roles.map((role) => <RoleBadge key={role} label={role} />)}
      </div>
      {profile ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
          Updated {formatDateTime(profile.updatedAt)}
        </p>
      ) : null}
    </section>
  )
}

function GuidanceCard() {
  return (
    <section className="border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Operational note</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Entry Forms store snapshots. Updating this profile improves future documents; already submitted Entry Forms remain locked unless an official workflow changes them.
      </p>
    </section>
  )
}

function FormSection({ title, icon: Icon, children }: { title: string; icon: typeof IdCard; children: ReactNode }) {
  return (
    <section className="border-b border-zinc-200 py-5 first:pt-0 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <Icon size={19} className="text-primary" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  className = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'text' | 'tel' | 'numeric' | 'decimal' | 'email' | 'url' | 'search'
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      />
    </label>
  )
}

function RoleBadge({ label }: { label: string }) {
  return <span className="rounded-sm bg-zinc-200 px-2 py-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{label.replaceAll('_', ' ')}</span>
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className = tone === 'success'
    ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
    : 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-400'

  return <div className={`mt-5 border px-4 py-3 text-sm ${className}`}>{message}</div>
}

function ProfileSkeleton() {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="h-72 animate-pulse border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      <div className="space-y-3 border border-zinc-200 p-5 dark:border-zinc-800">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </div>
  )
}

function normalizePayload(data: unknown): ProfileSettingsPayload {
  if (!data || typeof data !== 'object') return emptyPayload
  const candidate = data as Partial<ProfileSettingsPayload>
  return {
    profile: candidate.profile ?? null,
    roles: Array.isArray(candidate.roles) ? candidate.roles : [],
  }
}

function createForm(profile: ProfileSettingsData | null): ProfileForm {
  if (!profile) return emptyForm
  return {
    firstNameTh: profile.firstNameTh ?? '',
    lastNameTh: profile.lastNameTh ?? '',
    firstNameEn: profile.firstNameEn ?? '',
    lastNameEn: profile.lastNameEn ?? '',
    phone: profile.phone ?? '',
    identityNo: profile.identityNo ?? '',
    passportNo: profile.passportNo ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    bloodType: profile.bloodType ?? '',
    nationality: profile.nationality ?? '',
    address: profile.address ?? '',
    postcode: profile.postcode ?? '',
    lineId: profile.lineId ?? '',
    facebook: profile.facebook ?? '',
    instagram: profile.instagram ?? '',
    youtube: profile.youtube ?? '',
    tiktok: profile.tiktok ?? '',
  }
}

function calculateCompletion(form: ProfileForm) {
  const keys: Array<keyof ProfileForm> = [
    'firstNameTh',
    'lastNameTh',
    'firstNameEn',
    'lastNameEn',
    'phone',
    'dateOfBirth',
    'bloodType',
    'nationality',
    'address',
    'postcode',
  ]
  const completed = keys.filter((key) => form[key].trim()).length + (form.identityNo.trim() || form.passportNo.trim() ? 1 : 0)
  return Math.round((completed / (keys.length + 1)) * 100)
}

function getDisplayName(profile: ProfileSettingsData) {
  return [profile.firstNameEn, profile.lastNameEn].filter(Boolean).join(' ')
    || [profile.firstNameTh, profile.lastNameTh].filter(Boolean).join(' ')
    || 'Unnamed profile'
}

function clean(value: string) {
  return value.trim() || null
}

function formatDateTime(value: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
