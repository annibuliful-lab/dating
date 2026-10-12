'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { messageService } from '@/services/supabase/messages';
import { invalidateUserApiReads } from '@/services/user-api';

export const UNREAD_COUNT_INVALIDATED_EVENT = 'unread-count-invalidated';

export function useUnreadCount() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const scope = JSON.stringify([status, userId, session?.user.role, session?.user.status, session?.user.isVerified]);
  const [count, setCount] = useState(0);
  const requestRef = useRef(0);
  const scopeRef = useRef(scope);
  useLayoutEffect(() => { scopeRef.current = scope; }, [scope]);
  const cancelFetch = useCallback(() => { requestRef.current++; }, []);

  const fetchCount = useCallback(async (force = false) => {
    const requestId = ++requestRef.current;
    const isCurrent = () => requestRef.current === requestId && scopeRef.current === scope;
    if (status !== 'authenticated' || !userId) {
      setCount(0);
      return;
    }
    try {
      const count = await messageService.getUnreadCount(userId, force);
      if (isCurrent()) setCount(count);
      return count;
    } catch {
      if (isCurrent()) setCount(0);
    }
  }, [userId, status, scope]);

  useEffect(() => {
    void fetchCount();
    return cancelFetch;
  }, [fetchCount, cancelFetch]);

  useEffect(() => {
    const onFocus = () => { void fetchCount(true); };
    const onInvalidated = () => {
      invalidateUserApiReads('messages', ['getUnreadCount']);
      void fetchCount(true);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener(UNREAD_COUNT_INVALIDATED_EVENT, onInvalidated);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(UNREAD_COUNT_INVALIDATED_EVENT, onInvalidated);
    };
  }, [fetchCount]);

  const refetch = useCallback(() => fetchCount(true), [fetchCount]);
  const refreshIfStale = useCallback(() => fetchCount(false), [fetchCount]);
  return { unreadCount: count, refetch, refreshIfStale };
}
