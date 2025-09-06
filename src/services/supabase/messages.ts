import { supabase } from "@/client/supabase";
import { Database } from "../../../generated/supabase-database.types";

type MessageInsert = Database["public"]["Tables"]["Message"]["Insert"];
type ChatInsert = Database["public"]["Tables"]["Chat"]["Insert"];

export const messageService = {
  // Fetch messages for a specific chat
  async getChatMessages(chatId: string, limit = 50, offset = 0) {
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
    return data;
  },

  // Send a new message
  async sendMessage(messageData: MessageInsert) {
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
    return data;
  },

  // Get user's chats with latest message
  async getUserChats(userId: string) {
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
              profileImageKey
            )
          )
        )
      `
      )
      .eq("userId", userId)
      .order("id", { ascending: false });

    if (error) throw new Error(error.message);

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
            latestMessage,
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
    return data;
  },

  // Check if user is participant in chat
  async isUserInChat(userId: string, chatId: string) {
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
  subscribeToMessages(
    chatId: string,
    callback: (message: {
      id: string;
      text: string | null;
      imageUrl: string | null;
      senderId: string;
      createdAt: string;
      User?: {
        id: string;
        fullName: string;
        username: string;
        profileImageKey: string | null;
      };
    }) => void
  ) {
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `chatId=eq.${chatId}`,
        },
        async (payload) => {
          console.log("Realtime payload received:", payload);
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
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to messages for chat:", chatId);
        } else if (status === "CHANNEL_ERROR") {
          console.error("Error subscribing to messages for chat:", chatId);
        }
      });

    return channel;
  },
};
