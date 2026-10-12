import { createClient } from '@supabase/supabase-js';
export { BUCKET_NAME } from '@/services/supabase/storage';

// Temporary compatibility for existing clients; new user services use authenticated APIs.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
