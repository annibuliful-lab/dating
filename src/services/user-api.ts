import { messages } from '@/i18n/messages';
import { cachedRead, clearReadCache } from './read-cache';

const reads: Record<string, readonly string[]> = {
  profile: ['getUserProfile', 'getProfileImages'],
  posts: ['getPublicPosts', 'getPostsByUser', 'getPostById', 'getSavedPosts', 'getUserPostInteractions', 'getUserPostLike', 'getUserPostSave'],
  users: ['getUsersByIds', 'getActiveUsers', 'getUserById', 'getUserProfile', 'searchUsers', 'getUsersByAgeRange', 'getUsersWithPostCounts'],
  ads: ['getActiveAds'],
  messages: ['getMessageUpdates', 'getTyping', 'getChatMessages', 'getOlderMessages', 'getUserChats', 'getUnreadCount', 'getChatInfo', 'getChatSummary', 'getChatParticipants', 'getChatParticipant', 'getChatParticipantCount', 'isUserInChat', 'getMessage'],
};
let sessionScope = '';
let sessionVersion = 0;
const versions = new Map<string, number>();

export function setUserApiSession(scope: string) {
  if (scope === sessionScope) return;
  sessionScope = scope;
  sessionVersion++;
  versions.clear();
  clearReadCache();
}

export function userApiReadKey(domain: string, action: string, args: unknown[]) {
  const session = sessionVersion;
  return () => {
    if (session !== sessionVersion) throw new Error('Session changed');
    return JSON.stringify([session, versions.get(`${domain}:${action}`) || 0, domain, action, args]);
  };
}

export function invalidateUserApiReads(domain: string, actions = reads[domain] || []) {
  for (const action of actions) {
    const key = `${domain}:${action}`;
    versions.set(key, (versions.get(key) || 0) + 1);
  }
}

function invalidateMutation(domain: string, action: string) {
  if (domain === 'messages' && action === 'sendTypingIndicator') invalidateUserApiReads(domain, ['getTyping']);
  else if (domain === 'messages' && action === 'markMessagesAsRead') invalidateUserApiReads(domain, ['getUnreadCount', 'getUserChats']);
  else invalidateUserApiReads(domain);
  if (domain === 'profile' || domain === 'posts') invalidateUserApiReads('users');
}

export function requestError(status: number): Error {
  let locale: 'th' | 'en' = 'th';
  try { if (typeof window !== 'undefined' && window.localStorage.getItem('dating-locale') === 'en') locale = 'en'; } catch { /* Default locale also works without local storage. */ }
  const key = status === 401 ? 'requestSignIn' : status === 403 ? 'requestDenied' : status === 400 || status === 413 ? 'requestInvalid' : 'requestFailed';
  return new Error(messages[locale][key]);
}

async function request<T>(domain: string, action: string, args: unknown[]): Promise<T> {
  const response = await fetch(`/api/data/${domain}`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw requestError(response.status);
  return result.data as T;
}

export function userApiRead<T>(domain: string, action: string, args: unknown[], ttl = 0, force = false): Promise<T> {
  if (!reads[domain]?.includes(action)) throw new Error('Not a read operation');
  if (typeof window === 'undefined') return request(domain, action, args);
  return cachedRead(userApiReadKey(domain, action, args), () => request<T>(domain, action, args), ttl, force);
}

export async function userApi<T>(domain: string, action: string, args: unknown[]): Promise<T> {
  if (reads[domain]?.includes(action)) return userApiRead(domain, action, args);
  if (typeof window === 'undefined') return request(domain, action, args);
  try { return await request<T>(domain, action, args); }
  finally { invalidateMutation(domain, action); }
}
