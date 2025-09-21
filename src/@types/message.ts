// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Chat } from "../../generated/prisma";

// Base types from database
export type MessageInsert = {
  id?: string;
  chatId: string;
  senderId: string;
  text?: string | null;
  imageUrl?: string | null;
};

export type ChatInsert = {
  id?: string;
  isGroup?: boolean;
  name?: string | null;
  createdById: string;
  isAdminVisible?: boolean;
};

// Extended types for UI
export interface MessageWithUser {
  id: string;
  chatId: string;
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  createdAt: string;
  User?: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
  };
}

export interface ChatMessage {
  id: string;
  text: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  author: "me" | "other";
  senderId: string;
  senderName: string;
  senderAvatar: string | null | undefined;
  createdAtLabel: string;
  createdAt: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface PresenceState {
  user_id: string;
  user_name: string;
  typing: boolean;
  online_at: string;
}

// Subscription callback types
export type MessageSubscriptionCallback = (message: MessageWithUser) => void;
export type TypingSubscriptionCallback = (typingUsers: TypingUser[]) => void;

// Service method types
export interface SendMessageData {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface ChatWithLatestMessage {
  id: string;
  chatId: string;
  userId: string;
  isAdmin: boolean;
  Chat: Chat & {
    User?: {
      id: string;
      fullName: string;
      profileImageKey: string | null;
    };
    latestMessage?: MessageWithUser;
  };
}

// Supabase presence state type
export interface SupabasePresenceState {
  presence_ref: string;
  [key: string]: unknown;
}
