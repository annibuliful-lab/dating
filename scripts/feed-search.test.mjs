import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const hashtagExports = {};
new Function('exports', ts.transpileModule(
  readFileSync(new URL('../src/shared/hashtags.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText)(hashtagExports);

const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/server/data/posts.ts', import.meta.url), 'utf8'),
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
    if (name === 'server-only') return {};
    if (name === '@/shared/hashtags') return hashtagExports;
    assert.equal(name, '@/server/supabase');
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

const componentSource = ts.transpileModule(
  readFileSync(new URL('../src/components/post/PostContentText.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const componentExports = {};
const componentRequire = createRequire(import.meta.url);
const routeExports = {};
new Function('require', 'exports', ts.transpileModule(
  readFileSync(new URL('../src/app/feed/hashtag/[tag]/page.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText)((name) => {
  if (name === '@/shared/hashtags') return hashtagExports;
  if (name === '@/components/feed/FeedContent') return { default: () => null };
  if (name === 'next/navigation') return { notFound: () => { throw new Error('404'); } };
  return componentRequire(name);
}, routeExports);

test('hashtag routes decode Thai URL parameters before validation', async () => {
  for (const tag of ['ชายเดี่ยว', 'หาเพื่อน', 'FUN']) {
    for (const param of [tag, encodeURIComponent(tag)]) {
      const page = await routeExports.default({ params: Promise.resolve({ tag: param }) });
      assert.equal(page.props.hashtag, tag.toLowerCase());
    }
  }
  for (const tag of ['%E0%B8', '%ZZ', 'fun%2Fother', 'fun%252Fother', 'fun%20other']) {
    await assert.rejects(routeExports.default({ params: Promise.resolve({ tag }) }), /404/);
  }
});

const { MantineProvider } = componentRequire('@mantine/core');
new Function('require', 'exports', componentSource)(
  (name) => name === '@/shared/hashtags' ? hashtagExports : componentRequire(name), componentExports,
);

function renderPost(text, highlight, props = {}) {
  return renderToStaticMarkup(createElement(MantineProvider, { forceColorScheme: 'dark' },
    createElement(componentExports.PostContentText, { text, highlight, ...props })));
}

const markedText = (html) => Array.from(html.matchAll(/<mark\b[^>]*>(.*?)<\/mark>/gs), (match) => match[1]);

test('highlights every case-insensitive match, preserving original case and Thai text', () => {
  assert.deepEqual(markedText(renderPost('Hello HELLO hello', ' hello ')), ['Hello', 'HELLO', 'hello']);
  assert.deepEqual(markedText(renderPost('หาเพื่อนใหม่ มาเป็นเพื่อนกัน', 'เพื่อน')), ['เพื่อน', 'เพื่อน']);
});

test('highlight search treats regex punctuation literally', () => {
  const term = '.*+?^${}()|[]\\%_';
  assert.deepEqual(markedText(renderPost(`Before ${term} after ${term}`, term)), [term, term]);
});

test('highlights inside links without changing link targets or trailing punctuation', () => {
  const html = renderPost('Example https://example.com/path, and www.EXAMPLE.com.', 'example');
  assert.deepEqual(markedText(html), ['Example', 'example', 'EXAMPLE']);
  assert.match(html, /href="https:\/\/example\.com\/path"/);
  assert.match(html, /href="https:\/\/www\.EXAMPLE\.com"/);
  assert.match(html, /<\/a>, and /);
  assert.match(html, /<\/a>\./);
});

test('a search phrase can highlight across a link boundary', () => {
  const html = renderPost('See https://example.com.', 'See https://example.com.');
  assert.deepEqual(markedText(html), ['See ', 'https://example.com', '.']);
  assert.match(html, /href="https:\/\/example\.com"/);
});

test('cleared, missing, and unmatched searches keep normal text and links', () => {
  for (const query of [undefined, '', '   ', 'missing']) {
    const html = renderPost('Hello www.example.com!', query);
    assert.deepEqual(markedText(html), []);
    assert.match(html, /Hello <a /);
    assert.match(html, /href="https:\/\/www\.example\.com"/);
    assert.match(html, />www\.example\.com<\/a>!/);
  }
});

test('post text and search terms cannot introduce HTML elements', () => {
  const html = renderPost('<img src=x onerror=alert(1)>', '<img');
  assert.deepEqual(markedText(html), ['&lt;img']);
  assert.doesNotMatch(html, /<img\b/);
  assert.match(html, /&gt;/);
});

test('recognizes Thai, English, numbers and underscores while ignoring URL fragments and embedded hashes', () => {
  const text = '#หาเพื่อน (#Bangkok), #party_2026 #123 #FUN! x#hidden ##hidden https://example.com/#fragment www.site.com/#fragment';
  const tokens = hashtagExports.getPostTextTokens(text);
  assert.deepEqual(tokens.filter((token) => token.type === 'hashtag').map((token) => token.text),
    ['#หาเพื่อน', '#Bangkok', '#party_2026', '#123', '#FUN']);
  assert.equal(tokens.filter((token) => token.type === 'url').length, 2);
  assert.ok(tokens.every((token) => text.slice(token.start, token.end) === token.text));
  assert.equal(hashtagExports.normalizeHashtag('Bangkok'), 'bangkok');
  for (const tag of ['', 'two words', '#fun', 'fun!', 'fun/other']) {
    assert.equal(hashtagExports.normalizeHashtag(tag), null);
  }
});

test('feed hashtags link to dedicated pages and only exact tags are highlighted', () => {
  const html = renderPost('#Fun #funny #FUN #หาเพื่อน https://site.com/#fun', undefined,
    { hashtagLinks: true, highlightHashtag: 'fun' });
  assert.deepEqual(markedText(html), ['#Fun', '#FUN']);
  assert.equal((html.match(/href="\/feed\/hashtag\/fun"/g) || []).length, 2);
  assert.match(html, /href="\/feed\/hashtag\/funny"/);
  assert.ok(html.includes(`href="/feed/hashtag/${encodeURIComponent('หาเพื่อน')}"`));
  assert.match(html, /href="https:\/\/site\.com\/#fun"[^>]*>https:\/\/site\.com\/#fun<\/a>/);
  assert.doesNotMatch(renderPost('#fun'), /href="\/feed\/hashtag\//);
});

test('hashtag pagination counts exact matches, excluding prefixes and URL fragments', async () => {
  const { service, requests } = harness();
  const pending = service.getPublicPosts(2, 1, { hashtag: 'FUN' });
  await tick();
  const params = requests[0].url.searchParams;
  assert.equal(params.get('select'), 'id,content');
  assert.equal(params.get('content->>text'), 'imatch.#fun');
  assert.equal(params.get('visibility'), 'eq.PUBLIC');
  assert.ok(params.get('createdAt').startsWith('gte.'));
  requests[0].respond([
    { id: 'first', content: { text: '#FUN' } },
    { id: 'prefix', content: { text: '#funny' } },
    { id: 'url', content: { text: 'https://site.com/#fun' } },
    { id: 'second', content: { text: '#fun' } },
    { id: 'longer', content: { text: '#fun_2' } },
    { id: 'third', content: { text: '(#Fun).' } },
  ]);
  await tick();
  assert.equal(requests[1].url.searchParams.get('id'), 'in.(second,third)');
  assert.equal(requests[1].url.searchParams.has('offset'), false);
  requests[1].respond([post('second'), post('third')]);
  assert.deepEqual((await pending).map((row) => row.id), ['second', 'third']);
  await service.getPublicPosts(2, 1, { hashtag: 'fun' });
  assert.equal(requests.length, 2);
});

test('continues past full batches containing no exact hashtag matches', async () => {
  const { service, requests } = harness();
  const pending = service.getPublicPosts(2, 0, { hashtag: 'fun' });
  await tick();
  requests[0].respond(Array.from({ length: 100 }, (_, index) => ({
    id: `prefix-${index}`, content: { text: '#funny' },
  })));
  await tick();
  assert.equal(requests[1].url.searchParams.get('offset'), '100');
  requests[1].respond([{ id: 'exact', content: { text: '#fun' } }]);
  await tick();
  assert.equal(requests[2].url.searchParams.get('id'), 'in.(exact)');
  requests[2].respond([post('exact')]);
  assert.equal((await pending)[0].id, 'exact');
});

test('invalid and empty hashtag results do not fetch unrelated posts', async () => {
  const { service, requests } = harness();
  await assert.rejects(service.getPublicPosts(20, 0, { hashtag: 'fun|other' }), /Invalid hashtag/);
  assert.equal(requests.length, 0);
  const pending = service.getPublicPosts(20, 0, { hashtag: 'fun' });
  await tick();
  requests[0].respond([{ id: 'url', content: { text: 'www.site.com/#fun' } }]);
  assert.deepEqual(await pending, []);
  assert.equal(requests.length, 1);
});
