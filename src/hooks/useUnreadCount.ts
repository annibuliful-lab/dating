'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { messageService } from '@/services/supabase/messages';

const UNREAD_COUNT_CACHE_TTL_MS = 15 * 1000;
const unreadCountCache = new Map<
  string,
  { count: number; timestamp: number }
>();
const pendingUnreadCountRequests = new Map<string, Promise<number>>();

export function useUnreadCount() {
  const { data: session, status } = useSession();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async (force = false) => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setCount(0);
      return;
    }

    const userId = session.user.id;

    if (!force) {
      const cached = unreadCountCache.get(userId);
      if (
        cached &&
        Date.now() - cached.timestamp < UNREAD_COUNT_CACHE_TTL_MS
      ) {
        setCount(cached.count);
        return cached.count;
      }

      const pending = pendingUnreadCountRequests.get(userId);
      if (pending) {
        const pendingCount = await pending;
        setCount(pendingCount);
        return pendingCount;
      }
    }

    try {
      const request = messageService
        .getUnreadCount(userId)
        .finally(() => pendingUnreadCountRequests.delete(userId));
      pendingUnreadCountRequests.set(userId, request);

      const n = await request;
      unreadCountCache.set(userId, {
        count: n,
        timestamp: Date.now(),
      });
      setCount(n);
      return n;
    } catch {
      setCount(0);
      return 0;
    }
  }, [session?.user?.id, status]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const onFocus = () => fetchCount(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchCount]);

  return {
    unreadCount: count,
    refetch: () => fetchCount(true),
    refreshIfStale: () => fetchCount(false),
  };
}
