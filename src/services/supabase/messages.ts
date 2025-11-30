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
          profileImageKey,
          isVerified,
          role
        )
      `
      )
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false }) // Latest messages first like Facebook
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Fetch older messages for infinite scroll (Facebook-style pagination)
  async getOlderMessages(
    chatId: string,
    beforeMessageId: string,
    limit = 20
  ): Promise<{ messages: MessageWithUser[]; hasMore: boolean }> {
    // First get the timestamp of the message we're loading before
    const { data: beforeMessage } = await supabase
      .from("Message")
      .select("createdAt")
      .eq("id", beforeMessageId)
      .single();

    if (!beforeMessage) {
      return { messages: [], hasMore: false };
    }

    // Fetch messages older than the beforeMessage
    const { data, error } = await supabase
      .from("Message")
      .select(
        `
        *,
        User!Message_senderId_fkey (
          id,
          fullName,
          username,
          profileImageKey,
          isVerified,
          role
        )
      `
      )
      .eq("chatId", chatId)
      .lt("createdAt", beforeMessage.createdAt) // Get messages before this timestamp
      .order("createdAt", { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    if (error) throw new Error(error.message);
    if (!data) return { messages: [], hasMore: false };

    const hasMore = data.length > limit;
    const messages = hasMore ? data.slice(0, limit) : data;

    return {
      messages: messages.reverse(), // Reverse to show oldest first
      hasMore,
    };
  },

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
          profileImageKey,
          isVerified,
          role
        )
      `
      )
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to send message");

    const channel = supabase.channel(`messages:${messageData.chatId}`);
    await channel.send({
      type: "broadcast",
      event: "new_message",
      payload: data,
    });

    return data;
  },

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
          ),
          ChatParticipant!ChatParticipant_chatId_fkey (
            *,
            User!ChatParticipant_userId_fkey (
              id,
              fullName,
              profileImageKey,
              role
            )
          )
        )
      `
      )
      .eq("userId", userId)
      .order("id", { ascending: false });

    if (error) throw new Error(error.message);
    if (!data) return [];

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
              profileImageKey,
              isVerified,
              role
            )
          `
          )
          .eq("chatId", participant.Chat.id)
          .order("createdAt", { ascending: false })
          .limit(1)
          .single();

        // Check if there are unread messages
        const hasUnread = await this.hasUnreadMessages(
          participant.Chat.id,
          userId
        );

        return {
          ...participant,
          Chat: {
            ...participant.Chat,
            latestMessage: latestMessage || undefined,
            hasUnread,
          },
        };
      })
    );

    return chatsWithMessages as never;
  },

  // Create a new chat
  async createChat(chatData: ChatInsert) {
    const { data, error } = await supabase
      .from("Chat")
      .insert(chatData as never)
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

  // Remove participant from chat
  async removeChatParticipant(chatId: string, userId: string) {
    const { error } = await supabase
      .from("ChatParticipant")
      .delete()
      .eq("chatId", chatId)
      .eq("userId", userId);

    if (error) throw new Error(error.message);
    return true;
  },

  // Update chat name
  async updateChatName(chatId: string, name: string) {
    const { data, error } = await supabase
      .from("Chat")
      .update({ name })
      .eq("id", chatId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Failed to update chat name");
    return data;
  },

  // Get chat info
  async getChatInfo(chatId: string) {
    const { data, error } = await supabase
      .from("Chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Chat not found");
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
          status,
          role
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
        chat.Chat.ChatParticipant.some(
          (p: { userId: string }) => p.userId === user2Id
        )
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
                  profileImageKey,
                  role
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
    const { error } = await supabase
      .from("ChatParticipant")
      .update({ lastReadAt: new Date().toISOString() })
      .eq("chatId", chatId)
      .eq("userId", userId);

    if (error) throw new Error(error.message);
    return true;
  },

  // Check if chat has unread messages
  async hasUnreadMessages(chatId: string, userId: string): Promise<boolean> {
    // Get participant's lastReadAt
    const { data: participant } = await supabase
      .from("ChatParticipant")
      .select("lastReadAt")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!participant) return false;

    const lastReadAt = participant.lastReadAt;

    // If never read, check if there are any messages
    if (!lastReadAt) {
      const { data: messages } = await supabase
        .from("Message")
        .select("id")
        .eq("chatId", chatId)
        .limit(1);

      return (messages?.length || 0) > 0;
    }

    // Check if there are messages after lastReadAt
    const { data: unreadMessages } = await supabase
      .from("Message")
      .select("id")
      .eq("chatId", chatId)
      .gt("createdAt", lastReadAt)
      .neq("senderId", userId) // Don't count own messages
      .limit(1);

    return (unreadMessages?.length || 0) > 0;
  },

  // Create a group chat
  async createGroupChat(createdById: string, name: string, userIds: string[]) {
    // Get admin user ID
    const { data: adminUser } = await supabase
      .from("User")
      .select("id")
      .eq("role", "ADMIN")
      .limit(1)
      .single();

    // Create the chat
    const chat = await this.createChat({
      id: crypto.randomUUID(),
      createdById,
      isGroup: true,
      name,
      isAdminVisible: true,
    });

    // Add admin user to group chat if admin exists
    if (adminUser) {
      const isAdminAlreadyIncluded =
        userIds.includes(adminUser.id) || createdById === adminUser.id;
      if (!isAdminAlreadyIncluded) {
        await this.addChatParticipant(chat.id, adminUser.id, true);
      }
    }

    // Add creator as admin participant (if not already admin user)
    if (createdById !== adminUser?.id) {
      await this.addChatParticipant(chat.id, createdById, true);
    }

    // Add all other participants
    await Promise.all(
      userIds
        .filter((userId) => userId !== adminUser?.id) // Don't add admin twice
        .map((userId) => this.addChatParticipant(chat.id, userId, false))
    );

    return chat;
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
          profileImageKey,
          isVerified,
          role
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
          profileImageKey,
          isVerified,
          role
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
