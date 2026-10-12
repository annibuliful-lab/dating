import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

if (existsSync('.env')) process.loadEnvFile('.env');
const apply = process.argv.includes('--apply');
const rollback = process.argv.includes('--rollback');
const prepare = process.argv.includes('--prepare-rollback');
const backupArg = process.argv.indexOf('--backup-dir');
const backupDir = backupArg >= 0 && process.argv[backupArg + 1] ? resolve(process.argv[backupArg + 1]) : null;
if ((apply || rollback || prepare) && (!backupDir || backupDir.includes('/public/'))) throw new Error('Provide --backup-dir pointing to a private directory');
if ([apply, rollback, prepare].filter(Boolean).length > 1) throw new Error('Choose apply or rollback');
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!key || !project) throw new Error('Configure the server-only key and project URL');
const supabase = createClient(project, key, { auth: { persistSession: false, autoRefreshToken: false } });
const publicPrefix = new URL(project).origin + '/storage/v1/object/public/dating/';

async function rows(table, selection) {
  const result = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(selection).order('id').range(offset, offset + 499);
    if (error) throw new Error(`${table} lookup failed (${error.code || 'unknown'})`);
    result.push(...data);
    if (data.length < 500) return result;
  }
}
async function copy(sourceKey, targetKey) {
  const download = await supabase.storage.from('dating').download(sourceKey);
  if (download.error) throw new Error('Legacy media download failed');
  const upload = await supabase.storage.from('chat-media').upload(targetKey, download.data, { upsert: true, contentType: download.data.type });
  if (upload.error) throw new Error('Private media upload failed');
}
async function files(prefix) {
  const result = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from('dating').list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error('Legacy media listing failed');
    for (const item of data) {
      if (item.id) result.push(`${prefix}/${item.name}`);
      else result.push(...await files(`${prefix}/${item.name}`));
    }
    if (data.length < 100) return result;
  }
}

