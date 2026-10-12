import { NextResponse } from 'next/server';
import { supabase } from '@/server/supabase';
import { apiError, requireChat, requireUser } from '@/server/access';
import { scopedKey, uuid } from '@/server/validation';

export async function GET(request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const actor = await requireUser();
    const chatId = uuid((await params).chatId); await requireChat(actor, chatId);
    const key = scopedKey(new URL(request.url).searchParams.get('path'), `chats/${chatId}/`);
    const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(key, 60);
    if (error) throw error;
    return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return apiError(error); }
}
