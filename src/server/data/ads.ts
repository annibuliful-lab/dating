import 'server-only';
import { ServerReadCache } from '@/server/read-cache';
import { supabase } from '@/server/supabase';

export type ActiveAd = {
  id: string;
  imageUrl: string;
  link: string | null;
};

const ACTIVE_ADS_CACHE_TTL_MS = 60 * 1000;
const activeAdsCache = new ServerReadCache<ActiveAd[]>(ACTIVE_ADS_CACHE_TTL_MS);

export const adService = {
  async getActiveAds(options?: { force?: boolean }): Promise<ActiveAd[]> {
    return activeAdsCache.read('active', async (signal) => {
      const { data, error } = await supabase
        .from('Ad')
        .select('id, imageUrl, link')
        .eq('isActive', true)
        .order('createdAt', { ascending: false }).abortSignal(signal);

      if (error) throw new Error(error.message);
      return (data || []) as ActiveAd[];
    }, options?.force);
  },
};
