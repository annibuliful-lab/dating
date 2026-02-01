import { useInfiniteQuery } from '@/hooks/useInfiniteQuery';
import { adminService } from '@/services/admin';
import { useCallback } from 'react';

type Post = {
  id: string;
  content: {
    text?: string;
    [key: string]: unknown;
  } | null;
  imageUrl: string[] | null;
  visibility: string;
  createdAt: string;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
    isVerified: boolean;
    status: string;
  };
  PostLike?: Array<{ count?: number }>;
  PostSave?: Array<{ count?: number }>;
};

export function useAdminPosts() {
  const result = useInfiniteQuery<Post[]>('/api/admin/posts', {
    retries: 1,
    pageSize: 20,
  });

  const deletePost = useCallback(async (postId: string) => {
    return adminService.deletePost(postId);
  }, []);

  return { ...result, deletePost };
}
