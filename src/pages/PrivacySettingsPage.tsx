import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/useAuth'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'
import { canSubmitPasswordChange, getPasswordStrength } from './privacySettingsHelpers'

export function PrivacySettingsPage() {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const strength = useMemo(() => getPasswordStrength(password), [password])
  const canSubmit = canSubmitPasswordChange(password, confirmPassword)

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSaving(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(getAuthErrorMessage(error.message))
      await recordSecurityEvent('password_update_failed', { reason: error.message })
      setSaving(false)
      return
    }

    await recordSecurityEvent('password_updated', { method: 'privacy_settings' })
    setPassword('')
    setConfirmPassword('')
    setNotice('Password updated. Use the new password the next time you sign in.')
    setSaving(false)
  }

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="border-b border-zinc-200 pb-6 dark:border-zinc-800"
      >
        <div className="border-l-2 border-primary pl-4">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">Account security</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Settings</h1>
          <p className="mt-3 max-w-3xl text-zinc-600 dark:text-zinc-400">
            Change your password from an active session. RaceDoc records security changes in Audit Trail without storing password values.
          </p>
        </div>
      </motion.header>

      {error ? <Alert tone="danger" message={error} /> : null}
      {notice ? <Alert tone="success" message={notice} /> : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,22rem)_1fr]">
        <aside className="space-y-5">
          <section className="border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 text-primary" size={22} />
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Signed-in account</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">{user?.email ?? 'Current user'}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Password changes apply to this Supabase Auth account only. Role permissions remain controlled by Admin in User & Role.
                </p>
              </div>
            </div>
          </section>

          <section className="border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Password standard</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <CheckLine active={strength.checks.length} label="12 or more characters recommended" />
              <CheckLine active={strength.checks.upperLower} label="Uppercase and lowercase letters" />
              <CheckLine active={strength.checks.number} label="At least one number" />
              <CheckLine active={strength.checks.symbol} label="At least one symbol" />
            </ul>
          </section>
        </aside>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          onSubmit={updatePassword}
          className="border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <div className="flex items-start gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <LockKeyhole className="mt-1 text-primary" size={22} />
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Credential control</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Update Password</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Use a password that is not shared with email, timing systems, team tools, or social accounts.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <PasswordField label="New Password" value={password} onChange={setPassword} />
            <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} />
          </div>

          <div className="mt-5 border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Strength estimate</p>
                <p className={`mt-1 text-lg font-semibold ${getStrengthTextClass(strength.tone)}`}>{strength.label}</p>
              </div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{strength.score}/4</p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className={`h-2 ${step <= strength.score ? getStrengthBarClass(strength.tone) : 'bg-zinc-200 dark:bg-zinc-800'}`} />
              ))}
            </div>
          </div>

          <footer className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <p className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              You may be asked to sign in again on other devices after changing password.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={saving || !canSubmit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
              Update Password
            </motion.button>
          </footer>
        </motion.form>
      </div>
    </section>
  )
}

async function recordSecurityEvent(action: 'password_updated' | 'password_update_failed', details: Record<string, string>) {
  await supabase.rpc('record_privacy_security_event', {
    p_action: action,
    p_details: details,
  })
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="new-password"
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      />
    </label>
  )
}

function CheckLine({ active, label }: { active: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 size={16} className={active ? 'mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400' : 'mt-0.5 shrink-0 text-zinc-400'} />
      <span>{label}</span>
    </li>
  )
}

function Alert({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  const className = tone === 'success'
    ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400'
    : 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/60 dark:text-red-400'

  return <div className={`mt-5 border px-4 py-3 text-sm ${className}`}>{message}</div>
}

function getStrengthTextClass(tone: 'danger' | 'warning' | 'success') {
  if (tone === 'success') return 'text-emerald-700 dark:text-emerald-400'
  if (tone === 'warning') return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400'
}

function getStrengthBarClass(tone: 'danger' | 'warning' | 'success') {
  if (tone === 'success') return 'bg-emerald-600'
  if (tone === 'warning') return 'bg-amber-600'
  return 'bg-red-600'
}
