import {
  ChatInsert,
  ChatWithLatestMessage,
  MessageSubscriptionCallback,
  MessageWithUser,
  SendMessageData,
  SupabasePresenceState,
  TypingSubscriptionCallback,
  TypingUser,
} from "@/@types/message";
import { supabase } from "@/client/supabase";

export const messageService = {
  // Fetch messages for a specific chat
  async getChatMessages(
    chatId: string,
    limit = 50,
    offset = 0
  ): Promise<MessageWithUser[]> {
    const { data, error } = await supabase
      .from("Message")
      .select(
        `
        *,
        User!Message_senderId_fkey (
          id,
          fullName,
          username,
          profileImageKey
        )
      `
      )
      .eq("chatId", chatId)
      .order("createdAt", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Send a new message
  async sendMessage(messageData: SendMessageData): Promise<MessageWithUser> {
    const { data, error } = await supabase
      .from("Message")
      .insert(messageData)
      .select(
        `
        *,
        User!Message_senderId_fkey (
          id,
          fullName,
          username,
          profileImageKey
        )
      `
      )
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to send message");

    // Broadcast the message to all subscribers for better real-time performance
    const channel = supabase.channel(`messages:${messageData.chatId}`);
    await channel.send({
      type: "broadcast",
      event: "new_message",
      payload: data,
    });

    return data;
  },

  // Get user's chats with latest message
  async getUserChats(userId: string): Promise<ChatWithLatestMessage[]> {
    const { data, error } = await supabase
      .from("ChatParticipant")
      .select(
        `
        *,
        Chat!ChatParticipant_chatId_fkey (
          *,
          User!Chat_createdById_fkey (
            id,
            fullName,
            profileImageKey
          )
        )
      `
      )
      .eq("userId", userId)
      .order("id", { ascending: false });

    if (error) throw new Error(error.message);
    if (!data) return [];

    // Get latest message for each chat
    const chatsWithMessages = await Promise.all(
      data.map(async (participant) => {
        const { data: latestMessage } = await supabase
          .from("Message")
          .select(
            `
            *,
            User!Message_senderId_fkey (
              id,
              fullName,
              username,
              profileImageKey
            )
          `
          )
          .eq("chatId", participant.Chat.id)
          .order("createdAt", { ascending: false })
          .limit(1)
          .single();

        return {
          ...participant,
          Chat: {
            ...participant.Chat,
            latestMessage: latestMessage || undefined,
          },
        };
      })
    );

    return chatsWithMessages;
  },

  // Create a new chat
  async createChat(chatData: ChatInsert) {
    const { data, error } = await supabase
      .from("Chat")
      .insert(chatData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to create chat");
    return data;
  },

  // Add participant to chat
  async addChatParticipant(chatId: string, userId: string, isAdmin = false) {
    const { data, error } = await supabase
      .from("ChatParticipant")
      .insert({
        id: crypto.randomUUID(),
        chatId,
        userId,
        isAdmin,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to add chat participant");
    return data;
  },

  // Get chat participants
  async getChatParticipants(chatId: string) {
    const { data, error } = await supabase
      .from("ChatParticipant")
      .select(
        `
        *,
        User!ChatParticipant_userId_fkey (
          id,
          fullName,
          username,
          profileImageKey,
          status
        )
      `
      )
      .eq("chatId", chatId);

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Check if user is participant in chat
  async isUserInChat(userId: string, chatId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("ChatParticipant")
      .select("id")
      .eq("userId", userId)
      .eq("chatId", chatId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }
    return !!data;
  },

  // Get or create direct message chat between two users
  async getOrCreateDirectChat(user1Id: string, user2Id: string) {
    // First, try to find existing direct chat between these users
    const { data: existingChats } = await supabase
      .from("ChatParticipant")
      .select(
        `
        chatId,
        Chat!ChatParticipant_chatId_fkey (
          id,
          isGroup,
          ChatParticipant!ChatParticipant_chatId_fkey (
            userId
          )
        )
      `
      )
      .eq("userId", user1Id);

    // Find a non-group chat where both users are participants
    const directChat = existingChats?.find(
      (chat) =>
        !chat.Chat.isGroup &&
        chat.Chat.ChatParticipant.length === 2 &&
        chat.Chat.ChatParticipant.some((p) => p.userId === user2Id)
    );

    if (directChat) {
      return directChat.Chat;
    }

    // Create new direct chat
    const newChat = await this.createChat({
      id: crypto.randomUUID(),
      createdById: user1Id,
      isGroup: false,
      isAdminVisible: true,
    });

    // Add both users as participants
    await Promise.all([
      this.addChatParticipant(newChat.id, user1Id, true),
      this.addChatParticipant(newChat.id, user2Id, false),
    ]);

    return newChat;
  },

  // Real-time message subscription
  subscribeToMessages(chatId: string, callback: MessageSubscriptionCallback) {
    console.log("Creating subscription for chat:", chatId);

    const channel = supabase
      .channel(`messages:${chatId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
        },
      })
      // Listen for broadcast messages (faster, no database query needed)
      .on("broadcast", { event: "new_message" }, (payload) => {
        console.log("Broadcast message received:", payload);
        callback(payload.payload);
      })
      // Fallback to postgres_changes for reliability
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `chatId=eq.${chatId}`,
        },
        async (payload) => {
          console.log("Postgres changes payload received:", payload);
          try {
            // Fetch the complete message with user data
            const { data, error } = await supabase
              .from("Message")
              .select(
                `
                *,
                User!Message_senderId_fkey (
                  id,
                  fullName,
                  username,
                  profileImageKey
                )
              `
              )
              .eq("id", payload.new.id)
              .single();

            if (error) {
              console.error("Error fetching message data:", error);
              return;
            }

            if (data) {
              console.log("Calling callback with message data:", data);
              callback(data);
            }
          } catch (err) {
            console.error("Error in message subscription callback:", err);
          }
        }
      )
      .subscribe((status, err) => {
        console.log("Subscription status:", status);
        if (err) {
          console.error("Subscription error:", err);
        }
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to messages for chat:", chatId);
        } else if (status === "CHANNEL_ERROR") {
          console.error("Error subscribing to messages for chat:", chatId);
        } else if (status === "TIMED_OUT") {
          console.error("Subscription timed out for chat:", chatId);
        } else if (status === "CLOSED") {
          console.log("Subscription closed for chat:", chatId);
        }
      });

    return channel;
  },

  // Typing indicators
  subscribeToTyping(
    chatId: string,
    onTypingUpdate: TypingSubscriptionCallback
  ) {
    const channel = supabase
      .channel(`typing:${chatId}`)
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const typingUsers: TypingUser[] = [];

        Object.values(presenceState).forEach((presences) => {
          presences.forEach((presence: SupabasePresenceState) => {
            if (
              presence.typing &&
              typeof presence.user_id === "string" &&
              typeof presence.user_name === "string"
            ) {
              typingUsers.push({
                userId: presence.user_id,
                userName: presence.user_name,
                isTyping: Boolean(presence.typing),
              });
            }
          });
        });

        onTypingUpdate(typingUsers);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left:", key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          console.log(
            "Successfully subscribed to typing indicators for chat:",
            chatId
          );
        }
      });

    return channel;
  },

  // Send typing indicator
  async sendTypingIndicator(
    chatId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ) {
    const channel = supabase.channel(`typing:${chatId}`);
    await channel.track({
      user_id: userId,
      user_name: userName,
      typing: isTyping,
      online_at: new Date().toISOString(),
    });
  },

  // Mark messages as read
  async markMessagesAsRead(chatId: string, userId: string) {
    // This would require a MessageRead table in your database
    // For now, we'll just log it
    console.log(
      `Marking messages as read for user ${userId} in chat ${chatId}`
    );
  },

  // Edit a message
  async editMessage(
    messageId: string,
    newText: string
  ): Promise<MessageWithUser> {
    const { data, error } = await supabase
      .from("Message")
      .update({ text: newText })
      .eq("id", messageId)
      .select(
        `
        *,
        User!Message_senderId_fkey (
          id,
          fullName,
          username,
          profileImageKey
        )
      `
      )
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to edit message");
    return data;
  },

  // Delete a message
  async deleteMessage(messageId: string): Promise<boolean> {
    const { error } = await supabase
      .from("Message")
      .delete()
      .eq("id", messageId);

    if (error) throw new Error(error.message);
    return true;
  },

  // Get message by ID
  async getMessage(messageId: string): Promise<MessageWithUser> {
    const { data, error } = await supabase
      .from("Message")
      .select(
        `
        *,
        User!Message_senderId_fkey (
          id,
          fullName,
          username,
          profileImageKey
        )
      `
      )
      .eq("id", messageId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Message not found");
    return data;
  },
};
