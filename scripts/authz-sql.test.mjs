import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

// This test only connects to an explicitly isolated loopback PostgreSQL instance.
const connection = new URL(process.env.AUTHZ_TEST_DATABASE_URL || 'postgresql://postgres:dating-test-only@127.0.0.1:55432/postgres');
if (!['127.0.0.1', 'localhost'].includes(connection.hostname) || connection.port !== '55432') throw new Error('Use the isolated PostgreSQL test container on port 55432');
const database = `dating_authz_test_${process.pid}`;
function sql(input, db = database, success = true) {
  const result = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', connection.hostname, '-p', connection.port, '-U', decodeURIComponent(connection.username), '-d', db], {
    input, encoding: 'utf8', timeout: 15000, env: { ...process.env, PGPASSWORD: decodeURIComponent(connection.password) },
  });
  if (success) assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result;
}

test('SQL blocks anonymous/authenticated tables, columns, RPCs and storage while preserving server access', () => {
  sql(`CREATE DATABASE ${database};`, 'postgres');
  try {
    sql(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA storage; CREATE SCHEMA realtime;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text, name text);
    CREATE TABLE realtime.messages (id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA storage, realtime TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage, realtime TO anon, authenticated, service_role;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY unrestricted ON storage.objects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`);
    for (const dir of readdirSync(new URL('../prisma/migrations', import.meta.url)).sort()) {
      const file = new URL(`../prisma/migrations/${dir}/migration.sql`, import.meta.url);
      if (!existsSync(file) || dir.endsWith('lock_down_direct_user_access')) continue;
      sql(readFileSync(file, 'utf8'));
    }
    sql(`SET ROLE service_role;
      SELECT public.register_community_user('11111111-1111-4111-8111-111111111111', 'test@example.test', 'test@example.test', 'preserved-format'); RESET ROLE;`);
    assert.equal(sql(`SELECT "passwordHash" = 'preserved-format' AND "isVerified" = false AND role = 'USER' FROM public."User";`).stdout.trim(), 't');
    assert.equal(sql(`SELECT count(*) FROM public."OAuthAccount" WHERE provider = 'credentials';`).stdout.trim(), '1');
    assert.equal(sql(`SELECT has_function_privilege('anon', 'public.register_community_user(uuid,text,text,text)', 'EXECUTE');`).stdout.trim(), 'f');
    assert.equal(sql(`SELECT public FROM storage.buckets WHERE id = 'chat-media';`).stdout.trim(), 'f');
    // Reproduce an unrestricted legacy policy and explicit column grant before lockdown.
    sql(`ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY legacy ON public."User" FOR ALL TO anon USING (true) WITH CHECK (true);
      GRANT SELECT ("passwordHash"), UPDATE (role) ON public."User" TO anon;
      SET ROLE anon; SELECT id FROM public."User"; RESET ROLE;`);
    const rollback = sql(readFileSync(new URL('./snapshot-access-control.sql', import.meta.url), 'utf8')).stdout;
    sql(readFileSync(new URL('../docs/security/sql/lock-down-direct-user-access.sql', import.meta.url), 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      for (const request of ['SELECT id FROM public."User"', 'SELECT "passwordHash" FROM public."User"', 'UPDATE public."User" SET role = \'ADMIN\'', 'SELECT * FROM public."Message"', 'SELECT * FROM public."OAuthAccount"', 'SELECT * FROM public."Session"', 'SELECT * FROM storage.objects', 'INSERT INTO storage.objects(id,bucket_id,name) VALUES(gen_random_uuid(),\'dating\',\'evil\')', "SELECT public.register_community_user(gen_random_uuid(), 'new@example.test', 'new', 'secret')"]) {
        const result = sql(`SET ROLE ${role}; ${request};`, database, false);
        assert.notEqual(result.status, 0, `${role} unexpectedly executed ${request}`);
        assert.match(result.stderr, /permission denied/);
      }
    }
    assert.equal(sql(`SELECT count(*) FROM pg_policies WHERE schemaname = 'public';`).stdout.trim(), '0');
    assert.equal(sql(`SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;`).stdout.trim(), '0');
    assert.equal(sql(`SET ROLE service_role; SELECT count(*) FROM public."User";`).stdout.trim(), '1');
    assert.equal(sql(`SELECT has_column_privilege('anon', 'public."User"', 'passwordHash', 'SELECT');`).stdout.trim(), 'f');
    sql(`CREATE TABLE public.future_table(id uuid);`);
    assert.equal(sql(`SELECT has_table_privilege('anon', 'public.future_table', 'SELECT');`).stdout.trim(), 'f');
    assert.equal(sql(`SELECT has_table_privilege('authenticated', 'public.future_table', 'INSERT');`).stdout.trim(), 'f');
    sql(rollback);
    assert.equal(sql(`SET ROLE anon; SELECT count(*) FROM public."User";`).stdout.trim(), '1');
    assert.equal(sql(`SELECT has_column_privilege('anon', 'public."User"', 'passwordHash', 'SELECT');`).stdout.trim(), 't');
    assert.equal(sql(`SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname = 'legacy';`).stdout.trim(), '1');
    assert.equal(sql(`SELECT has_function_privilege('anon', 'public.register_community_user(uuid,text,text,text)', 'EXECUTE');`).stdout.trim(), 'f');
  } finally { sql(`DROP DATABASE ${database} WITH (FORCE);`, 'postgres'); }
});

test('owned post deletion cascades likes/saves atomically and its rollback restores restrictive foreign keys', () => {
  sql(`CREATE DATABASE ${database};`, 'postgres');
  try {
    sql(`CREATE TABLE public."Post" (id uuid PRIMARY KEY, "authorId" uuid NOT NULL);
      CREATE TABLE public."PostLike" (id int PRIMARY KEY, "postId" uuid NOT NULL,
        CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES public."Post"(id) ON DELETE RESTRICT ON UPDATE CASCADE);
      CREATE TABLE public."PostSave" (id int PRIMARY KEY, "postId" uuid NOT NULL,
        CONSTRAINT "PostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES public."Post"(id) ON DELETE RESTRICT ON UPDATE CASCADE);
      INSERT INTO public."Post" VALUES
        ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'),
        ('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444');
      INSERT INTO public."PostLike" VALUES (1, '11111111-1111-4111-8111-111111111111'), (2, '22222222-2222-4222-8222-222222222222');
      INSERT INTO public."PostSave" SELECT * FROM public."PostLike";`);
    const ownDelete = `DELETE FROM public."Post" WHERE id = '11111111-1111-4111-8111-111111111111' AND "authorId" = '33333333-3333-4333-8333-333333333333';`;
    assert.notEqual(sql(ownDelete, database, false).status, 0);
    sql(readFileSync(new URL('../prisma/migrations/20261012000000_enable_owned_post_deletion/migration.sql', import.meta.url), 'utf8'));
    assert.equal(sql(`SELECT string_agg(confdeltype::text, '' ORDER BY conname) FROM pg_constraint WHERE conname IN ('PostLike_postId_fkey', 'PostSave_postId_fkey');`).stdout.trim(), 'cc');
    sql(`DELETE FROM public."Post" WHERE id = '11111111-1111-4111-8111-111111111111' AND "authorId" = '44444444-4444-4444-8444-444444444444';`);
    assert.equal(sql(`SELECT count(*) FROM public."Post";`).stdout.trim(), '2');
    sql(ownDelete);
    for (const table of ['Post', 'PostLike', 'PostSave']) assert.equal(sql(`SELECT count(*) FROM public."${table}";`).stdout.trim(), '1');
    assert.equal(sql(`SELECT id FROM public."Post";`).stdout.trim(), '22222222-2222-4222-8222-222222222222');
    sql(readFileSync(new URL('../docs/security/sql/rollback-owned-post-deletion.sql', import.meta.url), 'utf8'));
    assert.equal(sql(`SELECT string_agg(confdeltype::text, '' ORDER BY conname) FROM pg_constraint WHERE conname IN ('PostLike_postId_fkey', 'PostSave_postId_fkey');`).stdout.trim(), 'rr');
    assert.notEqual(sql(`DELETE FROM public."Post";`, database, false).status, 0);
    for (const table of ['Post', 'PostLike', 'PostSave']) assert.equal(sql(`SELECT count(*) FROM public."${table}";`).stdout.trim(), '1');
  } finally { sql(`DROP DATABASE ${database} WITH (FORCE);`, 'postgres'); }
});
