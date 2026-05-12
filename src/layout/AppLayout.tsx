import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { getNavigationItems, getPrimaryRoleLabel } from '@/navigation'

export function AppLayout() {
  const { profile, roles, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navItems = getNavigationItems(roles)
  const displayName = getDisplayName(profile)
  const roleLabel = getPrimaryRoleLabel(roles)

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-zinc-200 bg-zinc-50 px-4 py-5 lg:flex lg:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        <ShellBrand roleLabel={roleLabel} />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavigationLink key={item.path} item={item} />
          ))}
        </nav>
        <UserPanel displayName={displayName} roleLabel={roleLabel} onSignOut={signOut} />
      </aside>

      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">RacedocV1</p>
            <p className="mt-1 text-sm font-medium">{currentTitle(location.pathname, navItems)}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-40 bg-zinc-950/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.18 }}
              className="h-full w-[86vw] max-w-80 border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <ShellBrand roleLabel={roleLabel} compact />
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-800"
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </motion.button>
              </div>
              <nav className="mt-7 flex flex-col gap-1">
                {navItems.map((item) => (
                  <NavigationLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />
                ))}
              </nav>
              <div className="mt-8">
                <UserPanel displayName={displayName} roleLabel={roleLabel} onSignOut={signOut} />
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="pb-24 lg:ml-72 lg:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-200 bg-zinc-50 lg:hidden dark:border-zinc-800 dark:bg-zinc-950">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? 'text-primary' : 'text-zinc-500 dark:text-zinc-400'
                }`
              }
            >
              <Icon size={19} />
              <span className="max-w-16 truncate">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

function ShellBrand({ roleLabel, compact = false }: { roleLabel: string; compact?: boolean }) {
  return (
    <div className="border-l-2 border-primary pl-4">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">RacedocV1</p>
      <h1 className={`${compact ? 'mt-1 text-xl' : 'mt-2 text-2xl'} font-semibold tracking-tight`}>
        Race Control
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{roleLabel}</p>
    </div>
  )
}

function NavigationLink({
  item,
  onClick,
}: {
  item: ReturnType<typeof getNavigationItems>[number]
  onClick?: () => void
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm font-medium transition ${
          isActive
            ? 'border-primary text-zinc-950 dark:text-zinc-50'
            : 'border-transparent text-zinc-600 hover:border-zinc-200 hover:text-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:text-zinc-50'
        }`
      }
    >
      <Icon size={18} className="shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}

function UserPanel({
  displayName,
  roleLabel,
  onSignOut,
}: {
  displayName: string
  roleLabel: string
  onSignOut: () => Promise<void>
}) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="truncate text-sm font-medium">{displayName}</p>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">{roleLabel}</p>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onSignOut}
        className="mt-4 flex min-h-10 w-full items-center justify-between rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-800"
      >
        <span>Sign out</span>
        <LogOut size={16} />
      </motion.button>
    </div>
  )
}

function getDisplayName(profile: ReturnType<typeof useAuth>['profile']) {
  const englishName = [profile?.first_name_en, profile?.last_name_en].filter(Boolean).join(' ')
  const thaiName = [profile?.first_name_th, profile?.last_name_th].filter(Boolean).join(' ')
  return englishName || thaiName || 'RaceDoc user'
}

function currentTitle(pathname: string, items: ReturnType<typeof getNavigationItems>) {
  return items.find((item) => item.path === pathname)?.label ?? 'Race Control'
}
