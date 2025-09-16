import { Database } from "../../generated/supabase-database.types";

// Base types from database
export type Message = Database["public"]["Tables"]["Message"]["Row"];
export type MessageInsert = Database["public"]["Tables"]["Message"]["Insert"];
export type MessageUpdate = Database["public"]["Tables"]["Message"]["Update"];

export type User = Database["public"]["Tables"]["User"]["Row"];
export type Chat = Database["public"]["Tables"]["Chat"]["Row"];
export type ChatInsert = Database["public"]["Tables"]["Chat"]["Insert"];

// Extended types for UI
export interface MessageWithUser extends Message {
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
