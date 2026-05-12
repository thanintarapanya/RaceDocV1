import { motion } from 'framer-motion'
import { useAuth } from '@/auth/useAuth'

export function DashboardPlaceholder() {
  const { signOut } = useAuth()

  return (
    <main className="min-h-svh bg-zinc-50 px-6 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center"
      >
        <div className="max-w-xl border-l-2 border-primary pl-5">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Dashboard route
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Authentication is ready.
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            The protected route is working. The real dashboard will be built in
            the dashboard phase.
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={signOut}
            className="mt-8 min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Sign out
          </motion.button>
        </div>
      </motion.section>
    </main>
  )
}
