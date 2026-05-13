// Supabase Edge Functions run on Deno and resolve npm: imports at deploy time.
// @ts-expect-error Deno import resolution is not available to the Vite TypeScript server.
import { createClient } from 'npm:@supabase/supabase-js@2'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

type InviteRequest = {
  email?: string
  roleCode?: string
  expiresDays?: number
}

type InvitationRow = {
  email: string
  status: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Function environment is not configured.' }, 500)
  }

  if (!authorization) {
    return jsonResponse({ error: 'Authentication required.' }, 401)
  }

  let payload: InviteRequest
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400)
  }

  const email = payload.email?.trim().toLowerCase()
  const roleCode = payload.roleCode?.trim().toUpperCase()
  const expiresDays = Math.max(Math.trunc(payload.expiresDays ?? 14), 1)

  if (!email || !roleCode) {
    return jsonResponse({ error: 'Email and role are required.' }, 400)
  }

  const userScopedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })

  const { data: invitationId, error: inviteError } = await userScopedClient.rpc(
    'invite_user_role_by_email',
    {
      p_email: email,
      p_role_code: roleCode,
      p_expires_days: expiresDays,
    },
  )

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 403)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: invitation } = await adminClient
    .from('role_invitations')
    .select('email, status')
    .eq('id', invitationId)
    .maybeSingle<InvitationRow>()

  if (invitation?.status === 'Accepted') {
    return jsonResponse({
      invitationId,
      emailSent: false,
      emailSkipped: 'The user already exists, so the role is active now.',
    })
  }

  const redirectTo = getRedirectUrl()
  const { error: emailError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { racedocRoleCode: roleCode, racedocInvitationId: invitationId },
    ...(redirectTo ? { redirectTo } : {}),
  })

  if (emailError) {
    return jsonResponse({
      invitationId,
      emailSent: false,
      warning: `Invitation was recorded, but email delivery failed: ${emailError.message}`,
    })
  }

  return jsonResponse({ invitationId, emailSent: true })
})

function getRedirectUrl() {
  const appOrigin = Deno.env.get('APP_ORIGIN') ?? Deno.env.get('SITE_URL')
  if (!appOrigin) return null
  return appOrigin.replace(/\/$/, '/')
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
