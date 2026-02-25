'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { messageService } from '@/services/supabase/messages';

export function useUnreadCount() {
  const { data: session, status } = useSession();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setCount(0);
      return;
    }
    try {
      const n = await messageService.getUnreadCount(session.user.id);
      setCount(n);
    } catch {
      setCount(0);
    }
  }, [session?.user?.id, status]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchCount]);

  return { unreadCount: count, refetch: fetchCount };
}
