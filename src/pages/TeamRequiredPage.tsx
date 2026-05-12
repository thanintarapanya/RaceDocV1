import { motion } from 'framer-motion'
import { Building2, Check, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

type TeamForm = {
  teamName: string
  managerName: string
  managerPhone: string
  address: string
  postcode: string
}

const initialForm: TeamForm = {
  teamName: '',
  managerName: '',
  managerPhone: '',
  address: '',
  postcode: '',
}

export function TeamRequiredPage() {
  const { profile, refreshAuth, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<TeamForm>(() => ({
    ...initialForm,
    managerName: [profile?.first_name_en, profile?.last_name_en].filter(Boolean).join(' '),
    managerPhone: profile?.phone ?? '',
    postcode: profile?.postcode ?? '',
  }))
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateField(field: keyof TeamForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!form.teamName.trim()) {
      setErrorMessage('Team name is required.')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase.rpc('complete_team_manager_onboarding', {
        p_team_name: nullableText(form.teamName),
        p_manager_name: nullableText(form.managerName),
        p_manager_phone: nullableText(form.managerPhone),
        p_address: nullableText(form.address),
        p_postcode: nullableText(form.postcode),
      })

      if (error) throw error

      await refreshAuth()
      navigate('/entry-forms', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save Team Info.'
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
            Team Manager setup
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Create your team profile.
          </h1>
          <p className="mt-4 max-w-md leading-7 text-zinc-600 dark:text-zinc-400">
            Team Manager accounts must create Team Info before managing competitors or submitting Entry Forms on their behalf.
          </p>
          <div className="mt-8 grid max-w-md gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 text-primary" size={18} />
              <span>This team profile will prefill the Team section in future Entry Forms.</span>
            </div>
          </div>
        </motion.aside>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.04 }}
          className="self-center border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="mb-6 border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Required before access</p>
            <h2 className="mt-2 text-2xl font-semibold">Team Info</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Use official team details. You can update this later from Team settings when that module is available.
            </p>
          </div>

          {errorMessage ? (
            <div className="mb-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="ชื่อทีมแข่ง / Team Name" value={form.teamName} onChange={(value) => updateField('teamName', value)} />
            <TextField label="ชื่อผู้จัดการทีม / Manager Name" value={form.managerName} onChange={(value) => updateField('managerName', value)} />
            <TextField label="เบอร์ผู้จัดการทีม / Manager Mobile No." value={form.managerPhone} onChange={(value) => updateField('managerPhone', value)} inputMode="tel" />
            <TextField label="รหัสไปรษณีย์ / Postcode" value={form.postcode} onChange={(value) => updateField('postcode', value)} inputMode="numeric" required={false} />
            <TextAreaField label="ที่อยู่สำหรับจัดส่งเอกสาร / Document Address" value={form.address} onChange={(value) => updateField('address', value)} />
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-between dark:border-zinc-800">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={signOut}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <LogOut size={16} /> Sign out
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving Team Info' : 'Complete Team setup'} <Check size={16} />
            </motion.button>
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
  inputMode?: 'text' | 'tel' | 'numeric'
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

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block md:col-span-2">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
      />
    </label>
  )
}
