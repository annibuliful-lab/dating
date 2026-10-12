import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(new URL('./migrate-chat-media.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const project = 'https://storage.test';
const publicPrefix = `${project}/storage/v1/object/public/dating/`;
const chatId = '11111111-1111-4111-8111-111111111111';
const senderId = '22222222-2222-4222-8222-222222222222';

function harness(url = publicPrefix + 'messages/old.png') {
  const state = { messages: [{ id: 'message-one', chatId, senderId, imageUrl: url, videoUrl: null }], posts: [], files: new Map([['dating:messages/old.png', new Blob(['image'], { type: 'image/png' })]]), backups: new Map(), mutations: [] };
  const supabase = {
    from(table) {
      let update, filters = [];
      const query = {
        select() { return query; }, order() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        update(value) { update = value; return query; },
        range(from, to) { return Promise.resolve({ data: structuredClone((table === 'Message' ? state.messages : state.posts).slice(from, to + 1)), error: null }); },
        then(resolve) {
          const matching = state.messages.filter(row => filters.every(([key, value]) => row[key] === value));
          for (const row of matching) Object.assign(row, update);
          state.mutations.push('message update'); resolve({ data: matching.map(row => ({ id: row.id })), error: null });
        },
      }; return query;
    },
    storage: { from(bucket) { return {
      list(prefix, { offset, limit }) {
        const data = [...state.files.keys()].filter(key => key.startsWith(`${bucket}:${prefix}/`)).map(key => ({ id: key, name: key.slice(`${bucket}:${prefix}/`.length) })).slice(offset, offset + limit);
        return Promise.resolve({ data, error: null });
      },
      download(key) { return Promise.resolve({ data: state.files.get(`${bucket}:${key}`), error: state.files.has(`${bucket}:${key}`) ? null : { message: 'missing' } }); },
      upload(key, blob) { state.files.set(`${bucket}:${key}`, blob); state.mutations.push(`upload ${bucket}`); return Promise.resolve({ error: null }); },
      remove(keys) { keys.forEach(key => state.files.delete(`${bucket}:${key}`)); state.mutations.push('remove public'); return Promise.resolve({ error: null }); },
    }; } },
  };
  async function run(args = []) {
    const fakeProcess = { argv: ['node', 'script', ...args], env: { SUPABASE_SECRET_KEY: 'test-secret', NEXT_PUBLIC_SUPABASE_URL: project }, loadEnvFile() {}, exit(code) { const error = new Error('exit'); error.exitCode = code; throw error; } };
    const existsSync = path => state.backups.has(path);
    const writeFileSync = (path, data, options) => { if (options.flag === 'wx' && state.backups.has(path)) throw new Error('exists'); state.backups.set(path, data); };
    try {
      await new (Object.getPrototypeOf(async function(){}).constructor)('createClient', 'existsSync', 'mkdirSync', 'readFileSync', 'writeFileSync', 'resolve', 'join', 'process', 'console', source)(() => supabase, existsSync, () => {}, path => state.backups.get(path), writeFileSync, value => value, join, fakeProcess, { log() {} });
    } catch (error) { if (error.exitCode !== 0) throw error; }
  }
  return { state, run };
}

test('dry run changes no rows, objects, or backup files', async () => {
  const h = harness(); await h.run(); assert.equal(h.state.mutations.length, 0); assert.equal(h.state.backups.size, 0);
});
test('rollback preparation writes only private metadata', async () => {
  const h = harness(); await h.run(['--prepare-rollback', '--backup-dir', '/backup']);
  assert.equal(h.state.mutations.length, 0); assert.ok(h.state.backups.has('/backup/chat-media-rollback.json'));
});
test('migration backs up files, changes URLs, resumes, and rollback restores legacy compatibility', async () => {
  const h = harness(); await h.run(['--apply', '--backup-dir', '/backup']);
  assert.ok(h.state.messages[0].imageUrl.startsWith(`/api/chat/${chatId}/media?`));
  assert.equal(h.state.files.has('dating:messages/old.png'), false);
  assert.ok(h.state.files.has('chat-media:archive/messages/old.png'));
  assert.ok(h.state.mutations.indexOf('remove public') > h.state.mutations.indexOf('message update'));
  const backup = h.state.backups.get('/backup/chat-media-rollback.json');
  await h.run(['--apply', '--backup-dir', '/backup']);
  assert.equal(h.state.backups.get('/backup/chat-media-rollback.json'), backup);
  await h.run(['--rollback', '--backup-dir', '/backup']);
  assert.equal(h.state.messages[0].imageUrl, publicPrefix + 'messages/old.png');
  assert.ok(h.state.files.has('dating:messages/old.png'));
});
test('rollback during transition also restores new private attachment URLs', async () => {
  const path = `chats/${chatId}/users/${senderId}/new.png`;
  const h = harness(`/api/chat/${chatId}/media?path=${encodeURIComponent(path)}`);
  h.state.files.set(`chat-media:${path}`, new Blob(['new'], { type: 'image/png' }));
  await h.run(['--prepare-rollback', '--backup-dir', '/backup']);
  await h.run(['--rollback', '--backup-dir', '/backup']);
  assert.ok(h.state.messages[0].imageUrl.startsWith(publicPrefix + 'messages/rollback/'));
  assert.ok(h.state.files.has(`chat-media:${path}`));
});
test('unsupported URLs, shared post media, and missing backup paths stop before mutation', async () => {
  const unsupported = harness('https://evil.test/file');
  await assert.rejects(unsupported.run(['--apply', '--backup-dir', '/backup']), /Unsupported/);
  assert.equal(unsupported.state.mutations.length, 0);
  const shared = harness(); shared.state.posts = [{ imageUrl: [publicPrefix + 'messages/old.png'] }];
  await assert.rejects(shared.run(['--apply', '--backup-dir', '/backup']), /shared/);
  assert.equal(shared.state.mutations.length, 0);
  await assert.rejects(harness().run(['--apply']), /backup-dir/);
});
