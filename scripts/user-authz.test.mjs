import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const chatId = '33333333-3333-4333-8333-333333333333';
const messageId = '44444444-4444-4444-8444-444444444444';

function harness({ sessionId = id, verified = true, suspended = false, member = true, senderId = id } = {}) {
  const queries = [];
  const services = [];
  const actor = { id, role: 'USER', status: suspended ? 'SUSPENDED' : 'ACTIVE', isVerified: verified };
  const supabase = { storage: { from(bucket) { return { upload: async (key, _bytes, options) => { services.push(['upload', bucket, key, options]); return { error: null }; }, createSignedUrl: async () => { services.push(['sign']); return { data: { signedUrl: 'https://storage.test/signed' }, error: null }; } }; } }, from(table) {
    const query = { table, filters: [], mutation: false };
    queries.push(query);
    const builder = new Proxy({}, { get(_target, name) {
      if (name === 'then') return resolve => {
        const data = table === 'User' ? actor : table === 'ChatParticipant' ? (member ? { id, isAdmin: false } : null)
          : table === 'Message' ? { id: messageId, senderId, chatId } : { id, visibility: 'PUBLIC' };
        resolve({ data, error: null });
      };
      return (...args) => { query.filters.push([name, ...args]); if (['update', 'insert', 'delete'].includes(name)) query.mutation = true; return builder; };
    } });
    return builder;
  } };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'exports', output)(name => {
      if (name === 'server-only') return {};
      if (name === '@/auth') return { auth: async () => ({ user: { id: sessionId } }) };
      if (name === './supabase' || name === '@/server/supabase') return { supabase };
      if (['@/server/access', '@/server/validation'].includes(name)) return load(name.slice(2));
      if (name === './access') return load('server/access');
      if (name === './profile-update') return load('server/data/profile-update');
      if (name.startsWith('./')) {
        const service = new Proxy({}, { get(_, method) { return async (...args) => { services.push([String(method), ...args]); return { success: true }; }; } });
        const serviceName = name === './posts' ? 'postService' : name === './messages' ? 'messageService' : name === './users' ? 'userService' : name === './ads' ? 'adService' : null;
        return serviceName ? { [serviceName]: service } : service;
      }
      if (name.startsWith('@/')) return load(name.slice(2));
      return require(name);
    }, exports);
    return exports;
  }
  return { load, actor, queries, services, access: load('server/access'), validation: load('server/validation'), dispatch: load('server/data/dispatch').dispatch, update: load('server/data/profile-update').updateUserProfile };
}

test('missing session cannot obtain a database actor', async () => {
  const h = harness({ sessionId: '' });
  await assert.rejects(h.access.requireUser(), { status: 401 });
  assert.equal(h.queries.length, 0);
});

test('cross-origin mutations and ambiguous storage paths are rejected', () => {
  const h = harness();
  assert.throws(() => h.access.requireSameOrigin(new Request('https://app.test/api/data/posts', { headers: { origin: 'https://evil.test' } })), { status: 403 });
  assert.throws(() => h.access.requireSameOrigin(new Request('https://app.test/api/data/posts', { headers: { 'sec-fetch-site': 'cross-site' } })), { status: 403 });
  for (const key of [`users/${id}/../other`, `users/${id}/image?x`, `users/${other}/image`, `users/${id}/a\\b`]) assert.throws(() => h.validation.scopedKey(key, `users/${id}/`), { status: 403 });
});

test('users cannot read another user’s saved posts or submit another author', async () => {
  const h = harness();
  await assert.rejects(h.dispatch(h.actor, 'posts', 'getSavedPosts', [other]), { status: 403 });
  await assert.rejects(h.dispatch(h.actor, 'posts', 'createPost', [{ authorId: other }]), { status: 403 });
  assert.equal(h.services.length, 0);
});

test('profile ownership and a strict field allowlist prevent privilege changes', async () => {
  const h = harness({ verified: false });
  await assert.rejects(h.dispatch(h.actor, 'profile', 'updateUserProfile', [other, { username: 'example' }]), { status: 403 });
  for (const field of ['role', 'status', 'isVerified', 'verifiedBy', 'passwordHash', 'fullName']) await assert.rejects(h.update(id, { [field]: 'ADMIN' }), { status: 400 });
  assert.equal(h.queries.length, 0);
  await h.dispatch(h.actor, 'profile', 'updateUserProfile', [id, { username: 'example', password: '' }]);
  const update = h.queries[0].filters.find(([name]) => name === 'update')[1];
  assert.equal(update.username, 'example'); assert.equal('passwordHash' in update, false);
  assert.deepEqual(h.queries[0].filters.find(([name]) => name === 'select'), ['select', 'id, username, updatedAt']);
});

test('password values retain their existing format and are excluded from update responses', async () => {
  const h = harness(); await h.update(id, { password: 'same-format' });
  assert.equal(h.queries[0].filters.find(([name]) => name === 'update')[1].passwordHash, 'same-format');
  assert.equal(h.queries[0].filters.find(([name]) => name === 'select')[1].includes('passwordHash'), false);
});

test('unverified users can edit their own profile but cannot enter community APIs', async () => {
  const h = harness({ verified: false });
  for (const [domain, action, args] of [['posts', 'getPublicPosts', []], ['users', 'searchUsers', ['alice']], ['messages', 'getUserChats', [id]]]) await assert.rejects(h.dispatch(h.actor, domain, action, args), { status: 403 });
});

