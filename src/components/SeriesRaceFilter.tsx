import { motion } from 'framer-motion'

export function SeriesRaceFilter({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Series Race</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-base outline-none transition focus:border-primary dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="all">All Series Races</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterResultSummary({
  visible,
  total,
  onClear,
}: {
  visible: number
  total: number
  onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
        Showing {visible} / {total}
      </p>
      {visible !== total ? (
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onClear}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-800"
        >
          Clear filter
        </motion.button>
      ) : null}
    </div>
  )
}
