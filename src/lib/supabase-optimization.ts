/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Query Caching & Optimization Utilities for Supabase
 * Prevents N+1 queries and reduces redundant API calls
 */

// ============================================
// 1. QUERY CACHE UTILITY
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry<any>>();

// Default 5-minute cache TTL (customize as needed)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cache key from function name and arguments
 */
export function getCacheKey(...args: any[]): string {
  return JSON.stringify(args);
}

/**
 * Get cached result if available and not expired
 */
export function getCachedResult<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (!cached) return null;

  // Check if cache has expired
  if (Date.now() - cached.timestamp > DEFAULT_CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Store result in cache
 */
export function setCachedResult(
  key: string,
  data: any,
  ttl = DEFAULT_CACHE_TTL,
): void {
  queryCache.set(key, { data, timestamp: Date.now() });

  // Auto-expire after TTL
  setTimeout(() => queryCache.delete(key), ttl);
}

/**
 * Clear specific cache entry
 */
export function clearCacheEntry(key: string): void {
  queryCache.delete(key);
}

/**
 * Clear all cache entries (use sparingly)
 */
export function clearAllCache(): void {
  queryCache.clear();
}

/**
 * Wrapper to automatically cache query results
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number,
): Promise<T> {
  // Check cache first
  const cached = getCachedResult<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute query
  const result = await fn();

  // Cache result
  setCachedResult(key, result, ttl);

  return result;
}

// ============================================
// 2. BATCH QUERY UTILITIES
// ============================================

/**
 * Split array into chunks for batch processing
 * Useful for Supabase IN() clause which has limits
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Execute queries in parallel batches, merge results
 */
export async function batchFetch<T, R>(
  items: T[],
  batchSize: number,
  fetchFn: (batch: T[]) => Promise<R[]>,
): Promise<R[]> {
  const chunks = chunkArray(items, batchSize);
  const results = await Promise.all(
    chunks.map((chunk) => fetchFn(chunk)),
  );
  return results.flat();
}

// ============================================
// 3. REQUEST DEDUPLICATION
// ============================================

type RequestKey = string;
type PendingRequest<T> = Promise<T>;

const pendingRequests = new Map<RequestKey, PendingRequest<any>>();

/**
 * Deduplicate identical concurrent requests
 * If same request is in-flight, return existing promise
 */
export async function deduplicatedFetch<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Check if request is already in-flight
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  // Execute request and store promise
  const promise = fn();
  pendingRequests.set(key, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    // Clean up after request completes
    pendingRequests.delete(key);
  }
}

// ============================================
// 4. PREFETCH UTILITY
// ============================================

export interface PrefetchOptions {
  delay?: number; // Milliseconds to wait before prefetching
  cache?: boolean; // Cache the prefetched result
}

/**
 * Prefetch data in background (useful for pagination, search results, etc)
 */
export async function prefetch<T>(
  key: string,
  fn: () => Promise<T>,
  options: PrefetchOptions = {},
): Promise<void> {
  const { delay = 500, cache = true } = options;

  setTimeout(async () => {
    try {
      const result = await fn();
      if (cache) {
        setCachedResult(key, result);
      }
    } catch (error) {
      // Silently fail - prefetch errors shouldn't break the app
      console.warn('Prefetch failed:', error);
    }
  }, delay);
}

// ============================================
// 5. FIELD SELECTION HELPERS
// ============================================

/**
 * Build optimized Supabase select query to fetch only needed fields
 * Reduces payload size and improves performance
 */
export const selectFields = {
  user: {
    minimal: 'id, fullName, username, profileImageKey',
    profile:
      'id, fullName, username, profileImageKey, age, gender, bio, relationShipStatus',
    full: '*',
  },
  post: {
    minimal:
      'id, content, createdAt, User!Post_authorId_fkey(id, username, profileImageKey)',
    feed: `
      id,
      content,
      createdAt,
      visibility,
      User!Post_authorId_fkey(id, fullName, username, profileImageKey, isVerified, role),
      PostLike!PostLike_postId_fkey(count),
      PostSave!PostSave_postId_fkey(count)
    `,
    full: '*',
  },
  message: {
    minimal: 'id, content, createdAt, senderId',
    full: 'id, content, createdAt, User!Message_senderId_fkey(id, fullName, username, profileImageKey)',
  },
  chat: {
    minimal:
      'id, createdAt, ChatParticipant!ChatParticipant_chatId_fkey(count)',
    full: `
      id,
      createdAt,
      User!Chat_createdById_fkey(id, fullName, profileImageKey),
      ChatParticipant!ChatParticipant_chatId_fkey(*, User!ChatParticipant_userId_fkey(id, fullName, profileImageKey))
    `,
  },
};

// ============================================
// 6. RATE LIMITING
// ============================================

class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquirePermission(): Promise<void> {
    const now = Date.now();

    // Remove old timestamps outside the window
    this.timestamps = this.timestamps.filter(
      (t) => now - t < this.windowMs,
    );

    // Check if we can make a request
    if (this.timestamps.length >= this.maxRequests) {
      // Wait until oldest timestamp is outside window
      const oldestTime = this.timestamps[0];
      const waitTime = oldestTime + this.windowMs - now;
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Retry
      return this.acquirePermission();
    }

    this.timestamps.push(now);
  }

  /**
   * Execute function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquirePermission();
    return fn();
  }
}

// Create a rate limiter: max 10 requests per second
export const supabaseRateLimiter = new RateLimiter(10, 1000);

// ============================================
// 7. EXAMPLE USAGE
// ============================================

/*

import { withCache, deduplicatedFetch, batchFetch, prefetch, supabaseRateLimiter } from '@/lib/supabase-optimization';

// Example 1: Caching
async function getUser(userId: string) {
  return withCache(
    getCacheKey('user', userId),
    () => userService.getUserById(userId),
    10 * 60 * 1000 // 10 minute cache
  );
}

// Example 2: Deduplication
async function getActiveUsers() {
  return deduplicatedFetch(
    'activeUsers',
    () => userService.getActiveUsers()
  );
}

// Example 3: Batch Fetching
async function getUsersByIds(userIds: string[]) {
  return batchFetch(userIds, 50, (batch) => 
    userService.getUsersByIds(batch)
  );
}

// Example 4: Prefetch Next Page
async function loadNextPosts(limit: number, offset: number) {
  const nextOffset = offset + limit;
  prefetch(
    getCacheKey('posts', nextOffset),
    () => postService.getPublicPosts(limit, nextOffset)
  );
}

// Example 5: Rate Limiting
async function limitedApiCall() {
  return supabaseRateLimiter.execute(() => 
    postService.getPublicPosts()
  );
}

*/
