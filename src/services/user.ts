type UserStatusResponse = {
  isSuspended: boolean;
};

export const userService = {
  async checkUserStatus(): Promise<UserStatusResponse> {
    const response = await fetch("/api/user/status-check");
    if (!response.ok) {
      throw new Error("Failed to check user status");
    }
    return response.json();
  },
};
