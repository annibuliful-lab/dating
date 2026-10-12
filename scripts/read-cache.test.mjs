import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function harness() {
  let now = 0;
  const timers = new Map();
  const exports = {};
  const output = ts.transpileModule(readFileSync(new URL('../src/server/read-cache.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', 'Date', 'setTimeout', 'clearTimeout', output)(() => ({}), exports, { now: () => now },
    (run, delay) => {
      const handle = { unref() {} };
      timers.set(handle, { run, at: now + delay });
      return handle;
    }, handle => timers.delete(handle));
  return { cache: new exports.ServerReadCache(30000), timers, advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; timers.delete(next[0]); next[1].run();
    }
    now = end;
  } };
}

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('server reads deduplicate refreshes and older completions cannot overwrite or remove a newer request', async () => {
  for (const newerFirst of [true, false]) {
    const { cache } = harness();
    const old = deferred(); const fresh = deferred();
    const a = cache.read('feed', () => old.promise);
    assert.equal(cache.read('feed', () => assert.fail('duplicate')), a);
    const b = cache.read('feed', () => fresh.promise, true);
    assert.equal(cache.read('feed', () => assert.fail('duplicate forced'), true), b);
    if (newerFirst) { fresh.resolve('fresh'); await b; old.resolve('old'); await a; }
    else {
      old.resolve('old'); await a;
      assert.equal(cache.read('feed', () => assert.fail('lost pending')), b);
      fresh.resolve('fresh'); await b;
    }
    assert.equal(await cache.read('feed', () => assert.fail('lost cache')), 'fresh');
  }
});

test('server cache expires idle entries, limits entry count and releases its cleanup timer', async () => {
  const h = harness();
  for (let i = 0; i < 150; i++) await h.cache.read(String(i), async () => i);
  assert.equal(h.cache.cached.size, 100);
  assert.equal(h.timers.size, 1);
  let loads = 0;
  assert.equal(await h.cache.read('0', async () => { loads++; return 0; }), 0);
  assert.equal(loads, 1);
  h.advance(30000);
  assert.equal(h.cache.cached.size, 0);
  assert.equal(h.cache.bytes, 0);
  assert.equal(h.timers.size, 0);
});

test('server cache bounds serialized payload bytes and returns oversized results without retaining them', async () => {
  const { cache } = harness();
  const payload = 'ก'.repeat(700000);
  for (const key of ['a', 'b', 'c']) await cache.read(key, async () => payload);
  assert.equal(cache.cached.size, 2);
  assert.ok(cache.bytes <= 5 * 1024 * 1024);
  let loads = 0;
  const large = 'x'.repeat(6 * 1024 * 1024);
  for (let i = 0; i < 2; i++) assert.equal(await cache.read('large', async () => { loads++; return large; }), large);
  assert.equal(loads, 2);
  assert.equal(cache.cached.has('large'), false);
});

test('server cache clears do not let in-flight data repopulate invalidated entries', async () => {
  const { cache } = harness(); const old = deferred();
  const request = cache.read('feed', () => old.promise);
  cache.clear();
  assert.equal(await cache.read('feed', async () => 'after write'), 'after write');
  old.resolve('before write'); await request;
  assert.equal(await cache.read('feed', () => assert.fail('lost fresh entry')), 'after write');
});

test('server failures and timeouts release pending requests, abort queries, and allow retry', async () => {
  const h = harness();
  await assert.rejects(h.cache.read('read', async () => { throw new Error('database failed'); }), /database failed/);
  let signal;
  const request = h.cache.read('read', value => { signal = value; return new Promise(() => {}); });
  const rejected = assert.rejects(request, /timed out/);
  await Promise.resolve(); h.advance(15000); await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(h.cache.pending.size, 0);
  assert.equal(h.cache.active.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(await h.cache.read('read', async () => 'retry'), 'retry');
});

test('server pending capacity includes superseded and invalidated requests until they settle', async () => {
  const h = harness(); const rejected = [];
  for (let i = 0; i < 100; i++) {
    const request = h.cache.read('same', () => new Promise(() => {}), i % 2 === 0);
    rejected.push(assert.rejects(request, /timed out/));
    h.cache.clear();
  }
  assert.equal(h.cache.active.size, 100);
  await assert.rejects(h.cache.read('overflow', async () => 'overflow'), /capacity exceeded/);
  h.advance(15000); await Promise.all(rejected);
  assert.equal(h.cache.active.size, 0);
  assert.equal(await h.cache.read('recovered', async () => 'ok'), 'ok');
});
