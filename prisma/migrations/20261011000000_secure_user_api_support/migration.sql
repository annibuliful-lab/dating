-- Additive preparation: safe to apply before switching the application to server APIs.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER TABLE public."ChatParticipant" ADD COLUMN IF NOT EXISTS "typingUntil" timestamptz(6);
ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "videoUrl" text;

-- The function runs with the caller's privileges; only the server can execute it.
CREATE OR REPLACE FUNCTION public.register_community_user(
  app_user_id uuid, app_email text, app_username text, app_password text
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."User" WHERE lower(email) = lower(app_email) OR lower(username) = lower(app_username)) THEN
    RAISE EXCEPTION 'Account exists' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public."User" (id, email, username, "passwordHash", "fullName", status, "isVerified", "updatedAt")
    VALUES (app_user_id, app_email, app_username, app_password, '', 'ACTIVE', false, now());
  INSERT INTO public."OAuthAccount" (id, "userId", type, provider, "providerAccountId")
    VALUES (gen_random_uuid()::text, app_user_id, 'oauth', 'credentials', app_user_id::text);
END;
$$;
REVOKE ALL ON FUNCTION public.register_community_user(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_community_user(uuid, text, text, text) TO service_role;

-- Profile and feed assets remain in the intentionally public dating bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('chat-media', 'chat-media', false, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
