// API request/response types

// Username check API
export type UsernameCheckRequest = {
  username: string;
  excludeUserId?: string;
};

export type UsernameCheckResponse = {
  available: boolean;
  message: string;
};

// User verification API
export type UserVerificationResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

// User status update API
export type UserStatusUpdateRequest = {
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  reason?: string;
};

export type UserStatusUpdateResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

// Chat invite API
export type ChatInviteRequest = {
  userIds: string[];
  chatName?: string;
};

export type ChatInviteResponse = {
  success: boolean;
  chatId?: string;
  message?: string;
  error?: string;
};

// Chat update name API
export type ChatUpdateNameRequest = {
  name: string;
};

export type ChatUpdateNameResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

// Generic API error response
export type ApiErrorResponse = {
  error: string;
  message?: string;
};

// Generic API success response
export type ApiSuccessResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
};
