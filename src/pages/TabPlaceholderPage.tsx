import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export function TabPlaceholderPage({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="min-h-[calc(100svh-8rem)] border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <div className="max-w-2xl border-l-2 border-primary pl-5">
          <Icon size={22} className="text-primary" />
          <p className="mt-4 font-mono text-sm uppercase tracking-[0.18em] text-zinc-500">
            Route ready
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
      </motion.section>
    </div>
  )
}
