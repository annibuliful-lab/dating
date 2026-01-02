import { useApiQuery } from "@/hooks/useApiQuery";

export function useUserStatusCheck() {
  return useApiQuery<{ isSuspended: boolean }>("/api/user/status-check");
}
