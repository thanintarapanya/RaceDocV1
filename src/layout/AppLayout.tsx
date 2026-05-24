import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Gauge, LogOut, Menu, Settings, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { supabase } from '@/lib/supabase'
import { getNavigationItems, getPrimaryRoleLabel } from '@/navigation'
import { getNotificationTargetPath } from './appLayoutHelpers'

type NotificationItem = {
  id: string
  title: string
  body: string
  linkEntityType: string | null
  linkEntityId: string | null
  isRead: boolean
  createdAt: string
}

type NotificationState = {
  unreadCount: number
  notifications: NotificationItem[]
}

export function AppLayout() {
  const { profile, roles, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationState>({ unreadCount: 0, notifications: [] })
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const navItems = getNavigationItems(roles)
  const displayName = getDisplayName(profile)
  const roleLabel = getPrimaryRoleLabel(roles)

  useEffect(() => {
    let active = true

    async function loadNotifications() {
      if (!profile?.id) return
      setNotificationLoading(true)
      setNotificationError(null)
      const { data, error } = await supabase.rpc('get_my_notifications', { p_limit: 10 })

      if (!active) return

      setNotificationLoading(false)

      if (error) {
        setNotificationError(error.message)
        return
      }

      setNotifications(normalizeNotificationState(data))
    }

    loadNotifications()

    return () => {
      active = false
    }
  }, [profile?.id])

  async function refreshNotifications() {
    if (!profile?.id) return
    const { data, error } = await supabase.rpc('get_my_notifications', { p_limit: 10 })

    if (error) {
      setNotificationError(error.message)
      return
    }

    setNotificationError(null)
    setNotifications(normalizeNotificationState(data))
  }

  async function handleNotificationClick(notification: NotificationItem) {
    if (!notification.isRead) {
      setNotifications((current) => ({
        unreadCount: Math.max(0, current.unreadCount - 1),
        notifications: current.notifications.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      }))

      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notification.id,
      })

      if (error) {
        setNotificationError(error.message)
        await refreshNotifications()
        return
      }
    }

    setNotificationOpen(false)
    setMobileOpen(false)

    const targetPath = getNotificationTargetPath(notification)
    if (targetPath) navigate(targetPath)
  }

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-zinc-200 bg-zinc-50 px-4 py-5 lg:flex lg:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        <ShellBrand roleLabel={roleLabel} />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavigationLink key={item.path} item={item} />
          ))}
        </nav>
        <UserPanel
          displayName={displayName}
          roleLabel={roleLabel}
          notificationOpen={notificationOpen}
          notifications={notifications}
          notificationLoading={notificationLoading}
          notificationError={notificationError}
          onNotificationToggle={() => setNotificationOpen((open) => !open)}
          onNotificationClick={handleNotificationClick}
          onSignOut={signOut}
        />
      </aside>

      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">RacedocV1</p>
            <p className="mt-1 text-sm font-medium">{currentTitle(location.pathname, navItems)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <NotificationButton
                unreadCount={notifications.unreadCount}
                onClick={() => setNotificationOpen((open) => !open)}
              />
              <AnimatePresence>
                {notificationOpen ? (
                  <NotificationPanel
                    notifications={notifications.notifications}
                    loading={notificationLoading}
                    error={notificationError}
                    onNotificationClick={handleNotificationClick}
                    align="right"
                  />
                ) : null}
              </AnimatePresence>
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
                <UserPanel
                  displayName={displayName}
                  roleLabel={roleLabel}
                  notificationOpen={false}
                  notifications={notifications}
                  notificationLoading={notificationLoading}
                  notificationError={notificationError}
                  onNotificationToggle={() => setNotificationOpen((open) => !open)}
                  onNotificationClick={handleNotificationClick}
                  onSignOut={signOut}
                  hideNotifications
                />
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
  notificationOpen,
  notifications,
  notificationLoading,
  notificationError,
  onNotificationToggle,
  onNotificationClick,
  onSignOut,
  hideNotifications = false,
}: {
  displayName: string
  roleLabel: string
  notificationOpen: boolean
  notifications: NotificationState
  notificationLoading: boolean
  notificationError: string | null
  onNotificationToggle: () => void
  onNotificationClick: (notification: NotificationItem) => void
  onSignOut: () => Promise<void>
  hideNotifications?: boolean
}) {
  return (
    <div className="relative border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="truncate text-sm font-medium">{displayName}</p>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">{roleLabel}</p>
      <div className="mt-4 grid gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <AccountLink to="/settings/profile" label="Profile" icon={<Settings size={16} />} />
        <AccountLink to="/settings/privacy" label="Privacy" icon={<Gauge size={16} />} />
      </div>
      {!hideNotifications ? (
        <>
          <div className="mt-4">
            <NotificationButton unreadCount={notifications.unreadCount} onClick={onNotificationToggle} fullWidth />
          </div>
          <AnimatePresence>
            {notificationOpen ? (
              <NotificationPanel
                notifications={notifications.notifications}
                loading={notificationLoading}
                error={notificationError}
                onNotificationClick={onNotificationClick}
              />
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
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

function AccountLink({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-10 items-center justify-between rounded-md border px-3 text-sm font-medium transition ${
          isActive
            ? 'border-primary text-zinc-950 dark:text-zinc-50'
            : 'border-zinc-200 text-zinc-600 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-50'
        }`
      }
    >
      <span>{label}</span>
      {icon}
    </NavLink>
  )
}

function NotificationButton({
  unreadCount,
  onClick,
  fullWidth = false,
}: {
  unreadCount: number
  onClick: () => void
  fullWidth?: boolean
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      className={`relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-800 ${
        fullWidth ? 'w-full justify-between' : 'min-w-11'
      }`}
      aria-label="Open notifications"
    >
      {fullWidth ? <span>Notifications</span> : null}
      <span className="relative inline-flex">
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </span>
    </motion.button>
  )
}

function NotificationPanel({
  notifications,
  loading,
  error,
  onNotificationClick,
  align = 'left',
}: {
  notifications: NotificationItem[]
  loading: boolean
  error: string | null
  onNotificationClick: (notification: NotificationItem) => void
  align?: 'left' | 'right'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.14 }}
      className={`absolute bottom-full z-50 mb-2 w-[min(22rem,calc(100vw-2rem))] border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950 ${
        align === 'right' ? 'right-0 top-full bottom-auto mt-2 mb-0' : 'left-0'
      }`}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-2 pb-2 dark:border-zinc-800">
        <p className="text-sm font-semibold">Notifications</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">In-app</p>
      </div>
      <div className="max-h-96 overflow-y-auto py-2">
        {loading ? <NotificationSkeleton /> : null}
        {error ? <p className="px-2 py-3 text-sm text-red-600">{error}</p> : null}
        {!loading && !error && notifications.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">No notifications recorded.</p>
        ) : null}
        {!loading && !error
          ? notifications.map((notification) => (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                key={notification.id}
                onClick={() => onNotificationClick(notification)}
                className="flex w-full items-start gap-3 rounded-md px-2 py-3 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    notification.isRead ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-primary'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {notification.title}
                  </span>
                  <span className="mt-1 block line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {notification.body}
                  </span>
                  <span className="mt-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                    {formatNotificationTime(notification.createdAt)}
                  </span>
                </span>
              </motion.button>
            ))
          : null}
      </div>
    </motion.div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="space-y-2 px-2 py-3" aria-label="Loading notifications">
      {[0, 1, 2].map((item) => (
        <div key={item} className="space-y-2 border-b border-zinc-200 pb-3 last:border-b-0 dark:border-zinc-800">
          <div className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
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

function normalizeNotificationState(value: unknown): NotificationState {
  if (!value || typeof value !== 'object') return { unreadCount: 0, notifications: [] }

  const source = value as Record<string, unknown>
  const rawNotifications = Array.isArray(source.notifications) ? source.notifications : []

  return {
    unreadCount: typeof source.unreadCount === 'number' ? source.unreadCount : 0,
    notifications: rawNotifications.map(normalizeNotificationItem).filter(isNotificationItem),
  }
}

function isNotificationItem(value: NotificationItem | null): value is NotificationItem {
  return value !== null
}

function normalizeNotificationItem(value: unknown): NotificationItem | null {
  if (!value || typeof value !== 'object') return null

  const source = value as Record<string, unknown>
  const id = typeof source.id === 'string' ? source.id : null
  const title = typeof source.title === 'string' ? source.title : null
  const body = typeof source.body === 'string' ? source.body : ''
  const createdAt = typeof source.createdAt === 'string' ? source.createdAt : null

  if (!id || !title || !createdAt) return null

  return {
    id,
    title,
    body,
    linkEntityType: typeof source.linkEntityType === 'string' ? source.linkEntityType : null,
    linkEntityId: typeof source.linkEntityId === 'string' ? source.linkEntityId : null,
    isRead: source.isRead === true,
    createdAt,
  }
}

function formatNotificationTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Time unavailable'

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
