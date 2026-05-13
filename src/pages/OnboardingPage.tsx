import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'
import type { PostgrestError } from '@supabase/supabase-js'

type SelectedRole = 'Competitor' | 'Team Manager'

type ProfileForm = {
  first_name_th: string
  last_name_th: string
  first_name_en: string
  last_name_en: string
  phone: string
  identity_no: string
  passport_no: string
  date_of_birth: string
  blood_type: string
  nationality: string
}

type OnboardingRpcPayload = {
  p_first_name_th: string | null
  p_last_name_th: string | null
  p_first_name_en: string | null
  p_last_name_en: string | null
  p_phone: string | null
  p_identity_no: string | null
  p_passport_no: string | null
  p_date_of_birth: string | null
  p_blood_type: string | null
  p_nationality: string | null
  p_requested_role: SelectedRole | null
}

type PendingRoleInvitation = {
  invitation_id: string
  email: string
  role_code: string
  role_name: string
  expires_at: string | null
}

const bloodTypes = ['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const roleCards: Array<{
  role: SelectedRole
  title: string
  body: string
}> = [
  {
    role: 'Competitor',
    title: 'Competitor',
    body: 'I own the racing license and will submit my own entry documents.',
  },
  {
    role: 'Team Manager',
    title: 'Team Manager',
    body: 'I manage competitors after they accept my team relationship request.',
  },
]

const initialForm: ProfileForm = {
  first_name_th: '',
  last_name_th: '',
  first_name_en: '',
  last_name_en: '',
  phone: '',
  identity_no: '',
  passport_no: '',
  date_of_birth: '',
  blood_type: '',
  nationality: '',
}

