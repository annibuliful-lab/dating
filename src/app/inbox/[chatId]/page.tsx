"use client";

import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { SendIcon } from "@/components/icons/SendIcon";
import { UserPlusIcon } from "@/components/icons/UserPlusIcon";
import { messageService } from "@/services/supabase/messages";
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  rem,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  author: "me" | "other";
  senderId: string;
  senderName: string;
  senderAvatar: string | null | undefined;
  createdAtLabel: string;
  createdAt: string;
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const { data: session, status } = useSession();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<
    { userId: string; userName: string; isTyping: boolean }[]
  >([]);
  const [isTyping, setIsTyping] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [editText, setEditText] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const typingSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(
    null
  );
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!params.chatId) return;

    try {
      setLoading(true);
      setError(null);

      console.log("Fetching messages for chat:", params.chatId);
      const chatMessages = await messageService.getChatMessages(params.chatId);
      console.log("Fetched messages:", chatMessages);

      const transformedMessages: ChatMessage[] = chatMessages.map(
        (msg: {
          id: string;
          text: string | null;
          imageUrl: string | null;
          senderId: string;
          createdAt: string;
          User?: {
            fullName: string;
            profileImageKey: string | null;
          };
        }) => ({
          id: msg.id,
          text: msg.text,
          imageUrl: msg.imageUrl,
          author: msg.senderId === session?.user?.id ? "me" : "other",
          senderId: msg.senderId,
          senderName: msg.User?.fullName || "Unknown",
          senderAvatar: msg.User?.profileImageKey,
          createdAtLabel: formatMessageTime(new Date(msg.createdAt)),
          createdAt: msg.createdAt,
        })
      );

      setMessages(transformedMessages);
      console.log("Messages set, loading should be false now");

      // Scroll to bottom after messages are loaded
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      console.log("Setting loading to false");
      setLoading(false);
    }
  }, [params.chatId, session?.user?.id]);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
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

  const setupRealtimeSubscription = useCallback(() => {
    if (!params.chatId) return;

    // Clean up existing subscriptions
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    if (typingSubscriptionRef.current) {
      typingSubscriptionRef.current.unsubscribe();
    }

    console.log("Setting up realtime subscription for chat:", params.chatId);
    const subscription = messageService.subscribeToMessages(
      params.chatId,
      (newMessage: {
        id: string;
        text: string | null;
        imageUrl: string | null;
        senderId: string;
        createdAt: string;
        User?: {
          fullName: string;
          profileImageKey: string | null;
        };
      }) => {
        console.log("New message received:", newMessage);
        const transformedMessage: ChatMessage = {
          id: newMessage.id,
          text: newMessage.text,
          imageUrl: newMessage.imageUrl,
          author: newMessage.senderId === session?.user?.id ? "me" : "other",
          senderId: newMessage.senderId,
          senderName: newMessage.User?.fullName || "Unknown",
          senderAvatar: newMessage.User?.profileImageKey,
          createdAtLabel: formatMessageTime(new Date(newMessage.createdAt)),
          createdAt: newMessage.createdAt,
        };

        setMessages((prev) => {
          // Check if message already exists to prevent duplicates
          const exists = prev.some((msg) => msg.id === transformedMessage.id);
          if (exists) {
            console.log("Message already exists, not adding duplicate");
            return prev;
          }
          console.log("Adding new message to chat");
          const newMessages = [...prev, transformedMessage];

          // Play notification sound for messages from other users
          if (transformedMessage.author === "other") {
            playNotificationSound();
          }

          // Auto-scroll to bottom when new message arrives
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);

          return newMessages;
        });
      }
    );

    // Setup typing indicators subscription
    const typingSubscription = messageService.subscribeToTyping(
      params.chatId,
      (typingUsers) => {
        // Filter out current user from typing indicators
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
  }, [params.chatId, session?.user?.id, playNotificationSound]);

  useEffect(() => {
    console.log("useEffect running with:", {
      status,
      userId: session?.user?.id,
      chatId: params.chatId,
    });

    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated" && session?.user?.id && params.chatId) {
      console.log("Fetching messages and setting up subscription");
      fetchMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [
    status,
    session?.user?.id,
    params.chatId,
    fetchMessages,
    setupRealtimeSubscription,
    router,
  ]);

  // Cleanup subscription on unmount
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

  const formatMessageTime = (date: Date): string => {
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
  };

  const handleSend = async () => {
    if (!message.trim() || !session?.user?.id || !params.chatId || sending)
      return;

    try {
      setSending(true);

      // Stop typing indicator when sending message
      if (isTyping) {
        setIsTyping(false);
        await messageService.sendTypingIndicator(
          params.chatId,
          session.user.id,
          session.user.name || "User",
          false
        );
      }

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      await messageService.sendMessage({
        id: crypto.randomUUID(),
        chatId: params.chatId,
        senderId: session.user.id,
        text: message.trim(),
      });

      setMessage("");

      // Scroll to bottom after sending message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error sending message:", err);
      // Could show a toast notification here
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = useCallback(
    async (text: string) => {
      if (!session?.user?.id || !params.chatId) return;

      const wasTyping = isTyping;
      const shouldBeTyping = text.length > 0;

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (shouldBeTyping && !wasTyping) {
        // Start typing
        setIsTyping(true);
        await messageService.sendTypingIndicator(
          params.chatId,
          session.user.id,
          session.user.name || "User",
          true
        );
      } else if (!shouldBeTyping && wasTyping) {
        // Stop typing immediately
        setIsTyping(false);
        await messageService.sendTypingIndicator(
          params.chatId,
          session.user.id,
          session.user.name || "User",
          false
        );
      }

      if (shouldBeTyping) {
        // Set timeout to stop typing after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(async () => {
          if (isTyping && params.chatId && session?.user?.id) {
            setIsTyping(false);
            await messageService.sendTypingIndicator(
              params.chatId,
              session.user.id,
              session.user.name || "User",
              false
            );
          }
        }, 3000);
      }
    },
    [session?.user?.id, session?.user?.name, params.chatId, isTyping]
  );

  const handleEditMessage = (message: ChatMessage) => {
    setEditingMessage(message);
    setEditText(message.text || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      await messageService.editMessage(editingMessage.id, editText.trim());

      // Update local message
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
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      await messageService.deleteMessage(messageId);

      // Remove message from local state
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Box>
        <TopNavbar title="Chat" showBack rightSlot={<UserPlusIcon />} />
        <Container
          size="xs"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
          pb={rem(90)}
        >
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <TopNavbar title="Chat" showBack rightSlot={<UserPlusIcon />} />
        <Container
          size="xs"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
          pb={rem(90)}
        >
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="red" ta="center">
                {error}
              </Text>
              <Text
                c="blue"
                style={{ cursor: "pointer" }}
                onClick={fetchMessages}
              >
                Try again
              </Text>
            </Stack>
          </Center>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <TopNavbar
        title="Chat"
        showBack
        rightSlot={
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setSoundEnabled(!soundEnabled)}
              color={soundEnabled ? "blue" : "gray"}
            >
              <Text size="lg">{soundEnabled ? "🔊" : "🔇"}</Text>
            </ActionIcon>
            <UserPlusIcon />
          </Group>
        }
      />

      <Container size="xs" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)} pb={rem(90)}>
        <Stack gap="lg">
          {messages.length === 0 ? (
            <Center py="xl">
              <Text c="dimmed" ta="center">
                No messages yet. Start the conversation!
              </Text>
            </Center>
          ) : (
            messages.map((m, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showAvatar =
                m.author === "other" &&
                (!prevMessage || prevMessage.senderId !== m.senderId);
              const showTimestamp =
                !prevMessage ||
                new Date(m.createdAt).getTime() -
                  new Date(prevMessage.createdAt).getTime() >
                  5 * 60 * 1000; // 5 minutes

              return (
                <Box key={m.id}>
                  {showTimestamp && (
                    <Center my="md">
                      <Text
                        c="dimmed"
                        size="xs"
                        style={{
                          backgroundColor: "#0F0F0F",
                          padding: "4px 12px",
                          borderRadius: 12,
                          border: "1px solid var(--mantine-color-dark-4)",
                        }}
                      >
                        {formatMessageTime(new Date(m.createdAt))}
                      </Text>
                    </Center>
                  )}

                  {m.author === "other" ? (
                    <Group align="flex-start" gap="md" wrap="nowrap">
                      {showAvatar ? (
                        <Avatar
                          radius="xl"
                          color="gray"
                          size={40}
                          src={m.senderAvatar}
                        />
                      ) : (
                        <Box w={40} />
                      )}
                      <Stack gap={4} style={{ flex: 1 }}>
                        {showAvatar && (
                          <Text fw={600} size="sm" c="dimmed">
                            {m.senderName}
                          </Text>
                        )}
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <Box
                              p="md"
                              bg="#2A2A2A"
                              style={{
                                borderRadius: showAvatar
                                  ? "16px 16px 16px 4px"
                                  : "16px 16px 16px 4px",
                                maxWidth: "85%",
                                position: "relative",
                                cursor: "pointer",
                              }}
                            >
                              {m.text && (
                                <Text style={{ wordBreak: "break-word" }}>
                                  {m.text}
                                </Text>
                              )}
                              {m.imageUrl && (
                                <Image
                                  src={m.imageUrl}
                                  alt="Message attachment"
                                  width={300}
                                  height={200}
                                  style={{
                                    maxWidth: "100%",
                                    borderRadius: 8,
                                    objectFit: "cover",
                                    marginTop: m.text ? 8 : 0,
                                  }}
                                />
                              )}
                            </Box>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {m.senderId === session?.user?.id && (
                              <>
                                <Menu.Item onClick={() => handleEditMessage(m)}>
                                  Edit
                                </Menu.Item>
                                <Menu.Item
                                  color="red"
                                  onClick={() => handleDeleteMessage(m.id)}
                                >
                                  Delete
                                </Menu.Item>
                              </>
                            )}
                            <Menu.Item>Copy</Menu.Item>
                            <Menu.Item>Reply</Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Stack>
                    </Group>
                  ) : (
                    <Stack gap={4} align="flex-end">
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <Box
                            p="md"
                            bg="#FFD700"
                            c="#191919"
                            style={{
                              borderRadius: "16px 16px 4px 16px",
                              maxWidth: "85%",
                              position: "relative",
                              cursor: "pointer",
                            }}
                          >
                            {m.text && (
                              <Text style={{ wordBreak: "break-word" }}>
                                {m.text}
                              </Text>
                            )}
                            {m.imageUrl && (
                              <Image
                                src={m.imageUrl}
                                alt="Message attachment"
                                width={300}
                                height={200}
                                style={{
                                  maxWidth: "100%",
                                  borderRadius: 8,
                                  objectFit: "cover",
                                  marginTop: m.text ? 8 : 0,
                                }}
                              />
                            )}
                          </Box>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item onClick={() => handleEditMessage(m)}>
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            onClick={() => handleDeleteMessage(m.id)}
                          >
                            Delete
                          </Menu.Item>
                          <Menu.Item>Copy</Menu.Item>
                          <Menu.Item>Reply</Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Stack>
                  )}
                </Box>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </Stack>
      </Container>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <Box
          pos="fixed"
          left={0}
          right={0}
          bottom={rem(90)}
          bg="#0F0F0F"
          style={{
            borderTop: "1px solid var(--mantine-color-dark-4)",
          }}
        >
          <Container size="xs" px="md" py="xs">
            <Text c="dimmed" size="sm" style={{ fontStyle: "italic" }}>
              {typingUsers.length === 1
                ? `${typingUsers[0].userName} is typing...`
                : `${typingUsers
                    .map((u) => u.userName)
                    .join(", ")} are typing...`}
            </Text>
          </Container>
        </Box>
      )}

      <Box
        pos="fixed"
        left={0}
        right={0}
        bottom={0}
        bg="#0F0F0F"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--mantine-color-dark-4)",
        }}
      >
        <Container size="xs" px="md" py="sm">
          <Group align="center" gap="sm">
            <TextInput
              value={message}
              onChange={(e) => {
                setMessage(e.currentTarget.value);
                handleTyping(e.currentTarget.value);
              }}
              onKeyDown={handleKeyPress}
              placeholder="Message"
              style={{ flex: 1 }}
              radius="xl"
              size="md"
              disabled={sending}
            />
            <ActionIcon
              size={40}
              radius="xl"
              variant="subtle"
              onClick={handleSend}
              disabled={!message.trim() || sending}
              loading={sending}
            >
              <SendIcon />
            </ActionIcon>
          </Group>
        </Container>
      </Box>

      {/* Edit Message Modal */}
      <Modal
        opened={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingMessage(null);
          setEditText("");
        }}
        title="Edit Message"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            value={editText}
            onChange={(e) => setEditText(e.currentTarget.value)}
            placeholder="Edit your message..."
            size="md"
          />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                setShowEditModal(false);
                setEditingMessage(null);
                setEditText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editText.trim()}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
