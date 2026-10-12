import 'server-only';
import { createClient } from '@supabase/supabase-js';

const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('Configure the server-only SUPABASE_SECRET_KEY');

if (!key.startsWith('sb_secret_')) {
  let role: unknown;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* Invalid keys fail closed. */ }
  if (role !== 'service_role') throw new Error('Use a server secret key, never the anonymous key');
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, key,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
