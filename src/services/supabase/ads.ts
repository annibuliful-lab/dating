import { supabase } from '@/client/supabase';

export type ActiveAd = {
  id: string;
  imageUrl: string;
  link: string | null;
};

const ACTIVE_ADS_CACHE_TTL_MS = 60 * 1000;
let activeAdsCache:
  | { data: ActiveAd[]; timestamp: number }
  | undefined;
let pendingActiveAdsRequest: Promise<ActiveAd[]> | undefined;

export const adService = {
  async getActiveAds(options?: { force?: boolean }): Promise<ActiveAd[]> {
    if (!options?.force) {
      if (
        activeAdsCache &&
        Date.now() - activeAdsCache.timestamp < ACTIVE_ADS_CACHE_TTL_MS
      ) {
        return activeAdsCache.data;
      }

      if (pendingActiveAdsRequest) return pendingActiveAdsRequest;
    }

    const request = (async () => {
      const { data, error } = await supabase
        .from('Ad')
        .select('id, imageUrl, link')
        .eq('isActive', true)
        .order('createdAt', { ascending: false });

        if (error) throw new Error(error.message);
        const result = (data || []) as ActiveAd[];
        activeAdsCache = {
          data: result,
          timestamp: Date.now(),
        };
        return result;
    })().finally(() => {
      pendingActiveAdsRequest = undefined;
    });

    pendingActiveAdsRequest = request;
    return request;
  },
};
