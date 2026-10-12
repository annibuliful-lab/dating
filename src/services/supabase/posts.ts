import type { PostInsert } from '@/server/data/posts';
import { userApi } from '@/services/user-api';

export const postService = {
  async getPublicPosts(limit = 20, offset = 0, options?: { force?: boolean; search?: string; hashtag?: string }) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.getPublicPosts>>>('posts', 'getPublicPosts', [limit, offset, options]);
  },
  async getPostsByUser(userId: string, limit = 20) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.getPostsByUser>>>('posts', 'getPostsByUser', [userId, limit]);
  },
  async getPostById(postId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.getPostById>>>('posts', 'getPostById', [postId]);
  },
  async getSavedPosts(userId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.getSavedPosts>>>('posts', 'getSavedPosts', [userId]);
  },
  async getUserPostInteractions(userId: string, postIds: string[]) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.getUserPostInteractions>>>('posts', 'getUserPostInteractions', [userId, postIds]);
  },
  async getUserPostLike(userId: string, postId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.getUserPostLike>>>('posts', 'getUserPostLike', [userId, postId]);
  },
  async getUserPostSave(userId: string, postId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.getUserPostSave>>>('posts', 'getUserPostSave', [userId, postId]);
  },
  async createPost(postData: PostInsert) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.createPost>>>('posts', 'createPost', [postData]);
  },
  async likePost(userId: string, postId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.likePost>>>('posts', 'likePost', [userId, postId]);
  },
  async unlikePost(userId: string, postId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.unlikePost>>>('posts', 'unlikePost', [userId, postId]);
  },
  async savePost(userId: string, postId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.savePost>>>('posts', 'savePost', [userId, postId]);
  },
  async unsavePost(userId: string, postId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/posts').postService.unsavePost>>>('posts', 'unsavePost', [userId, postId]);
  },
};
