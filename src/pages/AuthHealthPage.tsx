import { motion } from 'framer-motion'
import { RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { supabase } from '@/lib/supabase'

type BootstrapDiagnostic = Record<string, unknown>

export function AuthHealthPage() {
  const {
    user,
    session,
    profile,
    roles,
    status,
    authError,
    refreshAuth,
    clearLocalSession,
  } = useAuth()
  const [diagnostic, setDiagnostic] = useState<BootstrapDiagnostic | null>(null)
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function runDiagnostic() {
    setPending(true)
    setDiagnosticError(null)

    const { data, error } = await supabase.rpc('get_auth_bootstrap')

    if (error) {
      setDiagnostic(null)
      setDiagnosticError(error.message)
    } else {
      setDiagnostic(((data ?? []) as BootstrapDiagnostic[])[0] ?? null)
    }

    setPending(false)
  }

  return (
    <section className="min-h-svh bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between dark:border-zinc-800">
          <div className="border-l-2 border-primary pl-4">
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">System diagnostics</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Auth Health</h1>
            <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
              Inspect the current browser session, RaceDoc profile, role mapping, and bootstrap RPC response.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={refreshAuth}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-800"
            >
              <RefreshCcw size={17} />
              Refresh Auth
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={clearLocalSession}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 px-4 text-sm font-semibold text-red-700 dark:border-red-900/70 dark:text-red-400"
            >
              <Trash2 size={17} />
              Clear Local Session
            </motion.button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <HealthCard title="Frontend State">
            <KeyValue label="Status" value={status} mono />
            <KeyValue label="Auth Error" value={authError ?? 'None'} />
            <KeyValue label="Roles" value={roles.join(', ') || 'None'} />
          </HealthCard>

          <HealthCard title="Supabase Session">
            <KeyValue label="User ID" value={user?.id ?? 'No active user'} mono />
            <KeyValue label="Email" value={user?.email ?? 'None'} />
            <KeyValue label="Expires At" value={session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'None'} mono />
          </HealthCard>

          <HealthCard title="RaceDoc Profile">
            <KeyValue label="Profile ID" value={profile?.id ?? 'None'} mono />
            <KeyValue label="Onboarding" value={profile?.onboarding_status ?? 'None'} mono />
            <KeyValue label="Name" value={getProfileName(profile)} />
          </HealthCard>
        </div>

        <div className="mt-6 border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Bootstrap RPC</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Runs `get_auth_bootstrap()` using the current browser session.
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={runDiagnostic}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck size={17} />
              {pending ? 'Checking' : 'Run Diagnostic'}
            </motion.button>
          </div>

          {diagnosticError ? (
            <div className="mt-4 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
              {diagnosticError}
            </div>
          ) : null}

          <pre className="mt-4 max-h-[26rem] overflow-auto border border-zinc-200 bg-zinc-100 p-4 font-mono text-xs leading-6 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {JSON.stringify(diagnostic ?? { message: 'Run diagnostic to inspect bootstrap output.' }, null, 2)}
          </pre>
        </div>
      </div>
    </section>
  )
}

function HealthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="mt-4 space-y-3">{children}</dl>
    </article>
  )
}

function KeyValue({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-zinc-900 dark:text-zinc-100 ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

function getProfileName(profile: ReturnType<typeof useAuth>['profile']) {
  const englishName = [profile?.first_name_en, profile?.last_name_en].filter(Boolean).join(' ')
  const thaiName = [profile?.first_name_th, profile?.last_name_th].filter(Boolean).join(' ')
  return englishName || thaiName || 'None'
}
