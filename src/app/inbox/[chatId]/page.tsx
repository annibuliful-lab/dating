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
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  rem,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  author: "me" | "other";
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
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
  const subscriptionRef = useRef<any>(null);

  const fetchMessages = useCallback(async () => {
    if (!params.chatId) return;

    try {
      setLoading(true);
      setError(null);

      console.log("Fetching messages for chat:", params.chatId);
      const chatMessages = await messageService.getChatMessages(params.chatId);
      console.log("Fetched messages:", chatMessages);

      const transformedMessages: ChatMessage[] = chatMessages.map(
        (msg: any) => ({
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
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      console.log("Setting loading to false");
      setLoading(false);
    }
  }, [params.chatId, session?.user?.id]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!params.chatId) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    console.log("Setting up realtime subscription for chat:", params.chatId);
    const subscription = messageService.subscribeToMessages(
      params.chatId,
      (newMessage: any) => {
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
          return [...prev, transformedMessage];
        });
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        console.log("Cleaning up realtime subscription");
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [params.chatId, session?.user?.id]);

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

      await messageService.sendMessage({
        id: crypto.randomUUID(),
        chatId: params.chatId,
        senderId: session.user.id,
        text: message.trim(),
      });

      setMessage("");
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
      <TopNavbar title="Chat" showBack rightSlot={<UserPlusIcon />} />

      <Container size="xs" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)} pb={rem(90)}>
        <Stack gap="lg">
          {messages.length === 0 ? (
            <Center py="xl">
              <Text c="dimmed" ta="center">
                No messages yet. Start the conversation!
              </Text>
            </Center>
          ) : (
            messages.map((m) => (
              <Box key={m.id}>
                {m.author === "other" ? (
                  <Group align="flex-start" gap="md" wrap="nowrap">
                    <Avatar
                      radius="xl"
                      color="gray"
                      size={40}
                      src={m.senderAvatar}
                    />
                    <Stack gap={6} style={{ flex: 1 }}>
                      <Text fw={600} size="sm">
                        {m.senderName}
                      </Text>
                      <Box
                        p="md"
                        bg="#2A2A2A"
                        style={{ borderRadius: 16, maxWidth: "85%" }}
                      >
                        {m.text && <Text>{m.text}</Text>}
                        {m.imageUrl && (
                          <img
                            src={m.imageUrl}
                            alt="Message attachment"
                            style={{ maxWidth: "100%", borderRadius: 8 }}
                          />
                        )}
                      </Box>
                      <Text c="dimmed" size="xs">
                        {m.createdAtLabel}
                      </Text>
                    </Stack>
                  </Group>
                ) : (
                  <Stack gap={6} align="flex-end">
                    <Text c="dimmed" size="xs">
                      {m.createdAtLabel}
                    </Text>
                    <Box
                      p="md"
                      bg="#FFD700"
                      c="#191919"
                      style={{ borderRadius: 16, maxWidth: "85%" }}
                    >
                      {m.text && <Text>{m.text}</Text>}
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="Message attachment"
                          style={{ maxWidth: "100%", borderRadius: 8 }}
                        />
                      )}
                    </Box>
                  </Stack>
                )}
              </Box>
            ))
          )}
        </Stack>
      </Container>

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
              onChange={(e) => setMessage(e.currentTarget.value)}
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
    </Box>
  );
}
