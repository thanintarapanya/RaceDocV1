import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import {
  AuthContext,
  type AuthStatus,
  type OnboardingStatus,
  type Profile,
  type RoleCode,
} from './auth-context'
import type { Session } from '@supabase/supabase-js'

type BootstrapRow = {
  auth_user_id: string
  email: string | null
  app_user_exists: boolean
  app_user_status: string | null
  profile_exists: boolean
  profile_completed: boolean
  profile: Omit<Profile, 'onboarding_status'> | null
  roles: RoleCode[] | string[] | null
  onboarding_status: OnboardingStatus
  is_admin_or_secretary: boolean
}

const authTimeoutMs = 8000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleCode[]>([])
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [authError, setAuthError] = useState<string | null>(null)
  const profileRef = useRef<Profile | null>(null)
  const rolesRef = useRef<RoleCode[]>([])
  const statusRef = useRef<AuthStatus>('checking')
  const loading = status === 'checking'
  const userId = session?.user.id ?? null

  const setProfileState = useCallback((nextProfile: Profile | null) => {
    profileRef.current = nextProfile
    setProfile(nextProfile)
  }, [])

  const setRolesState = useCallback((nextRoles: RoleCode[]) => {
    rolesRef.current = nextRoles
    setRoles(nextRoles)
  }, [])

  const setStatusState = useCallback((nextStatus: AuthStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const applyAnonymousState = useCallback(() => {
    setProfileState(null)
    setRolesState([])
    setStatusState('anonymous')
    setAuthError(null)
  }, [setProfileState, setRolesState, setStatusState])

  const applyBootstrap = useCallback((row: BootstrapRow | null, fallbackUserId: string) => {
    if (!row) {
      if (profileRef.current) {
        setStatusState(resolveAuthStatus(profileRef.current.onboarding_status))
        setAuthError(null)
        return
      }

      throw new Error('Unable to load account profile. Please refresh the page.')
    }

    if (!row.profile && profileRef.current) {
      setStatusState(resolveAuthStatus(profileRef.current.onboarding_status))
      setAuthError(null)
      return
    }

    const nextRoles = ((row?.roles ?? []) as string[]).filter(Boolean) as RoleCode[]
    const onboardingStatus = row?.onboarding_status ?? 'ProfileRequired'
    const nextProfile = row?.profile
      ? ({ ...row.profile, onboarding_status: onboardingStatus } as Profile)
      : createRequiredProfile(fallbackUserId, onboardingStatus)

    setProfileState(nextProfile)
    setRolesState(nextRoles)
    setStatusState(resolveAuthStatus(onboardingStatus))
    setAuthError(null)
  }, [setProfileState, setRolesState, setStatusState])

  const loadBootstrap = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user.id) {
      applyAnonymousState()
      return
    }

    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_auth_bootstrap')),
      authTimeoutMs,
      'Auth bootstrap timed out. Please refresh or sign in again.',
    )

    if (error) {
      throw error
    }

    applyBootstrap(((data ?? []) as BootstrapRow[])[0] ?? null, nextSession.user.id)
  }, [applyAnonymousState, applyBootstrap])

  const refreshAuth = useCallback(async () => {
    setStatusState('checking')
    setAuthError(null)

    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        authTimeoutMs,
        'Session check timed out. Please refresh or sign in again.',
      )

      if (error) throw error

      setSession(data.session)
      await loadBootstrap(data.session)
    } catch (error) {
      console.error('Unable to refresh auth', error)
      if (profileRef.current) {
        setStatusState(statusRef.current === 'checking' ? resolveAuthStatus(profileRef.current.onboarding_status) : statusRef.current)
        setAuthError(getErrorMessage(error))
        return
      }

      setProfileState(null)
      setRolesState([])
      setStatusState('error')
      setAuthError(getErrorMessage(error))
    }
  }, [loadBootstrap, setProfileState, setRolesState, setStatusState])

  const refreshProfile = useCallback(async () => {
    if (!userId || !session) {
      applyAnonymousState()
      return null
    }

    await loadBootstrap(session)
    return profile
  }, [applyAnonymousState, loadBootstrap, profile, session, userId])

  const refreshRoles = useCallback(async () => {
    if (!session) {
      setRolesState([])
      return []
    }

    await loadBootstrap(session)
    return roles
  }, [loadBootstrap, roles, session, setRolesState])

  const clearLocalSession = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
    setSession(null)
    applyAnonymousState()
  }, [applyAnonymousState])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    applyAnonymousState()
  }, [applyAnonymousState])

  useEffect(() => {
    let active = true

    async function initializeAuth() {
      setStatusState('checking')
      setAuthError(null)

      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          authTimeoutMs,
          'Session check timed out. Please refresh or sign in again.',
        )

        if (!active) return

        if (error) throw error

        setSession(data.session)
        await loadBootstrap(data.session)
      } catch (error) {
        if (!active) return
        console.error('Unable to initialize auth session', error)
        setSession(null)
        setProfileState(null)
        setRolesState([])
        setStatusState('error')
        setAuthError(getErrorMessage(error))
      }
    }

    initializeAuth()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession)
        setAuthError(null)

        if (nextSession?.user.id) {
          if (!profileRef.current) {
            setStatusState('checking')
          }
        } else {
          applyAnonymousState()
          return
        }

        try {
          await loadBootstrap(nextSession)
        } catch (error) {
          if (!active) return
          console.error('Unable to load auth context', error)
          if (profileRef.current) {
            setStatusState(statusRef.current === 'checking' ? resolveAuthStatus(profileRef.current.onboarding_status) : statusRef.current)
            setAuthError(getErrorMessage(error))
            return
          }

          setProfileState(null)
          setRolesState([])
          setStatusState('error')
          setAuthError(getErrorMessage(error))
        }
      },
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [applyAnonymousState, loadBootstrap, setProfileState, setRolesState, setStatusState])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading,
      status,
      authError,
      refreshProfile,
      refreshRoles,
      refreshAuth,
      signOut,
      clearLocalSession,
    }),
    [
      authError,
      clearLocalSession,
      loading,
      profile,
      refreshAuth,
      refreshProfile,
      refreshRoles,
      roles,
      session,
      signOut,
      status,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function resolveAuthStatus(onboardingStatus: OnboardingStatus): AuthStatus {
  if (onboardingStatus === 'Ready') return 'ready'
  if (onboardingStatus === 'TeamRequired') return 'team_required'
  return 'profile_required'
}

function createRequiredProfile(userId: string, onboardingStatus: OnboardingStatus): Profile {
  return {
    id: userId,
    auth_user_id: userId,
    first_name_th: null,
    last_name_th: null,
    first_name_en: null,
    last_name_en: null,
    phone: null,
    identity_no: null,
    passport_no: null,
    date_of_birth: null,
    blood_type: null,
    nationality: null,
    address: null,
    postcode: null,
    line_id: null,
    instagram: null,
    facebook: null,
    youtube: null,
    tiktok: null,
    onboarding_status: onboardingStatus,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unable to initialize session.'
}
