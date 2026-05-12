import { motion } from 'framer-motion'

export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="min-h-svh bg-zinc-50 px-6 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="w-full max-w-md border-l-2 border-primary pl-4"
        >
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            RacedocV1
          </p>
          <p className="mt-2 text-lg font-medium">{label}</p>
          <div className="mt-5 space-y-2" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-px overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                <motion.div
                  className="h-px bg-primary"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{
                    duration: 0.85,
                    repeat: Infinity,
                    repeatType: 'loop',
                    ease: 'linear',
                    delay: index * 0.12,
                  }}
                />
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
            Verifying access and role scope
          </p>
        </motion.div>
      </div>
    </main>
  )
}
