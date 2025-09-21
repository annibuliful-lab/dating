import { supabase } from "@/client/supabase";

type PostInsert = {
  id?: string;
  authorId: string;
  content: { text: string };
  visibility: "PUBLIC" | "PRIVATE";
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const postService = {
  // Fetch all public posts with author information
  async getPublicPosts(limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from("Post")
      .select(
        `
        *,
        User!Post_authorId_fkey (
          id,
          fullName,
          username,
          profileImageKey
        ),
        PostLike!PostLike_postId_fkey (count),
        PostSave!PostSave_postId_fkey (count)
      `
      )
      .eq("visibility", "PUBLIC")
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch posts by specific user
  async getPostsByUser(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from("Post")
      .select(
        `
        *,
        User!Post_authorId_fkey (
          id,
          fullName,
          username,
          profileImageKey
        ),
        PostLike!PostLike_postId_fkey (count),
        PostSave!PostSave_postId_fkey (count)
      `
      )
      .eq("authorId", userId)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch single post with details
  async getPostById(postId: string) {
    const { data, error } = await supabase
      .from("Post")
      .select(
        `
        *,
        User!Post_authorId_fkey (
          id,
          fullName,
          username,
          profileImageKey,
          age,
          gender
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
      `
      )
      .eq("id", postId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch user's saved posts
  async getSavedPosts(userId: string) {
    const { data, error } = await supabase
      .from("PostSave")
      .select(
        `
        Post (
          *,
          User!Post_authorId_fkey (
            id,
            fullName,
            username,
            profileImageKey
          )
        )
      `
      )
      .eq("userId", userId)
      .order("id", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // Check if user liked a post
  async getUserPostLike(userId: string, postId: string) {
    const { data, error } = await supabase
      .from("PostLike")
      .select("id")
      .eq("userId", userId)
      .eq("postId", postId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw new Error(error.message);
    }
    return data;
  },

  // Check if user saved a post
  async getUserPostSave(userId: string, postId: string) {
    const { data, error } = await supabase
      .from("PostSave")
      .select("id")
      .eq("userId", userId)
      .eq("postId", postId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }
    return data;
  },

  // Create a new post
  async createPost(postData: PostInsert) {
    const { data, error } = await supabase
      .from("Post")
      .insert(postData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Like a post
  async likePost(userId: string, postId: string) {
    const { data, error } = await supabase
      .from("PostLike")
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
      .from("PostLike")
      .delete()
      .eq("userId", userId)
      .eq("postId", postId);

    if (error) throw new Error(error.message);
  },

  // Save a post
  async savePost(userId: string, postId: string) {
    const { data, error } = await supabase
      .from("PostSave")
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
      .from("PostSave")
      .delete()
      .eq("userId", userId)
      .eq("postId", postId);

    if (error) throw new Error(error.message);
  },
};
