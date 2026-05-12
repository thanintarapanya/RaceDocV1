import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type OnboardingStatus = 'ProfileRequired' | 'TeamRequired' | 'Ready'
export type AuthStatus =
  | 'checking'
  | 'anonymous'
  | 'profile_required'
  | 'team_required'
  | 'ready'
  | 'error'

export type RoleCode =
  | 'ADMIN'
  | 'SECRETARY'
  | 'HEAD_SCRUTINEER'
  | 'SCRUTINEER_STAFF'
  | 'OFFSITE_SCRUTINEER'
  | 'CHAIRMAN'
  | 'STEWARD'
  | 'CLERK'
  | 'TEAM_MANAGER'
  | 'COMPETITOR'

export type Profile = {
  id: string
  auth_user_id: string
  first_name_th: string | null
  last_name_th: string | null
  first_name_en: string | null
  last_name_en: string | null
  phone: string | null
  identity_no: string | null
  passport_no: string | null
  date_of_birth: string | null
  blood_type: string | null
  nationality: string | null
  address: string | null
  postcode: string | null
  line_id: string | null
  instagram: string | null
  facebook: string | null
  youtube: string | null
  tiktok: string | null
  onboarding_status: OnboardingStatus
}

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  roles: RoleCode[]
  loading: boolean
  status: AuthStatus
  authError: string | null
  refreshProfile: () => Promise<Profile | null>
  refreshRoles: () => Promise<RoleCode[]>
  refreshAuth: () => Promise<void>
  signOut: () => Promise<void>
  clearLocalSession: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