if (rollback) {
  const backup = JSON.parse(readFileSync(join(backupDir, 'chat-media-rollback.json'), 'utf8'));
  if (backup.project !== project) throw new Error('Rollback snapshot belongs to a different project');
  for (const sourceKey of backup.legacyKeys) {
    const archived = await supabase.storage.from('chat-media').download(`archive/${sourceKey}`);
    if (archived.error) {
      const original = await supabase.storage.from('dating').download(sourceKey);
      if (original.error) throw new Error('A legacy object is missing in both buckets; stop rollback');
      continue;
    }
    const upload = await supabase.storage.from('dating').upload(sourceKey, archived.data, { upsert: true, contentType: archived.data.type });
    if (upload.error) throw new Error('Legacy object restore failed');
  }
  const current = await rows('Message', 'id, chatId, senderId, imageUrl, videoUrl');
  // Preserve a record of private URLs before restoring compatibility with the old app.
  writeFileSync(join(backupDir, `private-media-before-rollback-${Date.now()}.json`), JSON.stringify({ project, messages: current }), { mode: 0o600, flag: 'wx' });
  const originals = new Map(backup.references.map(ref => [`${ref.message.id}:${ref.field}`, ref]));
  for (const message of current) for (const field of ['imageUrl', 'videoUrl']) {
    const url = message[field];
    if (!url?.startsWith(`/api/chat/${message.chatId}/media?`)) continue;
    const sourceKey = new URL(url, 'https://app.invalid').searchParams.get('path');
    if (!sourceKey?.startsWith(`chats/${message.chatId}/users/${message.senderId}/`) || sourceKey.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unexpected private media path; stop rollback');
    const original = originals.get(`${message.id}:${field}`);
    const extension = sourceKey.split('.').at(-1)?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'bin';
    const targetKey = original?.sourceKey || `messages/rollback/${message.id}-${field}.${extension}`;
    const download = await supabase.storage.from('chat-media').download(sourceKey);
    if (download.error) throw new Error('Private media restore download failed');
    const upload = await supabase.storage.from('dating').upload(targetKey, download.data, { upsert: true, contentType: download.data.type });
    if (upload.error) throw new Error('Public compatibility media restore failed');
    const oldUrl = original?.url || publicPrefix + targetKey;
    const result = await supabase.from('Message').update({ [field]: oldUrl }).eq('id', message.id).eq(field, url).select('id');
    if (result.error || result.data.length !== 1) throw new Error('Message changed during rollback; retry in maintenance mode');
  }
  console.log('Media rollback complete; restored attachments are public again.');
  process.exit(0);
}

const messages = await rows('Message', 'id, chatId, senderId, imageUrl, videoUrl');
const posts = await rows('Post', 'imageUrl');
const postUrls = new Set(posts.flatMap(post => Array.isArray(post.imageUrl) ? post.imageUrl : typeof post.imageUrl === 'string' ? [post.imageUrl] : []));
const legacyKeys = await files('messages');
const references = [];
for (const message of messages) {
  for (const field of ['imageUrl', 'videoUrl']) {
    const url = message[field];
    if (!url || url.startsWith(`/api/chat/${message.chatId}/media?`)) continue;
    if (!url.startsWith(publicPrefix)) throw new Error(`Unsupported legacy media in message ${message.id}; resolve it before cutover`);
    const sourceKey = decodeURIComponent(url.slice(publicPrefix.length));
    if (!sourceKey.startsWith('messages/') || sourceKey.split('/').some(part => part === '..' || part === '.' || !part) || /[?#\\\x00-\x1f]/.test(sourceKey)) throw new Error(`Unsupported legacy path in message ${message.id}`);
    if (postUrls.has(url)) throw new Error(`Media shared with a public post in message ${message.id}; resolve it before cutover`);
    references.push({ message, field, url, sourceKey });
  }
}
for (const sourceKey of legacyKeys) if (postUrls.has(publicPrefix + sourceKey.split('/').map(encodeURIComponent).join('/'))) throw new Error('A public post references a legacy messages object; resolve it before cutover');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', attachments: references.length, legacyObjects: legacyKeys.length }));
if (apply || prepare) {
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupFile = join(backupDir, 'chat-media-rollback.json');
  if (existsSync(backupFile)) {
    const previous = JSON.parse(readFileSync(backupFile, 'utf8'));
    if (previous.project !== project) throw new Error('Use a backup directory for this project');
    const known = new Set(previous.references.map(ref => `${ref.message.id}:${ref.field}`));
    previous.references.push(...references.filter(ref => !known.has(`${ref.message.id}:${ref.field}`)));
    previous.legacyKeys = [...new Set([...previous.legacyKeys, ...legacyKeys])];
    writeFileSync(backupFile, JSON.stringify(previous), { mode: 0o600 });
  } else writeFileSync(backupFile, JSON.stringify({ project, references, legacyKeys }), { mode: 0o600, flag: 'wx' });
}
if (prepare) { console.log('Rollback metadata prepared; files and database rows were not changed.'); process.exit(0); }
if (apply) {
  // Run during a maintenance window: stop old clients from uploading public chat files.
  for (const { message, field, url, sourceKey } of references) {
    const extension = sourceKey.split('.').at(-1)?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'bin';
    const targetKey = `chats/${message.chatId}/users/${message.senderId}/legacy-${message.id}-${field}.${extension}`;
    await copy(sourceKey, targetKey);
    const { data, error } = await supabase.from('Message')
      .update({ [field]: `/api/chat/${message.chatId}/media?path=${encodeURIComponent(targetKey)}` })
      .eq('id', message.id).eq(field, url).select('id');
    if (error || data.length !== 1) throw new Error(`Message ${message.id} changed; retry migration before deleting legacy files`);
  }
  const remaining = await rows('Message', 'id, imageUrl, videoUrl');
  if (remaining.some(message => [message.imageUrl, message.videoUrl].some(url => url?.startsWith(publicPrefix)))) throw new Error('Public chat attachments remain; old files were preserved');
  // Keep a private copy of abandoned uploads rather than discarding user data.
  for (const sourceKey of legacyKeys) {
    await copy(sourceKey, `archive/${sourceKey}`);
    const { error } = await supabase.storage.from('dating').remove([sourceKey]);
    if (error) throw new Error('Legacy media removal failed; rerun before cutover');
  }
  console.log('Chat media migration complete');
}
