import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const id = '11111111-1111-4111-8111-111111111111';
function config({ missing = false, suspended = false, verified = true } = {}) {
  let options; const queries = [];
  const supabase = { from(table) {
    const query = { table, filters: [] }; queries.push(query);
    const builder = new Proxy({}, { get(_target, method) {
      if (method === 'then') return resolve => resolve({ data: missing ? null : table === 'OAuthAccount' ? { userId: id } : { id, status: suspended ? 'SUSPENDED' : 'ACTIVE', role: 'USER', isVerified: verified, fullName: '', email: 'user@example.test', passwordHash: 'existing-value' }, error: missing ? { code: 'PGRST116' } : null });
      return (...args) => { query.filters.push([method, ...args]); return builder; };
    } }); return builder;
  } };
  const output = ts.transpileModule(readFileSync(new URL('../src/auth.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', output)(name => {
    if (name === 'next-auth') return { __esModule: true, default(value) { options = value; return {}; } };
    if (name.startsWith('next-auth/providers/')) return { __esModule: true, default(value) { return value; } };
    if (name === './server/supabase') return { supabase };
    if (name === './lib/normalize-user-fields') return { normalizeEmail: email => email?.trim() || null };
    if (name === 'uuid') return { v7: () => id };
    throw new Error(name);
  }, {});
  return { options, queries };
}

test('credentials keep existing password comparison and use the database user id', async () => {
  const h = config(); const provider = h.options.providers[0];
  assert.equal(await provider.authorize({ email: 'user@example.test', password: 'wrong' }), null);
  assert.equal((await provider.authorize({ email: 'user@example.test', password: 'existing-value' })).id, id);
  assert.equal(await provider.authorize({ email: {}, password: 'existing-value' }), null);
  const account = { provider: 'credentials', providerAccountId: id };
  assert.equal(await h.options.callbacks.signIn({ account, user: { id } }), true);
  assert.equal(h.queries.some(query => query.table === 'OAuthAccount'), false);
});

test('session updates cannot supply a different identity or elevated role', async () => {
  const h = config(); const token = { userId: id, accessToken: 'old-provider-token' };
  const updated = await h.options.callbacks.jwt({ token, trigger: 'update', session: { userId: 'other', role: 'ADMIN', name: 'new-name' } });
  assert.equal(updated.userId, id); assert.equal(updated.role, undefined); assert.equal(updated.accessToken, undefined);
  const session = await h.options.callbacks.session({ token, session: { user: {} } });
  assert.equal(session.user.id, id); assert.equal(session.user.role, 'USER');
  assert.equal('passwordHash' in session.user, false);
});

test('legacy sessions resolve account ids with the provider to prevent collisions', async () => {
  const h = config();
  await h.options.callbacks.session({ token: { provider: 'line', providerAccountId: 'same-id' }, session: { user: {} } });
  assert.ok(h.queries[0].filters.some(args => JSON.stringify(args) === JSON.stringify(['eq', 'provider', 'line'])));
});

test('missing database users invalidate the canonical session identity', async () => {
  const h = config({ missing: true });
  const session = await h.options.callbacks.session({ token: { userId: id }, session: { user: { id: 'stale' } } });
  assert.equal(session.user.id, '');
});

test('every session resolves current authorization fields from the database', async () => {
  const h = config({ suspended: true, verified: false });
  const session = await h.options.callbacks.session({ token: { userId: id, role: 'ADMIN', status: 'ACTIVE', isVerified: true }, session: { user: {} } });
  assert.equal(session.user.status, 'SUSPENDED');
  assert.equal(session.user.role, 'USER');
  assert.equal(session.user.isVerified, false);
  assert.equal(h.queries.length, 1);
  assert.deepEqual(h.queries[0].filters[0], ['select', 'id, status, role, isVerified']);
});

test('suspension is checked only after successful password comparison', async () => {
  const h = config({ suspended: true });
  assert.equal(await h.options.providers[0].authorize({ email: 'user@example.test', password: 'wrong' }), null);
  await assert.rejects(h.options.providers[0].authorize({ email: 'user@example.test', password: 'existing-value' }));
});
