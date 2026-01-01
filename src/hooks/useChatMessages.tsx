// hooks/useChatMessages.ts
'use client';

import { BUCKET_NAME, supabase } from '@/client/supabase';
import {
  ChatMessage,
  MessageWithUser,
  TypingUser,
} from '@/@types/message';
import { mediaService } from '@/services/supabase/media';
import { messageService } from '@/services/supabase/messages';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseChatMessagesProps {
  chatId: string;
}

export function useChatMessages({ chatId }: UseChatMessagesProps) {
  const { data: session } = useSession();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const [editingMessage, setEditingMessage] =
    useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(true);

  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [loadingOlderMessages, setLoadingOlderMessages] =
    useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(
    null
  );
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Guard: current active chat id (prevents stale callbacks)
  const activeChatIdRef = useRef<string>('');
  useEffect(() => {
    activeChatIdRef.current = chatId;
  }, [chatId]);

  const formatMessageTime = useCallback((date: Date): string => {
    const now = new Date();
    const diffInHours =
      (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffInHours < 48) {
      return `Yesterday ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(
        800,
        audioContext.currentTime
      );
      oscillator.frequency.setValueAtTime(
        600,
        audioContext.currentTime + 0.1
      );

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.2
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Reset per-room state when chatId changes (prevents room mix UI)
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    setIsTyping(false);
    setHasOlderMessages(true);
    setLoadingOlderMessages(false);
    setError(null);

    // also stop pending typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [chatId]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;

    const currentChatId = chatId;

    try {
      setLoading(true);
      setError(null);

      const chatMessages = await messageService.getChatMessages(
        currentChatId
      );

      // Guard async: if switched rooms while waiting, ignore
      if (activeChatIdRef.current !== currentChatId) return;

      const transformedMessages: ChatMessage[] = chatMessages
        .reverse()
        .map((msg: MessageWithUser) => {
          let senderAvatarUrl: string | null = null;

          if (msg.User?.profileImageKey) {
            const { data: imageData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(msg.User.profileImageKey);
            senderAvatarUrl = imageData.publicUrl;
          }

          return {
            id: msg.id,
            text: msg.text,
            imageUrl: (msg as any).imageUrl ?? null,
            videoUrl: (msg as any).videoUrl ?? null,
            author:
              msg.senderId === session?.user?.id ? 'me' : 'other',
            senderId: msg.senderId,
            senderName: msg.User?.fullName || 'Unknown',
            senderAvatar: senderAvatarUrl,
            senderIsVerified: msg.User?.isVerified || false,
            senderRole: msg.User?.role || 'USER',
            createdAtLabel: formatMessageTime(
              new Date(msg.createdAt)
            ),
            createdAt: msg.createdAt,
          };
        });

      setMessages(transformedMessages);
      setHasOlderMessages(chatMessages.length >= 50);

      setTimeout(() => {
        if (activeChatIdRef.current !== currentChatId) return;
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
        });
      }, 100);
    } catch (err) {
      if (activeChatIdRef.current !== currentChatId) return;
      setError(
        err instanceof Error ? err.message : 'Failed to load messages'
      );
    } finally {
      if (activeChatIdRef.current === currentChatId)
        setLoading(false);
    }
  }, [chatId, session?.user?.id, formatMessageTime]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !chatId ||
      loadingOlderMessages ||
      !hasOlderMessages ||
      messages.length === 0
    )
      return;

    const currentChatId = chatId;

    try {
      setLoadingOlderMessages(true);

      const oldestMessage = messages[0];

      const { messages: olderMessages, hasMore } =
        await messageService.getOlderMessages(
          currentChatId,
          oldestMessage.id,
          20
        );

      // Guard async
      if (activeChatIdRef.current !== currentChatId) return;

      if (olderMessages.length === 0) {
        setHasOlderMessages(false);
        return;
      }

      const transformedOlderMessages: ChatMessage[] =
        olderMessages.map((msg: MessageWithUser) => {
          let senderAvatarUrl: string | null = null;
          if (msg.User?.profileImageKey) {
            const { data: imageData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(msg.User.profileImageKey);
            senderAvatarUrl = imageData.publicUrl;
          }
          return {
            id: msg.id,
            text: msg.text,
            imageUrl: (msg as any).imageUrl ?? null,
            videoUrl: (msg as any).videoUrl ?? null,
            author:
              msg.senderId === session?.user?.id ? 'me' : 'other',
            senderId: msg.senderId,
            senderName: msg.User?.fullName || 'Unknown',
            senderAvatar: senderAvatarUrl,
            senderIsVerified: msg.User?.isVerified || false,
            senderRole: msg.User?.role || 'USER',
            createdAtLabel: formatMessageTime(
              new Date(msg.createdAt)
            ),
            createdAt: msg.createdAt,
          };
        });

      const container = messagesContainerRef.current;
      if (container) {
        scrollPositionRef.current =
          container.scrollHeight - container.scrollTop;
      }

      setMessages((prev) => [...transformedOlderMessages, ...prev]);
      setHasOlderMessages(hasMore);

      setTimeout(() => {
        if (activeChatIdRef.current !== currentChatId) return;
        if (container) {
          container.scrollTop =
            container.scrollHeight - scrollPositionRef.current;
        }
      }, 100);
    } catch (err) {
      // ignore or set error
    } finally {
      if (activeChatIdRef.current === currentChatId)
        setLoadingOlderMessages(false);
    }
  }, [
    chatId,
    messages,
    loadingOlderMessages,
    hasOlderMessages,
    session?.user?.id,
    formatMessageTime,
  ]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!chatId) return;

    // unsubscribe old
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;

    const currentChatId = chatId;

    const subscription = messageService.subscribeToMessages(
      currentChatId,
      (newMessage: MessageWithUser) => {
        // Guard: ignore events if room changed
        if (activeChatIdRef.current !== currentChatId) return;

        // Guard: ensure payload chatId matches (if service provides it)
        if (newMessage.chatId && newMessage.chatId !== currentChatId)
          return;

        let senderAvatarUrl: string | null = null;
        if (newMessage.User?.profileImageKey) {
          const { data: imageData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(newMessage.User.profileImageKey);
          senderAvatarUrl = imageData.publicUrl;
        }

        const transformedMessage: ChatMessage = {
          id: newMessage.id,
          text: newMessage.text,
          imageUrl: (newMessage as any).imageUrl ?? null,
          videoUrl: (newMessage as any).videoUrl ?? null,
          author:
            newMessage.senderId === session?.user?.id
              ? 'me'
              : 'other',
          senderId: newMessage.senderId,
          senderName: newMessage.User?.fullName || 'Unknown',
          senderAvatar: senderAvatarUrl,
          senderIsVerified: newMessage.User?.isVerified || false,
          senderRole: (newMessage.User?.role as any) || 'USER',
          createdAtLabel: formatMessageTime(
            new Date(newMessage.createdAt)
          ),
          createdAt: newMessage.createdAt,
        };

        setMessages((prev) => {
          // Guard inside setState too (extra safe)
          if (activeChatIdRef.current !== currentChatId) return prev;

          const idx = prev.findIndex(
            (m) => m.id === transformedMessage.id
          );
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = transformedMessage;
            return copy;
          }

          const next = [...prev, transformedMessage];

          if (transformedMessage.author === 'other')
            playNotificationSound();

          setTimeout(() => {
            if (activeChatIdRef.current !== currentChatId) return;
            messagesEndRef.current?.scrollIntoView({
              behavior: 'smooth',
            });
          }, 100);

          return next;
        });
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [
    chatId,
    session?.user?.id,
    playNotificationSound,
    formatMessageTime,
  ]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !session?.user?.id || !chatId || sending)
      return;

    const currentChatId = chatId;
    const messageText = message.trim();
    const messageId = crypto.randomUUID();
    const currentTime = new Date().toISOString();

    try {
      setSending(true);

      const optimisticMessage: ChatMessage = {
        id: messageId,
        text: messageText,
        imageUrl: null,
        videoUrl: null,
        author: 'me',
        senderId: session.user.id,
        senderName: session.user.name || 'You',
        senderAvatar: session.user.image || '',
        createdAtLabel: formatMessageTime(new Date(currentTime)),
        createdAt: currentTime,
      };

      setMessages((prev) => {
        if (activeChatIdRef.current !== currentChatId) return prev;
        return [...prev, optimisticMessage];
      });

      setMessage('');

      setTimeout(() => {
        if (activeChatIdRef.current !== currentChatId) return;
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
        });
      }, 100);

      await messageService.sendMessage({
        id: messageId,
        chatId: currentChatId,
        senderId: session.user.id!,
        text: messageText,
      });
    } catch (err) {
      // revert optimistic only if still same room
      if (activeChatIdRef.current === currentChatId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setMessage(messageText);
      }
    } finally {
      if (activeChatIdRef.current === currentChatId)
        setSending(false);
    }
  }, [
    message,
    session?.user?.id,
    session?.user?.name,
    session?.user?.image,
    chatId,
    sending,
    formatMessageTime,
  ]);

  const handleTyping = useCallback(async (_text: string) => {
    // (คุณคอมเมนต์ typing timeout ไว้แล้ว — โค้ดนี้ปล่อยไว้เฉยๆ)
    // ถ้าจะใช้ typing indicator ให้ใช้ void messageService.sendTypingIndicator(...) พร้อม guard currentChatId
    return;
  }, []);

  const handleEditMessage = useCallback((m: ChatMessage) => {
    setEditingMessage(m);
    setEditText(m.text || '');
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      await messageService.editMessage(
        editingMessage.id,
        editText.trim()
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessage.id
            ? { ...msg, text: editText.trim() }
            : msg
        )
      );

      setShowEditModal(false);
      setEditingMessage(null);
      setEditText('');
    } catch {
      // ignore
    }
  }, [editingMessage, editText]);

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!confirm('Are you sure you want to delete this message?'))
        return;

      try {
        await messageService.deleteMessage(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } catch {
        // ignore
      }
    },
    []
  );

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingMessage(null);
    setEditText('');
  }, []);

  const handleMediaSelect = useCallback((files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file, index) => {
      const validation = mediaService.validateFile(file);
      if (!validation.valid)
        errors.push(`File ${index + 1}: ${validation.error}`);
      else validFiles.push(file);
    });

    if (errors.length > 0) alert(errors.join('\n'));
    if (validFiles.length > 0)
      setSelectedMedia((prev) => [...prev, ...validFiles]);
  }, []);

  const handleSendMedia = useCallback(async () => {
    if (
      !selectedMedia.length ||
      !session?.user?.id ||
      !chatId ||
      uploadingMedia
    )
      return;

    const currentChatId = chatId;
    const currentTime = new Date().toISOString();
    const messageIds: string[] = [];

    try {
      setUploadingMedia(true);

      const uploadResults = await mediaService.uploadMultipleMedia(
        selectedMedia
      );

      const optimisticMessages = await Promise.all(
        selectedMedia.map(async (file, index) => {
          const messageId = crypto.randomUUID();
          messageIds.push(messageId);

          const isVideo = file.type.startsWith('video/');
          const isImage = file.type.startsWith('image/');
          const uploadResult = uploadResults[index];

          const optimistic: ChatMessage = {
            id: messageId,
            text: null,
            imageUrl: isImage ? uploadResult.publicUrl : null,
            videoUrl: isVideo ? uploadResult.publicUrl : null,
            author: 'me',
            senderId: session.user.id!,
            senderName: session.user.name || 'You',
            senderAvatar: session.user.image || '',
            createdAtLabel: formatMessageTime(new Date(currentTime)),
            createdAt: currentTime,
          };

          await messageService.sendMessage({
            id: messageId,
            chatId: currentChatId,
            senderId: session.user.id!,
            text: '',
            imageUrl: optimistic.imageUrl,
            videoUrl: optimistic.videoUrl,
          });

          return optimistic;
        })
      );

      if (activeChatIdRef.current !== currentChatId) return;

      setMessages((prev) => [...prev, ...optimisticMessages]);
      setSelectedMedia([]);

      setTimeout(() => {
        if (activeChatIdRef.current !== currentChatId) return;
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
        });
      }, 100);
    } catch (err) {
      if (activeChatIdRef.current === currentChatId) {
        setMessages((prev) =>
          prev.filter((m) => !messageIds.includes(m.id))
        );
        alert('Failed to send media. Please try again.');
      }
    } finally {
      if (activeChatIdRef.current === currentChatId)
        setUploadingMedia(false);
    }
  }, [
    selectedMedia,
    session?.user?.id,
    session?.user?.name,
    session?.user?.image,
    chatId,
    uploadingMedia,
    formatMessageTime,
  ]);

  const handleRemoveMedia = useCallback(
    (index: number) => {
      if (selectedMedia[index]) {
        mediaService.revokePreviewUrl(
          URL.createObjectURL(selectedMedia[index])
        );
        setSelectedMedia((prev) =>
          prev.filter((_, i) => i !== index)
        );
      }
    },
    [selectedMedia]
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (
        container.scrollTop < 100 &&
        hasOlderMessages &&
        !loadingOlderMessages
      ) {
        void loadOlderMessages();
      }
    },
    [hasOlderMessages, loadingOlderMessages, loadOlderMessages]
  );

  useEffect(() => {
    if (chatId && session?.user?.id) {
      void fetchMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [
    chatId,
    session?.user?.id,
    fetchMessages,
    setupRealtimeSubscription,
  ]);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    message,
    setMessage,
    messages,
    loading,
    sending,
    error,
    typingUsers,

    editingMessage,
    editText,
    setEditText,
    showEditModal,
    soundEnabled,
    setSoundEnabled,

    messagesEndRef,
    messagesContainerRef,

    selectedMedia,
    uploadingMedia,
    loadingOlderMessages,
    hasOlderMessages,

    handleSend,
    handleTyping,
    handleEditMessage,
    handleSaveEdit,
    handleDeleteMessage,
    closeEditModal,
    fetchMessages,
    loadOlderMessages,
    handleScroll,
    formatMessageTime,
    handleMediaSelect,
    handleSendMedia,
    handleRemoveMedia,
  };
}
