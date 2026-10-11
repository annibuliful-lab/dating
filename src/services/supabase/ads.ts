
import { userApi } from '@/services/user-api';

export const adService = {
  async getActiveAds(options?: { force?: boolean }) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/ads').adService.getActiveAds>>>('ads', 'getActiveAds', [options]);
  },
};
