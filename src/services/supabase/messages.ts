import {
  MessageSubscriptionCallback,
  MessageWithUser,
  TypingUser,
  SendMessageData,
  TypingSubscriptionCallback,
} from '@/@types/message';
import { userApi, userApiRead } from '@/services/user-api';

type MessageCursor = { createdAt: string; id: string };
const messageCursors = new Map<string, MessageCursor>();

function poll(task: () => Promise<void>) {
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    try { if (active) await task(); } catch { /* A later poll retries network failures. */ }
    if (active) timer = setTimeout(run, 3000);
  };
  void run();
  return { unsubscribe() { active = false; clearTimeout(timer); } };
}

export const messageService = {
  subscribeToMessages(chatId: string, callback: MessageSubscriptionCallback) {
    let cursor: MessageCursor | null = messageCursors.get(chatId) || null;
    let subscribed = true;
    const subscription = poll(async () => {
      // shortcut: membership-checked polling; use private channels when three-second latency or query volume matters.
      let hasMore = true;
      while (subscribed && hasMore) {
        const update = await userApi<{ messages: MessageWithUser[]; cursor: { createdAt: string; id: string }; hasMore: boolean }>('messages', 'getMessageUpdates', [chatId, cursor]);
        if (!subscribed) return;
        cursor = update.cursor;
        hasMore = update.hasMore;
        for (const row of update.messages) callback(row);
      }
    });
    return { unsubscribe() { subscribed = false; subscription.unsubscribe(); } };
  },
  subscribeToTyping(chatId: string, callback: TypingSubscriptionCallback) {
    let subscribed = true;
    const subscription = poll(async () => {
      const users = await userApi<TypingUser[]>('messages', 'getTyping', [chatId]);
      if (subscribed) callback(users);
    });
    return { unsubscribe() { subscribed = false; subscription.unsubscribe(); } };
  },
  async sendTypingIndicator(chatId: string, userId: string, userName: string, isTyping: boolean) {
    await userApi('messages', 'sendTypingIndicator', [chatId, userId, userName, isTyping]);
  },
  async getChatMessages(chatId: string, limit = 50, offset = 0) {
    const data = await userApi<{ messages: MessageWithUser[]; cursor: MessageCursor }>('messages', 'getChatMessages', [chatId, limit, offset]);
    if (offset === 0) messageCursors.set(chatId, data.cursor);
    return data.messages;
  },
  async getOlderMessages(chatId: string, beforeMessageId: string, limit = 20) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getOlderMessages>>>('messages', 'getOlderMessages', [chatId, beforeMessageId, limit]);
  },
  async sendMessage(messageData: SendMessageData) {
    const result = await userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.sendMessage>>>('messages', 'sendMessage', [messageData]);
    window.dispatchEvent(new Event('unread-count-invalidated'));
    return result;
  },
  async getUserChats(userId: string, options?: { force?: boolean }) {
    return userApiRead<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getUserChats>>>('messages', 'getUserChats', [userId], 0, options?.force);
  },
  async getChatInfo(chatId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getChatInfo>>>('messages', 'getChatInfo', [chatId]);
  },
  async getChatParticipants(chatId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getChatParticipants>>>('messages', 'getChatParticipants', [chatId]);
  },
  async getChatParticipant(chatId: string, userId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getChatParticipant>>>('messages', 'getChatParticipant', [chatId, userId]);
  },
  async getChatParticipantCount(chatId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getChatParticipantCount>>>('messages', 'getChatParticipantCount', [chatId]);
  },
  async getChatSummary(chatId: string, currentUserId: string, options?: { force?: boolean }) {
    return userApiRead<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getChatSummary>>>('messages', 'getChatSummary', [chatId, currentUserId], 0, options?.force);
  },
  async isUserInChat(userId: string, chatId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.isUserInChat>>>('messages', 'isUserInChat', [userId, chatId]);
  },
  async getOrCreateDirectChat(user1Id: string, user2Id: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getOrCreateDirectChat>>>('messages', 'getOrCreateDirectChat', [user1Id, user2Id]);
  },
  async markMessagesAsRead(chatId: string, userId: string) {
    const result = await userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.markMessagesAsRead>>>('messages', 'markMessagesAsRead', [chatId, userId]);
    window.dispatchEvent(new Event('unread-count-invalidated'));
    return result;
  },
  async getUnreadCount(userId: string, force = false) {
    return userApiRead<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getUnreadCount>>>('messages', 'getUnreadCount', [userId], 15000, force);
  },
  async createGroupChat(createdById: string, name: string, userIds: string[]) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.createGroupChat>>>('messages', 'createGroupChat', [createdById, name, userIds]);
  },
  async editMessage(messageId: string, newText: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.editMessage>>>('messages', 'editMessage', [messageId, newText]);
  },
  async deleteMessage(messageId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.deleteMessage>>>('messages', 'deleteMessage', [messageId]);
  },
  async getMessage(messageId: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/messages').messageService.getMessage>>>('messages', 'getMessage', [messageId]);
  },
};
