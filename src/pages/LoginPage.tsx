import { motion } from 'framer-motion'
import { ArrowRight, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const { user, profile, roles, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [pending, setPending] = useState(false)

  if (!loading && user) {
    if (roles.includes('ADMIN') || roles.includes('SECRETARY')) {
      return <Navigate to="/dashboard" replace />
    }

    if (!profile || profile.onboarding_status === 'ProfileRequired') {
      return <Navigate to="/onboarding" replace />
    }

    if (profile.onboarding_status === 'TeamRequired') {
      return <Navigate to="/onboarding/team" replace />
    }

    const redirectTo = location.state?.from?.pathname ?? '/dashboard'
    return <Navigate to={redirectTo} replace />
  }

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setPending(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message))
    }

    setPending(false)
  }

  async function handleGoogleLogin() {
    setErrorMessage('')
    setPending(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message))
      setPending(false)
    }
  }

  return (
    <main className="min-h-svh bg-zinc-50 px-6 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="max-w-xl"
        >
          <div className="border-l-2 border-primary pl-5">
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              RacedocV1
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Race operations, authenticated.
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Sign in to manage entry forms, scrutineering, weigh-in and race
              documents with server-side RBAC protection.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.04 }}
          className="w-full max-w-md border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
              Secure login
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Access your account</h2>
          </div>

          {errorMessage ? (
            <div className="mb-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
              {errorMessage}
            </div>
          ) : null}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Password
                </span>
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                >
                  Forgot password?
                </Link>
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
              />
            </label>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={pending}
              className="flex min-h-11 w-full items-center justify-between rounded-md bg-primary px-4 text-left text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{pending ? 'Signing in' : 'Sign in'}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </motion.button>
          </form>

          <div className="my-5 h-px bg-zinc-200 dark:bg-zinc-800" />

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={pending}
            onClick={handleGoogleLogin}
            className="flex min-h-11 w-full items-center justify-between rounded-md border border-zinc-300 px-4 text-left text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <span>Continue with Google</span>
            <KeyRound size={18} aria-hidden="true" />
          </motion.button>

          <div className="mt-5 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">Need a RaceDoc account? </span>
            <Link to="/signup" className="font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
              Create an account
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  )
}
