import { motion } from 'framer-motion'
import { ArrowRight, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [pending, setPending] = useState(false)

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setPending(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message))
      setPending(false)
      return
    }

    setSuccessMessage('If an account exists, a password reset link has been sent to your email.')
    setPending(false)
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
              Password recovery
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Reset access without interrupting race operations.
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Enter your account email. Supabase will send a secure reset link if the account exists.
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
              Recovery email
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Forgot password</h2>
          </div>

          {errorMessage ? (
            <div className="mb-5 border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:text-red-400">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-5 border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400">
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleResetRequest} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800"
              />
            </label>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={pending}
              className="flex min-h-11 w-full items-center justify-between rounded-md bg-primary px-4 text-left text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{pending ? 'Sending reset link' : 'Send reset link'}</span>
              {pending ? <MailCheck size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
            </motion.button>
          </form>

          <div className="mt-5 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
            <Link to="/login" className="font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
              Back to login
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  )
}
