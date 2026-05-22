import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const missingSupabaseConfigMessage = 'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment.'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function createMissingSupabaseClient() {
  const missingConfigError = new Error(missingSupabaseConfigMessage)
  const missingConfigResult = () => Promise.resolve({ data: null, error: missingConfigError })

  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: missingConfigError }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      }),
      signInWithPassword: missingConfigResult,
      signInWithOAuth: missingConfigResult,
      signOut: missingConfigResult,
      updateUser: missingConfigResult,
      resetPasswordForEmail: missingConfigResult,
      signUp: missingConfigResult,
    },
    rpc: missingConfigResult,
    from: () => ({
      select: missingConfigResult,
      insert: missingConfigResult,
      update: missingConfigResult,
      upsert: missingConfigResult,
      delete: missingConfigResult,
    }),
    storage: {
      from: () => ({
        upload: missingConfigResult,
        download: missingConfigResult,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  } as unknown as SupabaseClient
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingSupabaseClient()
