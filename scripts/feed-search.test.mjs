import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';

const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/services/supabase/posts.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
);

function harness(timers = {}) {
  const requests = [];
  const supabase = createClient('https://feed-search.example', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url) => new Promise((resolve) => {
        requests.push({
          url: new URL(url),
          respond: (data, status = 200) => resolve(new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })),
        });
      }),
    },
  });
  const exports = {};
  const run = new Function('require', 'exports', 'setTimeout', 'clearTimeout', outputText);
  run((name) => {
    assert.equal(name, '@/client/supabase');
    return { supabase };
  }, exports, timers.setTimeout || setTimeout, timers.clearTimeout || clearTimeout);
  return { service: exports.postService, requests };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const post = (id) => ({ id, content: { text: id }, User: { id: 'author', verifiedBy: null } });

test('search filters JSON text before pagination and retains feed visibility/date/order', async () => {
  const { service, requests } = harness();
  const pending = service.getPublicPosts(20, 20, { search: '  หาเพื่อน 100%_\\  ' });
  await tick();
  const params = requests[0].url.searchParams;
  assert.equal(params.get('content->>text'), 'imatch.หาเพื่อน 100%_\\\\');
  assert.equal(params.get('visibility'), 'eq.PUBLIC');
  assert.equal(params.get('offset'), '20');
  assert.equal(params.get('limit'), '20');
  assert.equal(params.get('order'), 'createdAt.desc,id.desc');
  const cutoff = new Date(params.get('createdAt').slice(4));
  const expected = new Date();
  expected.setDate(expected.getDate() - 30);
  assert.ok(Math.abs(cutoff.getTime() - expected.getTime()) < 1000);
  requests[0].respond([post('matched')]);
  assert.equal((await pending)[0].id, 'matched');
});

test('regex operators and wildcard punctuation are searched literally', async () => {
  const { service, requests } = harness();
  const pending = service.getPublicPosts(20, 0, { search: '.*+?^${}()|[]\\%_' });
  await tick();
  assert.equal(requests[0].url.searchParams.get('content->>text'),
    'imatch.\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\%_');
  requests[0].respond([]);
  await pending;
});

test('deduplicates matching terms while keeping distinct searches and pages separate', async () => {
  const { service, requests } = harness();
  const first = service.getPublicPosts(20, 0, { search: 'Thai' });
  const duplicate = service.getPublicPosts(20, 0, { search: ' Thai ' });
  const other = service.getPublicPosts(20, 0, { search: 'English' });
  const nextPage = service.getPublicPosts(20, 20, { search: 'Thai' });
  await tick();
  assert.equal(requests.length, 3);
  requests[1].respond([post('english')]);
  requests[2].respond([post('page-two')]);
  requests[0].respond([post('thai')]);
  assert.equal((await first)[0].id, 'thai');
  assert.equal((await duplicate)[0].id, 'thai');
  assert.equal((await other)[0].id, 'english');
  assert.equal((await nextPage)[0].id, 'page-two');
  await service.getPublicPosts(20, 0, { search: 'Thai' });
  assert.equal(requests.length, 3);
  const cleared = service.getPublicPosts(20, 0, { search: '   ' });
  await tick();
  assert.equal(requests[3].url.searchParams.has('content->>text'), false);
  requests[3].respond([]);
  assert.deepEqual(await cleared, []);
});

test('an older request cannot clear a forced request from the pending queue', async () => {
  const { service, requests } = harness();
  const older = service.getPublicPosts(20, 0, { search: 'query' });
  const newer = service.getPublicPosts(20, 0, { search: 'query', force: true });
  await tick();
  requests[0].respond([post('older')]);
  await older;
  const duplicate = service.getPublicPosts(20, 0, { search: 'query' });
  await tick();
  assert.equal(requests.length, 2);
  requests[1].respond([post('newer')]);
  assert.equal((await newer)[0].id, 'newer');
  assert.equal((await duplicate)[0].id, 'newer');
});

test('a slow older request cannot overwrite the refreshed cache', async () => {
  const { service, requests } = harness();
  const older = service.getPublicPosts(20, 0, { search: 'query' });
  const newer = service.getPublicPosts(20, 0, { search: 'query', force: true });
  await tick();
  requests[1].respond([post('newer')]);
  await newer;
  requests[0].respond([post('older')]);
  await older;
  assert.equal((await service.getPublicPosts(20, 0, { search: 'query' }))[0].id, 'newer');
  assert.equal(requests.length, 2);
});

test('rejected and timed-out requests can be retried', async () => {
  let expire;
  const { service, requests } = harness({
    setTimeout: (callback) => { expire = callback; return 1; },
    clearTimeout: () => {},
  });
  const rejected = service.getPublicPosts(20, 0, { search: 'retry' });
  const rejection = assert.rejects(rejected, /database unavailable/);
  await tick();
  requests[0].respond({ message: 'database unavailable' }, 500);
  await rejection;
  const timedOut = service.getPublicPosts(20, 0, { search: 'retry' });
  const timeout = assert.rejects(timedOut, /timed out/);
  await tick();
  expire();
  await timeout;
  const retried = service.getPublicPosts(20, 0, { search: 'retry' });
  await tick();
  assert.equal(requests.length, 3);
  requests[2].respond([]);
  assert.deepEqual(await retried, []);
});
