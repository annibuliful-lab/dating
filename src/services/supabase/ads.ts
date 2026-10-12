
import { userApiRead } from '@/services/user-api';

export const adService = {
  async getActiveAds(options?: { force?: boolean }) {
    return userApiRead<Awaited<ReturnType<typeof import('@/server/data/ads').adService.getActiveAds>>>('ads', 'getActiveAds', [], 30000, options?.force);
  },
};
