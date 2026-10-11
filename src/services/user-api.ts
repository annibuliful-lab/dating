import { messages } from '@/i18n/messages';

export function requestError(status: number): Error {
  let locale: 'th' | 'en' = 'th';
  try { if (typeof window !== 'undefined' && window.localStorage.getItem('dating-locale') === 'en') locale = 'en'; } catch { /* Default locale also works without local storage. */ }
  const key = status === 401 ? 'requestSignIn' : status === 403 ? 'requestDenied' : status === 400 || status === 413 ? 'requestInvalid' : 'requestFailed';
  return new Error(messages[locale][key]);
}

export async function userApi<T>(domain: string, action: string, args: unknown[]): Promise<T> {
  const response = await fetch(`/api/data/${domain}`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw requestError(response.status);
  return result.data as T;
}
