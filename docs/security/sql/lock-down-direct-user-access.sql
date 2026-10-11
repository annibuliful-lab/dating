-- CUTOVER ONLY: deploy/check the protected server APIs and migrate legacy chat media first.
-- NextAuth sessions do not authenticate requests to the Supabase Data API.
BEGIN;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Remove the initial migration's automatic browser grants for future application objects.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $$
DECLARE row record;
BEGIN
  FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', row.tablename);
  END LOOP;
  FOR row IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', row.policyname, row.tablename);
  END LOOP;
  -- Column grants survive table-level REVOKE, so revoke those as well.
  FOR row IN SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' LOOP
    EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.%I FROM PUBLIC, anon, authenticated',
      row.column_name, row.column_name, row.column_name, row.column_name, row.table_name);
  END LOOP;
END;
$$;

-- Public object URLs still serve intentional profile/feed images; uploads/listing go through the server.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON storage.objects FROM PUBLIC, anon, authenticated;
DO $$
DECLARE row record;
BEGIN
  FOR row IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', row.policyname);
  END LOOP;
END;
$$;

-- No browser subscriptions are used by this version; the API checks membership for each poll.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON realtime.messages FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
