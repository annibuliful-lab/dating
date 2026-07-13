import { useInfiniteQuery } from '@/hooks/useInfiniteQuery';
import { adminService } from '@/services/admin';
import { useCallback } from 'react';
import { useApiQuery } from './useApiQuery';

export function useAdminCheck() {
  return useApiQuery<{ isAdmin: boolean; role: 'USER' | 'ADMIN' }>(
    '/api/admin/check',
    {
      cacheKey: 'admin-check',
      cacheTimeMs: 60 * 1000,
    },
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

  // Fetch total user count for the current search/filter
  const countQuery = useApiQuery<{ total: number }>(
    '/api/admin/users/count',
    {
      retries: 1,
      queryParams: searchQuery ? { search: searchQuery } : undefined,
    },
  );

  const updateUserStatus = useCallback(
    async (userId: string, data: Record<string, unknown>) => {
      return adminService.updateUserStatus(userId, data);
    },
    [],
  );

  return {
    ...result,
    updateUserStatus,
    total: countQuery.data?.total ?? 0,
    countLoading: countQuery.loading,
  };
}
