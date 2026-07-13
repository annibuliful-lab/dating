import { supabase } from '@/client/supabase';

type PostInsert = {
  id?: string;
  authorId: string;
  content: { text: string };
  visibility: 'PUBLIC' | 'MEMBERS_ONLY';
  imageUrl?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
};

type PostUser = {
  id: string;
  fullName: string;
  username: string;
  profileImageKey: string | null;
  isVerified: boolean;
  verifiedBy: string | null;
  role: string;
};

type PostWithUser = {
  id: string;
  authorId: string;
  content: { text: string };
  visibility: 'PUBLIC' | 'MEMBERS_ONLY';
  imageUrl?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
  User: PostUser | null;
  PostLike?: Array<{ count?: number }>;
  PostSave?: Array<{ count?: number }>;
};

const PUBLIC_POSTS_CACHE_TTL_MS = 30 * 1000;
const publicPostsCache = new Map<
  string,
  { data: unknown[]; timestamp: number }
>();
const pendingPublicPostRequests = new Map<string, Promise<unknown[]>>();

export const postService = {
  // Fetch all public posts with author information
  async getPublicPosts(limit = 20, offset = 0, options?: { force?: boolean }) {
    const cacheKey = `${limit}:${offset}`;
    if (!options?.force) {
      const cached = publicPostsCache.get(cacheKey);
      if (
        cached &&
        Date.now() - cached.timestamp < PUBLIC_POSTS_CACHE_TTL_MS
      ) {
        return cached.data;
      }

      const pending = pendingPublicPostRequests.get(cacheKey);
      if (pending) return pending;
    }

    // only return posts from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const request = (async () => {
      const { data, error } = await supabase
      .from('Post')
      .select(
        `
        *,
        User!Post_authorId_fkey (
          id,
          fullName,
          username,
          profileImageKey,
          isVerified,
          verifiedBy,
          role
        ),
        PostLike!PostLike_postId_fkey (count),
        PostSave!PostSave_postId_fkey (count)
      `,
      )
      .eq('visibility', 'PUBLIC')
      .gte('createdAt', thirtyDaysAgo.toISOString())
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      // ✅ OPTIMIZED: Deduplicate verified user IDs to avoid N+1 queries
      const verifiedByUserIds = [
        ...new Set(
          (data as unknown as PostWithUser[] | null)
            ?.map((post) => post.User?.verifiedBy)
            .filter(
              (id: string | null | undefined): id is string => !!id,
            ) || [],
        ),
      ];

      const verifiedByUsernames: Record<string, string> = {};
      if (verifiedByUserIds.length > 0) {
        // ✅ OPTIMIZED: Batch fetch in groups of 100 to handle large lists
        const batchSize = 100;
        for (let i = 0; i < verifiedByUserIds.length; i += batchSize) {
          const batch = verifiedByUserIds.slice(i, i + batchSize);
          const { data: verifiedByUsers } = await supabase
            .from('User')
            .select('id, username')
            .in('id', batch);

          if (verifiedByUsers) {
            verifiedByUsers.forEach(
              (user: { id: string; username: string }) => {
                verifiedByUsernames[user.id] = user.username;
              },
            );
          }
        }
      }

      // Transform data to add verifiedByUsername
      const transformedData = (
        data as unknown as PostWithUser[] | null
      )?.map((post) => {
        const verifiedByUsername = post.User?.verifiedBy
          ? verifiedByUsernames[post.User.verifiedBy] || null
          : null;

        return {
          ...post,
          User: {
            ...post.User,
            verifiedByUsername,
          },
        };
      });

      return (transformedData || data || []) as unknown[];
    })().then((result) => {
      publicPostsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      return result;
    }).finally(() => {
      pendingPublicPostRequests.delete(cacheKey);
    });

    pendingPublicPostRequests.set(cacheKey, request);
    return request;
  },

  // Fetch posts by specific user
  async getPostsByUser(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('Post')
      .select(
        `
        *,
        User!Post_authorId_fkey (
          id,
          fullName,
          username,
          profileImageKey,
          isVerified,
          role
        ),
        PostLike!PostLike_postId_fkey (count),
        PostSave!PostSave_postId_fkey (count)
      `,
      )
      .eq('authorId', userId)
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch single post with details
  async getPostById(postId: string) {
    const { data, error } = await supabase
      .from('Post')
      .select(
        `
        *,
          User!Post_authorId_fkey (
          id,
          fullName,
          username,
          profileImageKey,
          age,
          gender,
          isVerified,
          role
        ),
        PostLike!PostLike_postId_fkey (
          id,
          User!PostLike_userId_fkey (
            id,
            fullName,
            profileImageKey
          )
        ),
        PostSave!PostSave_postId_fkey (count)
      `,
      )
      .eq('id', postId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch user's saved posts
  async getSavedPosts(userId: string) {
    const { data, error } = await supabase
      .from('PostSave')
      .select(
        `
        Post (
          *,
          User!Post_authorId_fkey (
            id,
            fullName,
            username,
            profileImageKey,
            isVerified,
            role
          )
        )
      `,
      )
      .eq('userId', userId)
      .order('id', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // ✅ OPTIMIZED: Check both like and save in single batch query
  async getUserPostInteractions(userId: string, postIds: string[]) {
    if (postIds.length === 0) return {};

    const [likeData, saveData] = await Promise.all([
      supabase
        .from('PostLike')
        .select('postId')
        .eq('userId', userId)
        .in('postId', postIds),
      supabase
        .from('PostSave')
        .select('postId')
        .eq('userId', userId)
        .in('postId', postIds),
    ]);

    const likedPosts = new Set(
      (likeData.data || []).map((l) => l.postId),
    );
    const savedPosts = new Set(
      (saveData.data || []).map((s) => s.postId),
    );

    // Return object for quick lookup: { postId: { hasLiked, hasSaved } }
    return postIds.reduce(
      (acc, postId) => {
        acc[postId] = {
          hasLiked: likedPosts.has(postId),
          hasSaved: savedPosts.has(postId),
        };
        return acc;
      },
      {} as Record<string, { hasLiked: boolean; hasSaved: boolean }>,
    );
  },

  // Check if user liked a post
  async getUserPostLike(userId: string, postId: string) {
    const { data, error } = await supabase
      .from('PostLike')
      .select('id')
      .eq('userId', userId)
      .eq('postId', postId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new Error(error.message);
    }
    return data;
  },

  // Check if user saved a post
  async getUserPostSave(userId: string, postId: string) {
    const { data, error } = await supabase
      .from('PostSave')
      .select('id')
      .eq('userId', userId)
      .eq('postId', postId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }
    return data;
  },

  // Create a new post
  async createPost(postData: PostInsert) {
    const { data, error } = await supabase
      .from('Post')
      .insert(postData as never)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Like a post
  async likePost(userId: string, postId: string) {
    const { data, error } = await supabase
      .from('PostLike')
      .insert({
        id: crypto.randomUUID(),
        userId,
        postId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Unlike a post
  async unlikePost(userId: string, postId: string) {
    const { error } = await supabase
      .from('PostLike')
      .delete()
      .eq('userId', userId)
      .eq('postId', postId);

    if (error) throw new Error(error.message);
  },

  // Save a post
  async savePost(userId: string, postId: string) {
    const { data, error } = await supabase
      .from('PostSave')
      .insert({
        id: crypto.randomUUID(),
        userId,
        postId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Unsave a post
  async unsavePost(userId: string, postId: string) {
    const { error } = await supabase
      .from('PostSave')
      .delete()
      .eq('userId', userId)
      .eq('postId', postId);

    if (error) throw new Error(error.message);
  },
};
