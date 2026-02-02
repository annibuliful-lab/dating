import { useInfiniteQuery } from '@/hooks/useInfiniteQuery';
import { adminService } from '@/services/admin';
import { useCallback } from 'react';
import { useApiQuery } from './useApiQuery';

export function useAdminCheck() {
  return useApiQuery<{ isAdmin: boolean; role: 'USER' | 'ADMIN' }>(
    '/api/admin/check',
  );
}

export function useAdminUsers(searchQuery?: string) {
  const result = useInfiniteQuery<Record<string, unknown>[]>(
    '/api/admin/users',
    {
      retries: 1,
      pageSize: 20,
      queryParams: searchQuery ? { search: searchQuery } : undefined,
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
