import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function harness({ server = false } = {}) {
  const calls = [];
  const modules = new Map();
  const browser = server ? undefined : { localStorage: { getItem: () => 'th' } };
  let time = 0;
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const exports = {}; modules.set(file, exports);
    const output = ts.transpileModule(readFileSync(new URL(`../src/services/${file}.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'exports', 'fetch', 'window', 'Date', output)(name => {
      if (name === '@/i18n/messages') return { messages: { th: { requestFailed: 'failed' } } };
      if (name === './read-cache') return load('read-cache');
      if (name === '@/services/user-api') return load('user-api');
      throw new Error(name);
    }, exports, (url, options) => new Promise((resolve, reject) => {
      const { action, args } = JSON.parse(options.body);
      calls.push({ url, action, args, reject, finish: (data, status = 200) => resolve(new Response(JSON.stringify({ data }), { status })) });
    }), browser, { now: () => time });
    return exports;
  }
  return { calls, advanceTime: value => { time += value; }, ...load('user-api'), profile: load('profile/get').getUserProfile };
}

test('identical concurrent reads share a request; search, hashtag and pagination remain distinct', async () => {
  const h = harness();
  const args = [20, 0, { search: 'hello' }];
  const a = h.userApi('posts', 'getPublicPosts', args);
  const b = h.userApi('posts', 'getPublicPosts', args);
  const c = h.userApi('posts', 'getPublicPosts', [20, 20, { search: 'hello' }]);
  const d = h.userApi('posts', 'getPublicPosts', [20, 0, { search: 'other' }]);
  const e = h.userApi('posts', 'getPublicPosts', [20, 0, { hashtag: 'hello' }]);
  assert.equal(h.calls.length, 4);
  h.calls.forEach((call, i) => call.finish([i]));
  assert.deepEqual(await Promise.all([a, b, c, d, e]), [[0], [0], [1], [2], [3]]);
});

test('profile callers share cached data and overlapping forced refreshes', async () => {
  const h = harness();
  const initial = h.profile('user'); h.calls[0].finish({ id: 'user', username: 'first' }); await initial;
  assert.equal((await h.profile('user')).username, 'first');
  assert.equal(h.calls.length, 1);
  const a = h.profile('user', true); const b = h.profile('user', true); const c = h.profile('user');
  assert.equal(h.calls.length, 2);
  h.calls[1].finish({ id: 'user', username: 'fresh' });
  for (const value of await Promise.all([a, b, c])) assert.equal(value.username, 'fresh');
});

test('expired profile and unread data are fetched again', async () => {
  const h = harness();
  const profile = h.profile('user'); h.calls[0].finish({ id: 'user' }); await profile;
  const unread = h.userApiRead('messages', 'getUnreadCount', ['user'], 15000); h.calls[1].finish(1); await unread;
  h.advanceTime(15000);
  const nextUnread = h.userApiRead('messages', 'getUnreadCount', ['user'], 15000);
  await h.profile('user'); assert.equal(h.calls.length, 3); h.calls[2].finish(0); await nextUnread;
  h.advanceTime(45000);
  const nextProfile = h.profile('user'); assert.equal(h.calls.length, 4); h.calls[3].finish({ id: 'user' }); await nextProfile;
});

test('server requests do not share a browser cache or pending requests', async () => {
  const h = harness({ server: true });
  const a = h.profile('user'); const b = h.profile('user');
  assert.equal(h.calls.length, 2); h.calls.forEach(call => call.finish({ id: 'user' })); await Promise.all([a, b]);
  const c = h.profile('user'); assert.equal(h.calls.length, 3); h.calls[2].finish({ id: 'user' }); await c;
});

test('failed and aborted reads release their pending entry for retry', async () => {
  for (const failure of ['http', 'abort']) {
    const h = harness();
    const a = h.userApi('ads', 'getActiveAds', []); const b = h.userApi('ads', 'getActiveAds', []);
    const rejected = Promise.all([assert.rejects(a), assert.rejects(b)]);
    if (failure === 'http') h.calls[0].finish(null, 500);
    else h.calls[0].reject(new DOMException('Timed out', 'TimeoutError'));
    await rejected;
    const retry = h.userApi('ads', 'getActiveAds', []);
    assert.equal(h.calls.length, 2); h.calls[1].finish([]); await retry;
  }
});

test('writes, including getOrCreateDirectChat, are never deduplicated', async () => {
  for (const action of ['sendMessage', 'getOrCreateDirectChat']) {
    const h = harness();
    const a = h.userApi('messages', action, ['same']); const b = h.userApi('messages', action, ['same']);
    assert.equal(h.calls.length, 2);
    h.calls.forEach(call => call.finish(true)); await Promise.all([a, b]);
    assert.throws(() => h.userApiRead('messages', action, []), /Not a read/);
  }
});

test('a read started before a profile write resolves to fresh data without duplicating the replacement', async () => {
  const h = harness();
  const old = h.profile('user');
  const write = h.userApi('profile', 'updateUserProfile', ['user', { username: 'fresh' }]);
  h.calls[1].finish(true); await write;
  const fresh = h.profile('user', true);
  h.calls[0].finish({ id: 'user', username: 'stale' });
  await new Promise(resolve => setImmediate(resolve));
  const overlapping = h.profile('user', true);
  assert.equal(h.calls.length, 3);
  h.calls[2].finish({ id: 'user', username: 'fresh' });
  for (const value of await Promise.all([old, fresh, overlapping])) assert.equal(value.username, 'fresh');
  assert.equal((await h.profile('user')).username, 'fresh');
});

test('reads during a write are refreshed again when the write completes', async () => {
  const h = harness();
  const write = h.userApi('profile', 'updateUserProfile', ['user', {}]);
  const during = h.profile('user'); h.calls[1].finish({ id: 'user', username: 'during' }); await during;
  h.calls[0].finish(true); await write;
  const after = h.profile('user'); assert.equal(h.calls.length, 3);
  h.calls[2].finish({ id: 'user', username: 'after' }); assert.equal((await after).username, 'after');
});

test('session changes discard caches and reject old reads without retrying under a new identity', async () => {
  const h = harness(); h.setUserApiSession('first');
  const cached = h.profile('user'); h.calls[0].finish({ id: 'user' }); await cached;
  const old = h.userApiRead('messages', 'getUnreadCount', ['user'], 15000);
  const rejected = assert.rejects(old, /Session changed/);
  h.setUserApiSession('second');
  const fresh = h.profile('user'); assert.equal(h.calls.length, 3);
  h.calls[1].finish(42); await rejected;
  assert.equal(h.calls.length, 3);
  h.calls[2].finish({ id: 'user', username: 'second' }); assert.equal((await fresh).username, 'second');
});

test('read receipts invalidate unread data while preserving a pending message poll', async () => {
  const h = harness();
  const unread = h.userApiRead('messages', 'getUnreadCount', ['user'], 15000);
  h.calls[0].finish(5); await unread;
  const poll = h.userApi('messages', 'getMessageUpdates', ['chat', {}]);
  const receipt = h.userApi('messages', 'markMessagesAsRead', ['chat', 'user']);
  h.calls[2].finish(true); await receipt;
  const samePoll = h.userApi('messages', 'getMessageUpdates', ['chat', {}]);
  const freshUnread = h.userApiRead('messages', 'getUnreadCount', ['user'], 15000);
  assert.equal(h.calls.length, 4);
  h.calls[1].finish([]); h.calls[3].finish(0);
  assert.deepEqual(await Promise.all([poll, samePoll, freshUnread]), [[], [], 0]);
});

test('typing writes refresh typing reads without restarting message polls', async () => {
  const h = harness();
  const poll = h.userApi('messages', 'getMessageUpdates', ['chat', {}]);
  const typing = h.userApiRead('messages', 'getTyping', ['chat'], 15000); h.calls[1].finish([]); await typing;
  const write = h.userApi('messages', 'sendTypingIndicator', ['chat', 'user', 'name', true]);
  h.calls[2].finish(true); await write;
  const freshTyping = h.userApiRead('messages', 'getTyping', ['chat'], 15000);
  const samePoll = h.userApi('messages', 'getMessageUpdates', ['chat', {}]);
  assert.equal(h.calls.length, 4); h.calls[0].finish([]); h.calls[3].finish(['user']);
  assert.deepEqual(await Promise.all([poll, samePoll, freshTyping]), [[], [], ['user']]);
});

test('the Next proxy skips API authentication while retaining protected page matching', () => {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
  const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server');
  const source = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8');
  const matcher = source.match(/"(\/\(\(\?!api[^\n]+)"/)[1].replaceAll('\\\\', '\\');
  const config = { matcher: [matcher] };
  for (const url of ['/api', '/api/auth/session', '/api/data/posts', '/_next/static/file.js']) assert.equal(unstable_doesMiddlewareMatch({ config, url }), false, url);
  for (const url of ['/feed', '/profile/edit', '/inbox/chat', '/admin/users', '/apiculture']) assert.equal(unstable_doesMiddlewareMatch({ config, url }), true, url);
});
