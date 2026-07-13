import { useApiQuery } from "@/hooks/useApiQuery";

export function useUserStatusCheck(options?: { enabled?: boolean }) {
  return useApiQuery<{ isSuspended: boolean }>("/api/user/status-check", {
    enabled: options?.enabled,
    cacheKey: "user-status-check",
    cacheTimeMs: 30 * 1000,
  });
}
