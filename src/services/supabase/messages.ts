import {
  ChatInsert,
  ChatWithLatestMessage,
  MessageSubscriptionCallback,
  MessageWithUser,
  SendMessageData,
  SupabasePresenceState,
  TypingSubscriptionCallback,
  TypingUser,
} from '@/@types/message';
import { supabase } from '@/client/supabase';

const USER_CHATS_CACHE_TTL_MS = 30 * 1000;
const userChatsCache = new Map<
  string,
  { data: ChatWithLatestMessage[]; timestamp: number }
>();
const pendingUserChatsRequests = new Map<
  string,
  Promise<ChatWithLatestMessage[]>
>();
const CHAT_SUMMARY_CACHE_TTL_MS = 60 * 1000;
type ChatSummary = {
  name: string | null;
  isGroup: boolean;
};
const chatSummaryCache = new Map<
  string,
  { data: ChatSummary; timestamp: number }
>();
const pendingChatSummaryRequests = new Map<
  string,
  Promise<ChatSummary>
>();
const UNREAD_COUNT_INVALIDATED_EVENT = 'unread-count-invalidated';
let chatCacheGeneration = 0;

function clearChatCaches(chatId?: string) {
  chatCacheGeneration += 1;
  userChatsCache.clear();
  pendingUserChatsRequests.clear();
  if (!chatId) {
    chatSummaryCache.clear();
    pendingChatSummaryRequests.clear();
    return;
  }

  Array.from(chatSummaryCache.keys()).forEach((key) => {
    if (key.startsWith(`${chatId}:`)) {
      chatSummaryCache.delete(key);
    }
  });
  Array.from(pendingChatSummaryRequests.keys()).forEach((key) => {
    if (key.startsWith(`${chatId}:`)) {
      pendingChatSummaryRequests.delete(key);
    }
  });
}

function notifyUnreadCountInvalidated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNREAD_COUNT_INVALIDATED_EVENT));
  }
}

async function refreshChatLatestMessageMetadata(chatId: string) {
  const { data: latestMessage, error } = await supabase
    .from('Message')
    .select('id, createdAt')
    .eq('chatId', chatId)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  await supabase
    .from('Chat')
    .update({
      lastMessageId: latestMessage?.id || null,
      lastMessageAt: latestMessage?.createdAt || null,
    } as never)
    .eq('id', chatId);
}

