import { useApiQuery } from "@/hooks/useApiQuery";
import { adminService } from "@/services/admin";
import { useCallback } from "react";

export function useAdminCheck() {
  return useApiQuery<{ isAdmin: boolean; role: "USER" | "ADMIN" }>(
    "/api/admin/check"
  );
}

export function useAdminUsers(searchQuery?: string) {
  const result = useApiQuery<Record<string, unknown>[]>(
    `/api/admin/users${searchQuery ? `?search=${searchQuery}` : ""}`,
    {
      retries: 1,
    }
  );

  const updateUserStatus = useCallback(async (userId: string, data: Record<string, unknown>) => {
    return adminService.updateUserStatus(userId, data);
  }, []);

  return { ...result, updateUserStatus };
}
