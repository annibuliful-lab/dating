import { postService } from "@/services/post";
import { useCallback, useEffect, useState } from "react";

export function usePublicPosts(limit = 20) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(
    async (offset = 0, isRefresh = false) => {
      try {
        if (isRefresh) {
          setLoading(true); // Or separate refresh state
        } else if (offset === 0) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const data = await postService.getPublicPosts(limit, offset);

        if (data.length < limit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        setPosts((prev) => (offset === 0 ? data : [...prev, ...data]));
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch posts"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return { posts, loading, loadingMore, error, hasMore, fetchPosts };
}
