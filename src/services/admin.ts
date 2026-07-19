type AdminCheckResponse = {
  isAdmin: boolean;
  role: "USER" | "ADMIN";
};

type UserStatusUpdate = {
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

export const adminService = {
  async checkAdminStatus(): Promise<AdminCheckResponse> {
    const response = await fetch("/api/admin/check");
    if (!response.ok) {
      throw new Error("Failed to check admin status");
    }
    return response.json();
  },

  async getUsers(searchQuery?: string) {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);

    const response = await fetch(`/api/admin/users?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }
    return response.json();
  },

  async updateUserStatus(userId: string, data: UserStatusUpdate) {
    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update user status");
    }
    return response.json();
  },

  async updateUserVerification(userId: string, isVerified: boolean) {
    const action = isVerified ? "verify" : "unverify";
    const response = await fetch(`/api/users/${userId}/${action}`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update user verification");
    }
    return response.json();
  },

  async deletePost(postId: string) {
    const response = await fetch(`/api/admin/posts/${postId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete post");
    }
    return response.json();
  },
};
