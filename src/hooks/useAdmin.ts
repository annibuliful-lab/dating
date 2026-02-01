import { useInfiniteQuery } from '@/hooks/useInfiniteQuery';
import { adminService } from '@/services/admin';
import { useCallback } from 'react';

export function useAdminCheck() {
  const result = useInfiniteQuery<Record<string, unknown>[]>(
    '/api/admin/check',
  );
  return result;
}

export function useAdminUsers(searchQuery?: string) {
  const result = useInfiniteQuery<Record<string, unknown>[]>(
    `/api/admin/users${searchQuery ? `?search=${searchQuery}` : ''}`,
    {
      retries: 1,
      pageSize: 20,
    },
  );

  const updateUserStatus = useCallback(
    async (userId: string, data: Record<string, unknown>) => {
      return adminService.updateUserStatus(userId, data);
    },
    [],
  );

  return { ...result, updateUserStatus };
}