export const messageService = {
  async getChatMessages(
    chatId: string,
    limit = 50,
    offset = 0,
  ): Promise<MessageWithUser[]> {
    const { data, error } = await supabase
      .from('Message')
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
      `,
      )
      .eq('chatId', chatId)
      .order('createdAt', { ascending: false }) // Latest messages first like Facebook
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return (data || []) as unknown as MessageWithUser[];
  },

  // Fetch older messages for infinite scroll (Facebook-style pagination)
  async getOlderMessages(
    chatId: string,
    beforeMessageId: string,
    limit = 20,
  ): Promise<{ messages: MessageWithUser[]; hasMore: boolean }> {
    // First get the timestamp of the message we're loading before
    const { data: beforeMessage } = await supabase
      .from('Message')
      .select('createdAt')
      .eq('id', beforeMessageId)
      .single();

    if (!beforeMessage) {
      return { messages: [], hasMore: false };
    }

    // Fetch messages older than the beforeMessage
    const { data, error } = await supabase
      .from('Message')
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
      `,
      )
      .eq('chatId', chatId)
      .lt('createdAt', beforeMessage.createdAt) // Get messages before this timestamp
      .order('createdAt', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    if (error) throw new Error(error.message);
    if (!data) return { messages: [], hasMore: false };

    const hasMore = data.length > limit;
    const messages = (hasMore
      ? data.slice(0, limit)
      : data) as unknown as MessageWithUser[];

    return {
      messages: messages.reverse(), // Reverse to show oldest first
      hasMore,
    };
  },

  async sendMessage(
    messageData: SendMessageData,
  ): Promise<MessageWithUser> {
    const { data, error } = await supabase
      .from('Message')
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
      `,
      )
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to send message');

    await supabase
      .from('Chat')
      .update({
        lastMessageId: data.id,
        lastMessageAt: data.createdAt,
      } as never)
      .eq('id', messageData.chatId);
    clearChatCaches(messageData.chatId);
    notifyUnreadCountInvalidated();

    const channel = supabase.channel(
      `messages:${messageData.chatId}`,
    );
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: data,
    });

    return data as unknown as MessageWithUser;
  },

  async getUserChats(
    userId: string,
    options?: { force?: boolean },
  ): Promise<ChatWithLatestMessage[]> {
    if (!options?.force) {
      const cached = userChatsCache.get(userId);
      if (
        cached &&
        Date.now() - cached.timestamp < USER_CHATS_CACHE_TTL_MS
      ) {
        return cached.data;
      }

      const pending = pendingUserChatsRequests.get(userId);
      if (pending) return pending;
    }

    const requestGeneration = chatCacheGeneration;
    const request = (async () => {
      const { data, error } = await supabase
        .from('ChatParticipant')
        .select(
          `
          id,
          chatId,
          userId,
          isAdmin,
          lastReadAt,
          Chat!ChatParticipant_chatId_fkey (
            id,
            name,
            isGroup,
            createdById,
            lastMessageAt,
            createdAt,
            Message!Chat_lastMessageId_fkey (
              id,
              chatId,
              senderId,
              text,
              imageUrl,
              createdAt,
              User!Message_senderId_fkey (
                id,
                fullName,
                username,
                profileImageKey,
                isVerified,
                role
              )
            ),
            User!Chat_createdById_fkey (
              id,
              fullName,
              profileImageKey
            ),
            ChatParticipant!ChatParticipant_chatId_fkey (
              id,
              chatId,
              userId,
              isAdmin,
              User!ChatParticipant_userId_fkey (
                id,
                fullName,
                profileImageKey,
                role
              )
            )
          )
        `,
        )
        .eq('userId', userId)
        .order('id', { ascending: false });

      if (error) throw new Error(error.message);
      if (!data) return [];

      const chatsWithMessages = data.map((participant) => ({
        ...participant,
        Chat: {
          ...participant.Chat,
          latestMessage:
            (participant.Chat as { Message?: MessageWithUser | null })
              .Message || undefined,
          hasUnread:
            Boolean(
              (participant.Chat as { lastMessageAt?: string | null })
                .lastMessageAt,
            ) &&
            (!participant.lastReadAt ||
              new Date(
                (participant.Chat as { lastMessageAt: string })
                  .lastMessageAt,
              ) > new Date(participant.lastReadAt as string)) &&
            (participant.Chat as { Message?: { senderId?: string } })
              .Message?.senderId !== userId,
        },
      }));

      // Sort chats by latest message createdAt (newest first)
      // Chats without messages go to the bottom
      const sortedChats = chatsWithMessages.sort((a, b) => {
        const aMessageTime =
          (a.Chat as { lastMessageAt?: string | null }).lastMessageAt ||
          a.Chat.latestMessage?.createdAt;
        const bMessageTime =
          (b.Chat as { lastMessageAt?: string | null }).lastMessageAt ||
          b.Chat.latestMessage?.createdAt;

        // If both have messages, sort by createdAt descending (newest first)
        if (aMessageTime && bMessageTime) {
          return (
            new Date(bMessageTime).getTime() -
            new Date(aMessageTime).getTime()
          );
        }

        // If only one has a message, prioritize it
        if (aMessageTime && !bMessageTime) return -1;
        if (!aMessageTime && bMessageTime) return 1;

        // If neither has messages, maintain original order (by chat id)
        return 0;
      });

      return sortedChats as never;
    })()
      .then((result) => {
        if (requestGeneration === chatCacheGeneration) {
          userChatsCache.set(userId, {
            data: result,
            timestamp: Date.now(),
          });
        }
        return result;
      })
      .finally(() => {
        pendingUserChatsRequests.delete(userId);
      });

    pendingUserChatsRequests.set(userId, request);
    return request;
  },

  // Create a new chat
  async createChat(chatData: ChatInsert) {
    const { data, error } = await supabase
      .from('Chat')
      .insert(chatData as never)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create chat');
    clearChatCaches(data.id);
    return data;
  },

  // Add participant to chat
  async addChatParticipant(
    chatId: string,
    userId: string,
    isAdmin = false,
  ) {
    const { data, error } = await supabase
      .from('ChatParticipant')
      .insert({
        id: crypto.randomUUID(),
        chatId,
        userId,
        isAdmin,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to add chat participant');
    clearChatCaches(chatId);
    return data;
  },

  // Remove participant from chat
  async removeChatParticipant(chatId: string, userId: string) {
    const { error } = await supabase
      .from('ChatParticipant')
      .delete()
      .eq('chatId', chatId)
      .eq('userId', userId);

    if (error) throw new Error(error.message);
    clearChatCaches(chatId);
    return true;
  },

  // Update chat name
  async updateChatName(chatId: string, name: string) {
    const { data, error } = await supabase
      .from('Chat')
      .update({ name })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to update chat name');
    clearChatCaches(chatId);
    return data;
  },

  // Get chat info
  async getChatInfo(chatId: string) {
    const { data, error } = await supabase
      .from('Chat')
      .select('*')
      .eq('id', chatId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Chat not found');
    return data;
  },

  // Get chat participants
  async getChatParticipants(chatId: string) {
    const { data, error } = await supabase
      .from('ChatParticipant')
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
      `,
      )
      .eq('chatId', chatId);

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getChatParticipant(chatId: string, userId: string) {
    const { data, error } = await supabase
      .from('ChatParticipant')
      .select('id, chatId, userId, isAdmin, lastReadAt')
      .eq('chatId', chatId)
      .eq('userId', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  async getChatParticipantCount(chatId: string): Promise<number> {
    const { count, error } = await supabase
      .from('ChatParticipant')
      .select('id', { count: 'exact', head: true })
      .eq('chatId', chatId);

    if (error) throw new Error(error.message);
    return count || 0;
  },

  async updateChatGroupStatus(chatId: string, isGroup: boolean) {
    const { error } = await supabase
      .from('Chat')
      .update({ isGroup })
      .eq('id', chatId);

    if (error) throw new Error(error.message);
    clearChatCaches(chatId);
  },

  async getFirstAdminUserId(): Promise<string | null> {
    const { data, error } = await supabase
      .from('User')
      .select('id')
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data?.id || null;
  },

  async getChatSummary(
    chatId: string,
    currentUserId: string,
    options?: { force?: boolean },
  ): Promise<ChatSummary> {
    const cacheKey = `${chatId}:${currentUserId}`;
    if (!options?.force) {
      const cached = chatSummaryCache.get(cacheKey);
      if (
        cached &&
        Date.now() - cached.timestamp < CHAT_SUMMARY_CACHE_TTL_MS
      ) {
        return cached.data;
      }

      const pending = pendingChatSummaryRequests.get(cacheKey);
      if (pending) return pending;
    }

    const requestGeneration = chatCacheGeneration;
    const request = (async () => {
      const { data, error } = await supabase
        .from('ChatParticipant')
        .select(
          `
          userId,
          User!ChatParticipant_userId_fkey (
            fullName
          ),
          Chat!ChatParticipant_chatId_fkey (
            id,
            name,
            isGroup
          )
        `,
        )
        .eq('chatId', chatId);

      if (error) throw new Error(error.message);

      const participants = data || [];
      const first = participants[0];
      const chat = first?.Chat;

      if (!chat) {
        return {
          name: `Chat ${chatId.slice(0, 8)}`,
          isGroup: false,
        };
      }

      let chatName = chat.name;
      if (!chatName) {
        const otherParticipants = participants.filter(
          (participant) => participant.userId !== currentUserId,
        );
        chatName =
          otherParticipants
            .map((participant) => {
              const user = participant.User as
                | { fullName?: string }
                | undefined;
              return user?.fullName || 'Unknown';
            })
            .join(', ') || `Chat ${chatId.slice(0, 8)}`;
      }

      return {
        name: chatName,
        isGroup: Boolean(chat.isGroup),
      };
    })()
      .then((result) => {
        if (requestGeneration === chatCacheGeneration) {
          chatSummaryCache.set(cacheKey, {
            data: result,
            timestamp: Date.now(),
          });
        }
        return result;
      })
      .finally(() => {
        pendingChatSummaryRequests.delete(cacheKey);
      });

    pendingChatSummaryRequests.set(cacheKey, request);
    return request;
  },

  // Check if user is participant in chat
  async isUserInChat(
    userId: string,
    chatId: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('ChatParticipant')
      .select('id')
      .eq('userId', userId)
      .eq('chatId', chatId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }
    return !!data;
  },

  // Get or create direct message chat between two users
  async getOrCreateDirectChat(user1Id: string, user2Id: string) {
    const { data: userDirectChats, error: directChatsError } =
      await supabase
        .from('ChatParticipant')
        .select(
          `
          chatId,
          Chat!ChatParticipant_chatId_fkey (
            id,
            isGroup
          )
        `,
        )
        .eq('userId', user1Id);

    if (directChatsError) throw new Error(directChatsError.message);

    const directChatIds = (userDirectChats || [])
      .filter((participant) => !participant.Chat?.isGroup)
      .map((participant) => participant.chatId);

    if (directChatIds.length > 0) {
      const { data: directParticipant, error: participantError } =
        await supabase
          .from('ChatParticipant')
          .select(
            `
            chatId,
            Chat!ChatParticipant_chatId_fkey (
              id,
              isGroup,
              name,
              createdById,
              createdAt
            )
          `,
          )
          .eq('userId', user2Id)
          .in('chatId', directChatIds)
          .limit(1)
          .maybeSingle();

      if (participantError) {
        throw new Error(participantError.message);
      }

      if (directParticipant?.Chat) {
        return directParticipant.Chat;
      }
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

    clearChatCaches(newChat.id);
    return newChat;
  },

  // Real-time message subscription
  subscribeToMessages(
    chatId: string,
    callback: MessageSubscriptionCallback,
  ) {
    const broadcastMessageIds = new Set<string>();
    const channel = supabase
      .channel(`messages:${chatId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      // Listen for broadcast messages (faster, no database query needed)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const message = payload.payload as MessageWithUser;
        broadcastMessageIds.add(message.id);
        setTimeout(() => {
          broadcastMessageIds.delete(message.id);
        }, 10000);
        callback(message);
      })
      // Fallback to postgres_changes for reliability
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `chatId=eq.${chatId}`,
        },
        async (payload) => {
          try {
            if (broadcastMessageIds.has(payload.new.id as string)) {
              return;
            }

            // Fetch the complete message with user data
            const { data, error } = await supabase
              .from('Message')
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
              `,
              )
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('Error fetching message data:', error);
              return;
            }

            if (data) {
              callback(data as unknown as MessageWithUser);
            }
          } catch (err) {
            console.error(
              'Error in message subscription callback:',
              err,
            );
          }
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('Subscription error:', err);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error(
            'Error subscribing to messages for chat:',
            chatId,
          );
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription timed out for chat:', chatId);
        }
      });

    return channel;
  },

  // Typing indicators
  subscribeToTyping(
    chatId: string,
    onTypingUpdate: TypingSubscriptionCallback,
  ) {
    const channel = supabase
      .channel(`typing:${chatId}`)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const typingUsers: TypingUser[] = [];

        Object.values(presenceState).forEach((presences) => {
          presences.forEach((presence: SupabasePresenceState) => {
            if (
              presence.typing &&
              typeof presence.user_id === 'string' &&
              typeof presence.user_name === 'string'
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
      .on('presence', { event: 'join' }, () => {
        // console.log('join', key, newPresences);
      })
      .on('presence', { event: 'leave' }, () => {
        // console.log('leave', key, leftPresences);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // channel.track({ online_at: new Date().toISOString() });
        }
      });

    return channel;
  },

  // Send typing indicator
  async sendTypingIndicator(
    chatId: string,
    userId: string,
    userName: string,
    isTyping: boolean,
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
      .from('ChatParticipant')
      .update({ lastReadAt: new Date().toISOString() } as Record<
        string,
        unknown
      >)
      .eq('chatId', chatId)
      .eq('userId', userId);

    if (error) throw new Error(error.message);
    clearChatCaches(chatId);
    notifyUnreadCountInvalidated();
    return true;
  },

  /** Number of chats that have unread messages for the user (for nav badge). */
  async getUnreadCount(userId: string): Promise<number> {
    const { data: participants, error } = await supabase
      .from('ChatParticipant')
      .select(
        `
        chatId,
        lastReadAt,
        Chat!ChatParticipant_chatId_fkey (
          lastMessageAt,
          Message!Chat_lastMessageId_fkey (
            senderId
          )
        )
      `,
      )
      .eq('userId', userId);

    if (error || !participants?.length) return 0;

    return participants.filter((participant) => {
      const row = participant as {
        lastReadAt?: string | null;
        Chat?: {
          lastMessageAt?: string | null;
          Message?: { senderId?: string | null } | null;
        } | null;
      };
      const lastMessageAt = row.Chat?.lastMessageAt;
      const lastMessageSenderId = row.Chat?.Message?.senderId;

      if (!lastMessageAt || lastMessageSenderId === userId) {
        return false;
      }

      if (!row.lastReadAt) {
        return true;
      }

      return new Date(lastMessageAt) > new Date(row.lastReadAt);
    }).length;
  },

  // Create a group chat
  async createGroupChat(
    createdById: string,
    name: string,
    userIds: string[],
  ) {
    const adminUserId = await this.getFirstAdminUserId();

    // Create the chat
    const chat = await this.createChat({
      id: crypto.randomUUID(),
      createdById,
      isGroup: true,
      name,
      isAdminVisible: true,
    });

    // Add admin user to group chat if admin exists
    if (adminUserId) {
      const isAdminAlreadyIncluded =
        userIds.includes(adminUserId) || createdById === adminUserId;
      if (!isAdminAlreadyIncluded) {
        await this.addChatParticipant(chat.id, adminUserId, true);
      }
    }

    // Add creator as admin participant (if not already admin user)
    if (createdById !== adminUserId) {
      await this.addChatParticipant(chat.id, createdById, true);
    }

    // Add all other participants
    await Promise.all(
      userIds
        .filter((userId) => userId !== adminUserId) // Don't add admin twice
        .map((userId) =>
          this.addChatParticipant(chat.id, userId, false),
        ),
    );

    clearChatCaches(chat.id);
    return chat;
  },

  // Edit a message
  async editMessage(
    messageId: string,
    newText: string,
  ): Promise<MessageWithUser> {
    const { data, error } = await supabase
      .from('Message')
      .update({ text: newText })
      .eq('id', messageId)
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
      `,
      )
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to edit message');
    clearChatCaches(data.chatId);
    return data as unknown as MessageWithUser;
  },

  // Delete a message
  async deleteMessage(messageId: string): Promise<boolean> {
    const { data: existingMessage, error: lookupError } = await supabase
      .from('Message')
      .select('chatId')
      .eq('id', messageId)
      .single();

    if (lookupError) throw new Error(lookupError.message);

    const { error } = await supabase
      .from('Message')
      .delete()
      .eq('id', messageId);

    if (error) throw new Error(error.message);
    if (existingMessage?.chatId) {
      await refreshChatLatestMessageMetadata(existingMessage.chatId);
      clearChatCaches(existingMessage.chatId);
      notifyUnreadCountInvalidated();
    }
    return true;
  },

  // Get message by ID
  async getMessage(messageId: string): Promise<MessageWithUser> {
    const { data, error } = await supabase
      .from('Message')
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
      `,
      )
      .eq('id', messageId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Message not found');
    return data as unknown as MessageWithUser;
  },
};
