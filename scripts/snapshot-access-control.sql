-- Read-only: produces executable rollback SQL, without reading application rows.
BEGIN READ ONLY;
WITH targets AS (
  SELECT c.oid, n.nspname, c.relname, c.relacl, c.relowner, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE (n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S'))
     OR (n.nspname = 'storage' AND c.relname = 'objects')
     OR (n.nspname = 'realtime' AND c.relname = 'messages')
), commands AS (
  SELECT 0 AS step, '-- EMERGENCY ROLLBACK: restores the old anonymous exposure. Keep maintenance mode on.' || E'\nBEGIN;' AS sql
  UNION ALL
  SELECT 1, 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated; REVOKE ALL ON SCHEMA public FROM PUBLIC, anon, authenticated; REVOKE ALL ON storage.objects, realtime.messages FROM PUBLIC, anon, authenticated;'
  UNION ALL
  SELECT 2, 'DO $$ DECLARE p record; BEGIN FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = ''public'' OR (schemaname = ''storage'' AND tablename = ''objects'') OR (schemaname = ''realtime'' AND tablename = ''messages'') LOOP EXECUTE format(''DROP POLICY %I ON %I.%I'', p.policyname, p.schemaname, p.tablename); END LOOP; END $$;'
  UNION ALL
  SELECT 3, format('GRANT %s ON SCHEMA public TO %s%s;', a.privilege_type,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
    CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
  WHERE n.nspname = 'public' AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
  UNION ALL
  SELECT 4, format('GRANT %s ON %s %I.%I TO %s%s;', a.privilege_type,
    CASE WHEN c.relkind = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, t.nspname, t.relname,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
    CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM targets t JOIN pg_class c ON c.oid = t.oid CROSS JOIN LATERAL aclexplode(coalesce(t.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END, t.relowner))) a
  WHERE a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated')
  UNION ALL
  SELECT 5, format('GRANT %s (%I) ON %I.%I TO %s%s;', a.privilege_type, col.attname, t.nspname, t.relname,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
    CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM targets t JOIN pg_attribute col ON col.attrelid = t.oid CROSS JOIN LATERAL aclexplode(col.attacl) a
  WHERE col.attnum > 0 AND NOT col.attisdropped AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
  UNION ALL
  SELECT 6, format('GRANT %s ON FUNCTION %I.%I(%s) TO %s%s;', a.privilege_type, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
    CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  WHERE n.nspname = 'public' AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
  UNION ALL
  SELECT 7, format('ALTER TABLE %I.%I %s ROW LEVEL SECURITY; ALTER TABLE %I.%I %s ROW LEVEL SECURITY;', t.nspname, t.relname,
    CASE WHEN t.relrowsecurity THEN 'ENABLE' ELSE 'DISABLE' END, t.nspname, t.relname, CASE WHEN t.relforcerowsecurity THEN 'FORCE' ELSE 'NO FORCE' END)
  FROM targets t JOIN pg_class c ON c.oid = t.oid WHERE c.relkind IN ('r','p')
  UNION ALL
  SELECT 8, format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;', policyname, schemaname, tablename, permissive, cmd,
    (SELECT string_agg(CASE WHEN role = 'public' THEN 'PUBLIC' ELSE quote_ident(role) END, ', ') FROM unnest(roles) role),
    CASE WHEN qual IS NOT NULL THEN format(' USING (%s)', qual) ELSE '' END,
    CASE WHEN with_check IS NOT NULL THEN format(' WITH CHECK (%s)', with_check) ELSE '' END)
  FROM pg_policies WHERE schemaname = 'public' OR (schemaname = 'storage' AND tablename = 'objects') OR (schemaname = 'realtime' AND tablename = 'messages')
  UNION ALL
  SELECT 9, 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;'
  UNION ALL
  SELECT 10, format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON %s TO %s%s;', pg_get_userbyid(d.defaclrole), a.privilege_type,
    CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' END,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
    CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE n.nspname = 'public' AND d.defaclobjtype IN ('r','S','f') AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
  UNION ALL SELECT 11, 'NOTIFY pgrst, ''reload schema''; COMMIT;'
)
SELECT sql FROM commands ORDER BY step, sql;
COMMIT;
