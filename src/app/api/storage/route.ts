import { NextResponse } from 'next/server';
import { supabase } from '@/server/supabase';
import { AccessError, apiError, requireChat, requireCommunity, requireSameOrigin, requireUser, requireWritable } from '@/server/access';
import { list, object, scopedKey, uuid } from '@/server/validation';
import { getPublicStorageUrl } from '@/services/supabase/storage';

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser(); requireWritable(actor);
    if (Number(request.headers.get('content-length')) > 11 * 1024 * 1024) throw new AccessError(413, 'File too large');
    const form = await request.formData();
    const file = form.get('file'); const kind = form.get('kind');
    if (!(file instanceof File) || !extensions[file.type] || !file.size || file.size > (kind === 'profile' ? 5 : 10) * 1024 * 1024) throw new AccessError(400, 'Invalid file');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ascii = new TextDecoder('latin1').decode(bytes.slice(0, 16));
    const valid = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === 'image/png' ? bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
      : file.type === 'image/gif' ? /^GIF8[79]a/.test(ascii)
      : file.type === 'image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
      : file.type === 'video/webm' ? bytes.slice(0, 4).join(',') === '26,69,223,163'
      : ascii.slice(4, 8) === 'ftyp';
    if (!valid) throw new AccessError(400, 'Invalid file content');
    const bucket = 'dating'; let key: string; let publicUrl: string;
    if (kind === 'profile') {
      if (!file.type.startsWith('image/')) throw new AccessError(400, 'Invalid image');
      key = scopedKey(form.get('key'), `users/${actor.id}/`);
      publicUrl = getPublicStorageUrl(key)!;
    } else if (kind === 'post') {
      requireCommunity(actor);
      if (!file.type.startsWith('image/')) throw new AccessError(400, 'Invalid image');
      key = `posts/users/${actor.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      publicUrl = getPublicStorageUrl(key)!;
    } else if (kind === 'chat') {
      const chatId = uuid(form.get('chatId')); await requireChat(actor, chatId);
      key = `posts/users/${actor.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      publicUrl = getPublicStorageUrl(key)!;
    } else throw new AccessError(400, 'Invalid upload');
    const { error } = await supabase.storage.from(bucket).upload(key, bytes, { contentType: file.type, upsert: false, cacheControl: '3600' });
    if (error) throw error;
    return NextResponse.json({ path: key, url: publicUrl, publicUrl });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser(); requireWritable(actor);
    const body = object(await request.json());
    if (body.bucket !== 'dating' && body.bucket !== 'chat-media') throw new AccessError(400, 'Invalid bucket');
    const bucket = body.bucket;
    const keys = list(body.keys, value => {
      if (bucket === 'dating') return scopedKey(value, `users/${actor.id}/`);
      const key = scopedKey(value, 'chats/');
      const parts = key.split('/');
      if (parts[2] !== 'users' || parts[3] !== actor.id) throw new AccessError(403, 'Forbidden');
      return key;
    }, 5);
    if (bucket === 'chat-media') for (const key of keys) await requireChat(actor, uuid(key.split('/')[1]));
    const { error } = await supabase.storage.from(bucket).remove(keys);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
