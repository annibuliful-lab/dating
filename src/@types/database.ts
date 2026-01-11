// Shared database types based on Prisma schema
// These types represent the structure returned from Supabase queries

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type UserRole = "USER" | "ADMIN";
export type PostVisibility = "PUBLIC" | "MEMBERS_ONLY";

// Base database entity types
export type DatabaseUser = {
  id: string;
  profileImageKey: string | null;
  email: string | null;
  username: string;
  name: string | null;
  lastname: string | null;
  fullName: string;
  bio: string | null;
  birthday: string | null;
  relationShipStatus: string | null;
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  phone: string | null;
  lineId: string | null;
  status: UserStatus;
  statusUpdatedAt: string | null;
  role: UserRole;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// User with minimal fields for display
export type UserDisplay = {
  id: string;
  fullName: string;
  username: string;
  profileImageKey: string | null;
  isVerified?: boolean;
  verifiedBy?: string | null;
  verifiedByUsername?: string | null;
  role?: UserRole;
  status?: UserStatus;
};

// ChatParticipant with nested User
export type ChatParticipantWithUser = {
  id: string;
  chatId: string;
  userId: string;
  isAdmin: boolean;
  lastReadAt: string | null;
  User: UserDisplay | null;
};

// Message with User (imported from message types)
import type { MessageWithUser } from "./message";

// Chat with nested relations
export type ChatWithRelations = {
  id: string;
  isGroup: boolean;
  name: string | null;
  createdById: string;
  isAdminVisible: boolean;
  createdAt: string;
  User?: UserDisplay | null;
  ChatParticipant?: ChatParticipantWithUser[];
  latestMessage?: MessageWithUser;
  hasUnread?: boolean;
};

// ChatParticipant with nested Chat
export type ChatParticipantWithChat = {
  id: string;
  chatId: string;
  userId: string;
  isAdmin: boolean;
  lastReadAt: string | null;
  Chat: ChatWithRelations;
};

// Post content structure
export type PostContent = {
  text?: string;
  [key: string]: unknown;
};

// Post with User
export type PostWithUser = {
  id: string;
  authorId: string;
  content: PostContent | null;
  imageUrl: string[] | null;
  visibility: PostVisibility;
  createdAt: string;
  updatedAt: string;
  User: UserDisplay | null;
  PostLike?: Array<{ count?: number }>;
  PostSave?: Array<{ count?: number }>;
};
