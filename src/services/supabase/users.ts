import { supabase } from '@/client/supabase';

type UserSearchResult = {
  id: string;
  fullName: string;
  username: string | null;
  profileImageKey: string | null;
  age: number | null;
  gender: string | null;
};

const USER_SEARCH_CACHE_TTL_MS = 30 * 1000;
const userSearchCache = new Map<
  string,
  { data: UserSearchResult[]; timestamp: number }
>();
const pendingUserSearchRequests = new Map<
  string,
  Promise<UserSearchResult[]>
>();

type UserUpdate = {
  fullName?: string;
  username?: string;
  bio?: string | null;
  age?: number | null;
  gender?: string | null;
  height?: number | null;
  profileImageKey?: string | null;
  status?: string | null;
  updatedAt?: string;
};

export const userService = {
  // ✅ OPTIMIZED: Batch fetch multiple users efficiently (prevents N+1)
  async getUsersByIds(ids: string[]) {
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('User')
      .select('*')
      .in('id', ids);

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Fetch all active users
  async getActiveUsers() {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('createdAt', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch user by ID
  async getUserById(id: string) {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch user profile data (excluding sensitive info)
  async getUserProfile(id: string) {
    const { data, error } = await supabase
      .from('User')
      .select(
        'id, fullName, username, age, gender, bio, profileImageKey, height, weight, relationShipStatus',
      )
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Search users by username or full name
  async searchUsers(searchTerm: string) {
    const normalizedSearchTerm = searchTerm.trim();
    if (normalizedSearchTerm.length < 2) return [];

    const cacheKey = normalizedSearchTerm.toLowerCase();
    const cached = userSearchCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.timestamp < USER_SEARCH_CACHE_TTL_MS
    ) {
      return cached.data;
    }

    const pending = pendingUserSearchRequests.get(cacheKey);
    if (pending) return pending;

    const request = (async () => {
      const { data, error } = await supabase
        .from('User')
        .select('id, fullName, username, profileImageKey, age, gender')
        .or(
          `fullName.ilike.%${normalizedSearchTerm}%,username.ilike.%${normalizedSearchTerm}%`,
        )
        .eq('status', 'ACTIVE')
        .limit(20);

      if (error) throw new Error(error.message);
      const result = (data || []) as UserSearchResult[];
      userSearchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      return result;
    })().finally(() => {
      pendingUserSearchRequests.delete(cacheKey);
    });

    pendingUserSearchRequests.set(cacheKey, request);
    return request;
  },

  // Get users by age range
  async getUsersByAgeRange(minAge: number, maxAge: number) {
    const { data, error } = await supabase
      .from('User')
      .select(
        'id, fullName, username, age, gender, bio, profileImageKey',
      )
      .gte('age', minAge)
      .lte('age', maxAge)
      .eq('status', 'ACTIVE');

    if (error) throw new Error(error.message);
    return data;
  },

  // Update user profile
  async updateUserProfile(id: string, updates: UserUpdate) {
    const { data, error } = await supabase
      .from('User')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Get users with their post counts
  async getUsersWithPostCounts() {
    const { data, error } = await supabase
      .from('User')
      .select(
        `
        id,
        fullName,
        username,
        profileImageKey,
        Post!Post_authorId_fkey (count)
      `,
      )
      .eq('status', 'ACTIVE');

    if (error) throw new Error(error.message);
    return data;
  },
};