export function OnboardingPage() {
  const { user, profile, refreshAuth } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState<SelectedRole | null>(null)
  const [pendingInvitation, setPendingInvitation] = useState<PendingRoleInvitation | null>(null)
  const [invitationLoading, setInvitationLoading] = useState(true)
  const [form, setForm] = useState<ProfileForm>(() => ({
    ...initialForm,
    first_name_th: profile?.first_name_th ?? '',
    last_name_th: profile?.last_name_th ?? '',
    first_name_en: profile?.first_name_en ?? '',
    last_name_en: profile?.last_name_en ?? '',
    phone: profile?.phone ?? '',
    identity_no: profile?.identity_no ?? '',
    passport_no: profile?.passport_no ?? '',
    date_of_birth: profile?.date_of_birth ?? '',
    blood_type: profile?.blood_type ?? '',
    nationality: profile?.nationality ?? '',
  }))
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    async function loadPendingInvitation() {
      const { data } = await supabase.rpc('get_pending_role_invitation')

      if (!active) return

      setPendingInvitation(((data ?? []) as PendingRoleInvitation[])[0] ?? null)
      setInvitationLoading(false)
    }

    loadPendingInvitation()

    return () => {
      active = false
    }
  }, [])

  if (profile?.onboarding_status === 'Ready') {
    return <Navigate to="/dashboard" replace />
  }

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function validateIdentity() {
    return form.identity_no.trim().length > 0 || form.passport_no.trim().length > 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!user) {
      setErrorMessage('Your session expired. Please sign in again.')
      return
    }

    if (!selectedRole && !pendingInvitation) {
      setErrorMessage('Please select Competitor or Team Manager.')
      setStep(1)
      return
    }

    if (!validateIdentity()) {
      setErrorMessage('Identity number or passport number is required.')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase.rpc(
        'complete_user_onboarding',
        createOnboardingPayload(form, selectedRole, pendingInvitation),
      )

      if (error) throw error

      await refreshAuth()
      navigate(getPostOnboardingPath(selectedRole, pendingInvitation), {
        replace: true,
      })
    } catch (error) {
      const message = getOnboardingErrorMessage(error)
      setErrorMessage(getAuthErrorMessage(message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-svh bg-zinc-50 px-6 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="self-center border-l-2 border-primary pl-5"
        >
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Account setup
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Prepare your racing identity.
          </h1>
          <p className="mt-4 max-w-md leading-7 text-zinc-600 dark:text-zinc-400">
            First login requires a verified role and profile before accessing
            RaceDoc operational tabs.
          </p>
        </motion.aside>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.04 }}
          className="self-center border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                Step {step} / 2
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {step === 1 ? 'Select your role' : 'Complete profile'}
              </h2>
            </div>
            <div className="font-mono text-sm text-zinc-500">{step === 1 ? 'ROLE' : 'PROFILE'}</div>
          </div>

          {errorMessage ? (
            <div className="mb-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
              {errorMessage}
            </div>
          ) : null}

          {pendingInvitation ? (
            <div className="mb-5 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400">
              Official invitation detected: {pendingInvitation.role_name}. Complete your profile to activate this role.
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="role-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.16 }}
                className="space-y-3"
              >
                {pendingInvitation ? (
                  <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
                    <p className="font-semibold">Invited official role</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      Your email is pre-authorized for {pendingInvitation.role_name}. You do not need to select Competitor or Team Manager.
                    </p>
                  </div>
                ) : null}
                {!pendingInvitation && !invitationLoading ? roleCards.map((roleCard) => {
                  const active = selectedRole === roleCard.role

                  return (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      key={roleCard.role}
                      type="button"
                      onClick={() => setSelectedRole(roleCard.role)}
                      className={`w-full rounded-md border p-4 text-left transition ${
                        active
                          ? 'border-primary bg-zinc-100 dark:bg-zinc-900'
                          : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-4">
                        <span>
                          <span className="block text-lg font-semibold">{roleCard.title}</span>
                          <span className="mt-1 block text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            {roleCard.body}
                          </span>
                        </span>
                        {active ? <Check className="mt-1 text-primary" size={18} /> : null}
                      </span>
                    </motion.button>
                  )
                }) : null}
              </motion.div>
            ) : (
              <motion.div
                key="profile-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.16 }}
                className="grid gap-4 md:grid-cols-2"
              >
                <TextField label="First name (TH)" value={form.first_name_th} onChange={(value) => updateField('first_name_th', value)} />
                <TextField label="Last name (TH)" value={form.last_name_th} onChange={(value) => updateField('last_name_th', value)} />
                <TextField label="First name (EN)" value={form.first_name_en} onChange={(value) => updateField('first_name_en', value)} />
                <TextField label="Last name (EN)" value={form.last_name_en} onChange={(value) => updateField('last_name_en', value)} />
                <TextField label="Phone" value={form.phone} onChange={(value) => updateField('phone', value)} inputMode="tel" />
                <label className="block">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Date of birth</span>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) => updateField('date_of_birth', event.target.value)}
                    required
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
                  />
                </label>
                <TextField label="Identity No" value={form.identity_no} onChange={(value) => updateField('identity_no', value)} required={false} />
                <TextField label="Passport No" value={form.passport_no} onChange={(value) => updateField('passport_no', value)} required={false} />
                <label className="block">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Blood type</span>
                  <select
                    value={form.blood_type}
                    onChange={(event) => updateField('blood_type', event.target.value)}
                    required
                    className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
                  >
                    <option value="">Select blood type</option>
                    {bloodTypes.map((bloodType) => (
                      <option key={bloodType} value={bloodType}>{bloodType}</option>
                    ))}
                  </select>
                </label>
                <TextField label="Nationality" value={form.nationality} onChange={(value) => updateField('nationality', value)} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-between dark:border-zinc-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setStep(1)}
              disabled={step === 1 || submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <ArrowLeft size={16} /> Back
            </motion.button>

            {step === 1 ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => {
                  if (!selectedRole && !pendingInvitation) {
                    setErrorMessage('Please select Competitor or Team Manager.')
                    return
                  }
                  setErrorMessage('')
                  setStep(2)
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition"
              >
                Continue <ArrowRight size={16} />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving profile' : 'Complete onboarding'} <Check size={16} />
              </motion.button>
            )}
          </div>
        </motion.form>
      </section>
    </main>
  )
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function createOnboardingPayload(
  form: ProfileForm,
  selectedRole: SelectedRole | null,
  pendingInvitation: PendingRoleInvitation | null,
): OnboardingRpcPayload {
  return {
    p_first_name_th: nullableText(form.first_name_th),
    p_last_name_th: nullableText(form.last_name_th),
    p_first_name_en: nullableText(form.first_name_en),
    p_last_name_en: nullableText(form.last_name_en),
    p_phone: nullableText(form.phone),
    p_identity_no: nullableText(form.identity_no),
    p_passport_no: nullableText(form.passport_no),
    p_date_of_birth: nullableText(form.date_of_birth),
    p_blood_type: nullableText(form.blood_type),
    p_nationality: nullableText(form.nationality),
    p_requested_role: pendingInvitation ? null : selectedRole,
  }
}

function getPostOnboardingPath(
  selectedRole: SelectedRole | null,
  pendingInvitation: PendingRoleInvitation | null,
) {
  if (selectedRole === 'Team Manager') return '/onboarding/team'
  if (pendingInvitation) return '/dashboard'
  return '/entry-forms'
}

function getOnboardingErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return (error as PostgrestError).message
  }

  return 'Unable to complete onboarding.'
}

function TextField({
  label,
  value,
  onChange,
  required = true,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  inputMode?: 'text' | 'tel'
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
      />
    </label>
  )
}
