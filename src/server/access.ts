import 'server-only';
import { auth } from '@/auth';
import { supabase } from './supabase';
import { NextResponse } from 'next/server';

export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Actor = { id: string; status: string; role: string; isVerified: boolean };

export async function requireUser(): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) throw new AccessError(401, 'Unauthorized');
  const { data, error } = await supabase.from('User')
    .select('id, status, role, isVerified').eq('id', session.user.id).single();
  if (error || !data) throw new AccessError(401, 'Unauthorized');
  return data;
}

export function requireCommunity(actor: Actor, feedRead = false) {
  if (feedRead && actor.status === 'SUSPENDED') return;
  if (actor.status === 'SUSPENDED' || (!actor.isVerified && actor.role !== 'ADMIN')) {
    throw new AccessError(403, 'Forbidden');
  }
}

export function requireWritable(actor: Actor) {
  if (actor.status === 'SUSPENDED') throw new AccessError(403, 'Forbidden');
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AccessError(403, 'Forbidden');
  }
}

export function apiError(error: unknown) {
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'Already exists' }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  console.error('User API request failed');
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

export async function requireChat(actor: Actor, chatId: string, admin = false) {
  requireCommunity(actor);
  const { data, error } = await supabase.from('ChatParticipant')
    .select('id, isAdmin').eq('chatId', chatId).eq('userId', actor.id).maybeSingle();
  if (error) throw error;
  if (!data || (admin && !data.isAdmin)) throw new AccessError(403, 'Forbidden');
  return data;
}