test('suspended users retain public feed reads but cannot write or browse hashtags', async () => {
  const h = harness({ suspended: true });
  await h.dispatch(h.actor, 'posts', 'getPublicPosts', [20, 0, {}]);
  await assert.rejects(h.dispatch(h.actor, 'posts', 'getPublicPosts', [20, 0, { hashtag: 'tag' }]), { status: 403 });
  await assert.rejects(h.dispatch(h.actor, 'posts', 'createPost', [{ authorId: id }]), { status: 403 });
  await assert.rejects(h.dispatch(h.actor, 'profile', 'updateUserProfile', [id, {}]), { status: 403 });
});

test('outsiders cannot read, send, edit, or delete chat messages', async () => {
  const h = harness({ member: false });
  for (const [action, args] of [['getChatMessages', [chatId]], ['sendMessage', [{ id: messageId, chatId, senderId: id, text: 'hi' }]], ['editMessage', [messageId, 'changed']], ['deleteMessage', [messageId]], ['getTyping', [chatId]]]) await assert.rejects(h.dispatch(h.actor, 'messages', action, args), { status: 403 });
  assert.equal(h.services.length, 0); assert.equal(h.queries.some(query => query.mutation), false);
});

test('chat membership does not allow editing another sender’s messages', async () => {
  const h = harness({ senderId: other });
  await assert.rejects(h.dispatch(h.actor, 'messages', 'editMessage', [messageId, 'changed']), { status: 403 });
  await assert.rejects(h.dispatch(h.actor, 'messages', 'deleteMessage', [messageId]), { status: 403 });
  await h.dispatch(h.actor, 'messages', 'getMessage', [messageId]);
  assert.deepEqual(h.services[0], ['getMessage', messageId]);
});

test('message send binds actor identity, media scope, and ignores caller timestamps', async () => {
  const h = harness();
  await assert.rejects(h.dispatch(h.actor, 'messages', 'sendMessage', [{ id: messageId, chatId, senderId: other, text: 'hi' }]), { status: 403 });
  await assert.rejects(h.dispatch(h.actor, 'messages', 'sendMessage', [{ id: messageId, chatId, senderId: id, text: 'hi', imageUrl: 'https://evil.test/x' }]), { status: 400 });
  await h.dispatch(h.actor, 'messages', 'sendMessage', [{ id: messageId, chatId, senderId: id, text: 'hi', createdAt: '2000-01-01' }]);
  const sent = h.services[0][1]; assert.equal(sent.senderId, id); assert.equal('createdAt' in sent, false);
});

test('unknown operations cannot invoke privileged service methods', async () => {
  const h = harness();
  for (const action of ['createChat', 'addChatParticipant', 'updateChatGroupStatus', 'constructor', '__proto__']) await assert.rejects(h.dispatch(h.actor, 'messages', action, []), { status: 404 });
  assert.equal(h.services.length, 0);
});

test('uploads enforce actual file content and user-owned paths', async () => {
  const h = harness(); const storage = h.load('app/api/storage/route');
  async function upload(kind, key, type, bytes, chat = '') {
    const form = new FormData(); form.set('kind', kind); form.set('key', key); form.set('chatId', chat);
    form.set('file', new File([new Uint8Array(bytes)], 'image.png', { type }));
    return storage.POST(new Request('https://app.test/api/storage', { method: 'POST', body: form, headers: { origin: 'https://app.test' } }));
  }
  assert.equal((await upload('profile', `users/${other}/image.png`, 'image/png', [137,80,78,71,13,10,26,10])).status, 403);
  assert.equal((await upload('profile', `users/${id}/image.png`, 'image/png', [255,216,255])).status, 400);
  assert.equal((await upload('profile', `users/${id}/image.svg`, 'image/svg+xml', [60,115,118,103])).status, 400);
  assert.equal(h.services.length, 0);
  assert.equal((await upload('profile', `users/${id}/image.png`, 'image/png', [137,80,78,71,13,10,26,10])).status, 200);
  assert.deepEqual(h.services[0].slice(0, 3), ['upload', 'dating', `users/${id}/image.png`]);
  assert.equal((await upload('chat', '', 'image/png', [137,80,78,71,13,10,26,10], chatId)).status, 200);
  assert.equal(h.services[1][1], 'chat-media');
  assert.ok(h.services[1][2].startsWith(`chats/${chatId}/users/${id}/`));
});

test('private media URLs cannot be signed for outsiders or another chat', async () => {
  const outsider = harness({ member: false });
  const options = { params: Promise.resolve({ chatId }) };
  const request = new Request(`https://app.test/api/chat/${chatId}/media?path=${encodeURIComponent(`chats/${chatId}/users/${id}/image.png`)}`);
  assert.equal((await outsider.load('app/api/chat/[chatId]/media/route').GET(request, options)).status, 403);
  assert.equal(outsider.services.length, 0);
  const member = harness();
  const wrongPath = new Request(`https://app.test/api/chat/${chatId}/media?path=${encodeURIComponent(`chats/${other}/users/${id}/image.png`)}`);
  assert.equal((await member.load('app/api/chat/[chatId]/media/route').GET(wrongPath, options)).status, 403);
  assert.equal(member.services.length, 0);
});
