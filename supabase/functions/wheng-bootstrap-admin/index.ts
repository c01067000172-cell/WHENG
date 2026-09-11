import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

// 실제 1회용 설정코드는 저장하지 않고 SHA-256 해시만 보관합니다.
const BOOTSTRAP_HASH = 'd8384cec259457a66f347cecc791adff2d36b254bf8a386a749c7521e9ad0576'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')
  const requestKey = req.headers.get('apikey') ?? ''
  if (!publishableKeys.default || requestKey !== publishableKeys.default) {
    return json({ error: 'Unauthorized client' }, 401)
  }

  let payload: { email?: string; password?: string; token?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email = String(payload.email ?? '').trim().toLowerCase()
  const password = String(payload.password ?? '')
  const token = String(payload.token ?? '')
  if (!email || !email.includes('@')) return json({ error: 'Valid email required' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
  if ((await sha256(token)) !== BOOTSTRAP_HASH) return json({ error: 'Invalid setup code' }, 403)

  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
  const secretKey = secretKeys.default
  const url = Deno.env.get('SUPABASE_URL')
  if (!url || !secretKey) return json({ error: 'Server configuration error' }, 500)

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existing, error: existingError } = await admin
    .from('wheng_admins')
    .select('user_id')
    .limit(1)
  if (existingError) return json({ error: 'Admin check failed' }, 500)
  if ((existing ?? []).length > 0) return json({ error: 'WHENG admin already exists' }, 409)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { wheng_admin: true },
  })
  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'User creation failed' }, 400)
  }

  const { error: insertError } = await admin
    .from('wheng_admins')
    .insert({ user_id: created.user.id })
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: 'Admin registration failed' }, 500)
  }

  return json({ ok: true, email })
})
