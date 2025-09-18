"use client";

import { ChatMessage, MessageWithUser, TypingUser } from "@/@types/message";
import { mediaService } from "@/services/supabase/media";
import { messageService } from "@/services/supabase/messages";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseChatMessagesProps {
  chatId: string;
}

export function useChatMessages({ chatId }: UseChatMessagesProps) {
  const { data: session } = useSession();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [editText, setEditText] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const typingSubscriptionRef = useRef<{
    unsubscribe: () => void;
  } | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const formatMessageTime = useCallback((date: Date): string => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } else if (diffInHours < 48) {
      return `Yesterday ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
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

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.2
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (err) {
      console.log("Could not play notification sound:", err);
    }
  }, [soundEnabled]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;

    try {
      setLoading(true);
      setError(null);

      console.log("Fetching messages for chat:", chatId);
      const chatMessages = await messageService.getChatMessages(chatId);
      console.log("Fetched messages:", chatMessages);

      const transformedMessages: ChatMessage[] = chatMessages.map((msg) => ({
        id: msg.id,
        text: msg.text,
        imageUrl: msg.imageUrl,
        videoUrl:
          (msg as MessageWithUser & { videoUrl?: string }).videoUrl || null,
        author: msg.senderId === session?.user?.id ? "me" : "other",
        senderId: msg.senderId,
        senderName: msg.User?.fullName || "Unknown",
        senderAvatar: msg.User?.profileImageKey,
        createdAtLabel: formatMessageTime(new Date(msg.createdAt)),
        createdAt: msg.createdAt,
      }));

      setMessages(transformedMessages);
      console.log("Messages set, loading should be false now");

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
        });
      }, 100);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      console.log("Setting loading to false");
      setLoading(false);
    }
  }, [chatId, session?.user?.id, formatMessageTime]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!chatId) {
      console.log("No chatId provided, skipping subscription setup");
      return;
    }

    console.log("Setting up realtime subscription for chat:", chatId);
    console.log("Current session user ID:", session?.user?.id);

    if (subscriptionRef.current) {
      console.log("Cleaning up existing message subscription");
      subscriptionRef.current.unsubscribe();
    }
    if (typingSubscriptionRef.current) {
      console.log("Cleaning up existing typing subscription");
      typingSubscriptionRef.current.unsubscribe();
    }

    const subscription = messageService.subscribeToMessages(
      chatId,
      (newMessage: MessageWithUser) => {
        console.log("New message received:", newMessage);
        const transformedMessage: ChatMessage = {
          id: newMessage.id,
          text: newMessage.text,
          imageUrl: newMessage.imageUrl,
          videoUrl:
            (newMessage as MessageWithUser & { videoUrl?: string }).videoUrl ||
            null,
          author: newMessage.senderId === session?.user?.id ? "me" : "other",
          senderId: newMessage.senderId,
          senderName: newMessage.User?.fullName || "Unknown",
          senderAvatar: newMessage.User?.profileImageKey,
          createdAtLabel: formatMessageTime(new Date(newMessage.createdAt)),
          createdAt: newMessage.createdAt,
        };

        setMessages((prev) => {
          const existingIndex = prev.findIndex(
            (msg) => msg.id === transformedMessage.id
          );

          if (existingIndex !== -1) {
            console.log("Updating existing message with real data");
            const updatedMessages = [...prev];
            updatedMessages[existingIndex] = transformedMessage;
            return updatedMessages;
          }

          console.log("Adding new message to chat");
          const newMessages = [...prev, transformedMessage];

          if (transformedMessage.author === "other") {
            playNotificationSound();
          }

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({
              behavior: "smooth",
            });
          }, 100);

          return newMessages;
        });
      }
    );

    const typingSubscription = messageService.subscribeToTyping(
      chatId,
      (typingUsers) => {
        const otherTypingUsers = typingUsers.filter(
          (user) => user.userId !== session?.user?.id
        );
        setTypingUsers(otherTypingUsers);
      }
    );

    subscriptionRef.current = subscription;
    typingSubscriptionRef.current = typingSubscription;

    return () => {
      if (subscriptionRef.current) {
        console.log("Cleaning up realtime subscription");
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (typingSubscriptionRef.current) {
        console.log("Cleaning up typing subscription");
        typingSubscriptionRef.current.unsubscribe();
        typingSubscriptionRef.current = null;
      }
    };
  }, [chatId, session?.user?.id, playNotificationSound, formatMessageTime]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !session?.user?.id || !chatId || sending) return;

    const messageText = message.trim();
    const messageId = crypto.randomUUID();
    const currentTime = new Date().toISOString();

    try {
      setSending(true);

      if (isTyping) {
        setIsTyping(false);
        await messageService.sendTypingIndicator(
          chatId,
          session.user.id,
          session.user.name || "User",
          false
        );
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const optimisticMessage: ChatMessage = {
        id: messageId,
        text: messageText,
        imageUrl: null,
        videoUrl: null,
        author: "me",
        senderId: session.user.id,
        senderName: session.user.name || "You",
        senderAvatar: session.user.image || "",
        createdAtLabel: formatMessageTime(new Date(currentTime)),
        createdAt: currentTime,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setMessage("");

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
        });
      }, 100);

      await messageService.sendMessage({
        id: messageId,
        chatId: chatId,
        senderId: session.user.id!,
        text: messageText,
      });
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setMessage(messageText);
    } finally {
      setSending(false);
    }
  }, [
    message,
    session?.user?.id,
    session?.user?.name,
    session?.user?.image,
    chatId,
    sending,
    isTyping,
    formatMessageTime,
  ]);

  const handleTyping = useCallback(
    async (text: string) => {
      if (!session?.user?.id || !chatId) return;

      const wasTyping = isTyping;
      const shouldBeTyping = text.length > 0;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (shouldBeTyping && !wasTyping) {
        setIsTyping(true);
        await messageService.sendTypingIndicator(
          chatId,
          session.user.id,
          session.user.name || "User",
          true
        );
      } else if (!shouldBeTyping && wasTyping) {
        setIsTyping(false);
        await messageService.sendTypingIndicator(
          chatId,
          session.user.id,
          session.user.name || "User",
          false
        );
      }

      if (shouldBeTyping) {
        typingTimeoutRef.current = setTimeout(async () => {
          if (isTyping && chatId && session?.user?.id) {
            setIsTyping(false);
            await messageService.sendTypingIndicator(
              chatId,
              session.user.id,
              session.user.name || "User",
              false
            );
          }
        }, 3000);
      }
    },
    [session?.user?.id, session?.user?.name, chatId, isTyping]
  );

  const handleEditMessage = useCallback((message: ChatMessage) => {
    setEditingMessage(message);
    setEditText(message.text || "");
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      await messageService.editMessage(editingMessage.id, editText.trim());

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessage.id ? { ...msg, text: editText.trim() } : msg
        )
      );

      setShowEditModal(false);
      setEditingMessage(null);
      setEditText("");
    } catch (err) {
      console.error("Error editing message:", err);
    }
  }, [editingMessage, editText]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      await messageService.deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  }, []);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingMessage(null);
    setEditText("");
  }, []);

  const handleMediaSelect = useCallback((files: File[]) => {
    // Validate all files
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file, index) => {
      const validation = mediaService.validateFile(file);
      if (!validation.valid) {
        errors.push(`File ${index + 1}: ${validation.error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      alert(errors.join("\n"));
    }

    if (validFiles.length > 0) {
      setSelectedMedia((prev) => [...prev, ...validFiles]);
    }
  }, []);

  const handleSendMedia = useCallback(async () => {
    if (
      !selectedMedia ||
      selectedMedia.length === 0 ||
      !session?.user?.id ||
      !chatId ||
      uploadingMedia
    )
      return;

    const currentTime = new Date().toISOString();
    const messageIds: string[] = [];

    try {
      setUploadingMedia(true);

      // Upload all media files first
      const uploadResults = await mediaService.uploadMultipleMedia(
        selectedMedia
      );

      // Create messages for each uploaded file
      const messagePromises = selectedMedia.map(async (file, index) => {
        const messageId = crypto.randomUUID();
        messageIds.push(messageId);

        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        const uploadResult = uploadResults[index];

        // Create optimistic message
        const optimisticMessage: ChatMessage = {
          id: messageId,
          text: null,
          imageUrl: isImage ? uploadResult.publicUrl : null,
          videoUrl: isVideo ? uploadResult.publicUrl : null,
          author: "me",
          senderId: session.user.id!,
          senderName: session.user.name || "You",
          senderAvatar: session.user.image || "",
          createdAtLabel: formatMessageTime(new Date(currentTime)),
          createdAt: currentTime,
        };

        // Send message with media
        await messageService.sendMessage({
          id: messageId,
          chatId: chatId,
          senderId: session.user.id!,
          text: "",
          imageUrl: isImage ? uploadResult.publicUrl : null,
          videoUrl: isVideo ? uploadResult.publicUrl : null,
        });

        return optimisticMessage;
      });

      // Wait for all messages to be sent
      const optimisticMessages = await Promise.all(messagePromises);

      // Add all messages to the chat
      setMessages((prev) => [...prev, ...optimisticMessages]);
      setSelectedMedia([]);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error sending media messages:", err);
      // Remove failed messages
      setMessages((prev) => prev.filter((msg) => !messageIds.includes(msg.id)));
      alert("Failed to send media. Please try again.");
    } finally {
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
      if (selectedMedia && selectedMedia[index]) {
        // Revoke the preview URL for the specific file
        mediaService.revokePreviewUrl(
          URL.createObjectURL(selectedMedia[index])
        );
        // Remove the file from the array
        setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [selectedMedia]
  );

  useEffect(() => {
    if (chatId && session?.user?.id) {
      fetchMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [chatId, session?.user?.id, fetchMessages, setupRealtimeSubscription]);

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        console.log("Component unmounting, cleaning up subscription");
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (typingSubscriptionRef.current) {
        console.log("Component unmounting, cleaning up typing subscription");
        typingSubscriptionRef.current.unsubscribe();
        typingSubscriptionRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    // State
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
    selectedMedia,
    uploadingMedia,

    // Actions
    handleSend,
    handleTyping,
    handleEditMessage,
    handleSaveEdit,
    handleDeleteMessage,
    closeEditModal,
    fetchMessages,
    formatMessageTime,
    handleMediaSelect,
    handleSendMedia,
    handleRemoveMedia,
  };
}
