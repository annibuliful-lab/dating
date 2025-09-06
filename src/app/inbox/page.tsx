"use client";

import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { UserPlusIcon } from "@/components/icons/UserPlusIcon";
import { messageService } from "@/services/supabase/messages";
import {
  Avatar,
  Box,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  rem,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ChatPreview = {
  id: string;
  name: string;
  preview: string;
  dateLabel: string;
  unread: boolean;
  participants: Array<{
    id: string;
    fullName: string;
    profileImageKey: string | null;
  }>;
  latestMessage?: {
    text: string | null;
    createdAt: string;
    senderId: string;
  };
};

function InboxPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserChats = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const userChats = await messageService.getUserChats(session.user.id);

      // Transform the data to match our ChatPreview type
      const transformedChats: ChatPreview[] = userChats.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (participant: any) => {
          const chat = participant.Chat;
          const latestMessage = chat.latestMessage;

          // Get other participants (excluding current user)
          const otherParticipants =
            chat.ChatParticipant?.filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (p: any) => p.userId !== session.user.id
            ) || [];

          // Generate chat name based on participants
          let chatName = "Unknown";
          if (chat.isGroup && chat.name) {
            chatName = chat.name;
          } else if (otherParticipants.length > 0) {
            chatName = otherParticipants
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((p: any) => p.User?.fullName || "Unknown")
              .join(", ");
          } else {
            chatName = `Chat ${chat.id.slice(0, 8)}`;
          }

          // Generate preview text
          let preview = "No messages yet";
          if (latestMessage) {
            preview = latestMessage.text || "Media message";
          }

          // Format date
          const dateLabel = latestMessage
            ? formatRelativeDate(new Date(latestMessage.createdAt))
            : "New";

          // Determine if unread (you can implement this logic based on your needs)
          const unread = false; // TODO: Implement unread logic

          return {
            id: chat.id,
            name: chatName,
            preview,
            dateLabel,
            unread,
            participants: otherParticipants
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((p: any) => ({
                id: p.userId,
                fullName: p.User?.fullName || "Unknown",
                profileImageKey: p.User?.profileImageKey || null,
              })),
            latestMessage: latestMessage
              ? {
                  text: latestMessage.text,
                  createdAt: latestMessage.createdAt,
                  senderId: latestMessage.senderId,
                }
              : undefined,
          };
        }
      );

      setChats(transformedChats);
    } catch (err) {
      console.error("Error fetching chats:", err);
      setError(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated" && session?.user?.id) {
      fetchUserChats();
    }
  }, [status, session, router, fetchUserChats]);

  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const handleChatClick = (chatId: string) => {
    router.push(`/inbox/${chatId}`);
  };

  if (status === "loading" || loading) {
    return (
      <Box>
        <TopNavbar title="Inbox" rightSlot={<UserPlusIcon />} />
        <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        </Container>
        <BottomNavbar />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <TopNavbar title="Inbox" rightSlot={<UserPlusIcon />} />
        <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="red" ta="center">
                {error}
              </Text>
              <Text
                c="blue"
                style={{ cursor: "pointer" }}
                onClick={fetchUserChats}
              >
                Try again
              </Text>
            </Stack>
          </Center>
        </Container>
        <BottomNavbar />
      </Box>
    );
  }

  return (
    <Box>
      <TopNavbar title="Inbox" rightSlot={<UserPlusIcon />} />
      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" pb={rem(BOTTOM_NAVBAR_HEIGHT_PX)}>
          {chats.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="md">
                <Text c="dimmed" ta="center">
                  No conversations yet
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  Start chatting with other users to see conversations here
                </Text>
              </Stack>
            </Center>
          ) : (
            chats.map((chat, index) => (
              <Box
                key={chat.id}
                onClick={() => handleChatClick(chat.id)}
                style={{ cursor: "pointer" }}
              >
                <Group align="flex-start" wrap="nowrap" justify="space-between">
                  <Group wrap="nowrap" align="flex-start" gap="md">
                    {/* Unread dot */}
                    <Box
                      mt={rem(10)}
                      w={8}
                      h={8}
                      style={{
                        borderRadius: 9999,
                        background: chat.unread ? "#3B82F6" : "transparent",
                      }}
                    />

                    {/* Avatar - show first participant's avatar or default */}
                    <Avatar
                      radius="xl"
                      color="gray"
                      size={62}
                      src={chat.participants[0]?.profileImageKey}
                    />

                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap">
                        <Text fw={700} style={{ whiteSpace: "nowrap" }}>
                          {chat.name}
                        </Text>
                        <Text c="dimmed" size="sm">
                          {chat.dateLabel}
                        </Text>
                      </Group>
                      <Text c="dimmed" size="sm" lineClamp={2}>
                        {chat.preview}
                      </Text>
                    </Stack>
                  </Group>
                </Group>
                {index < chats.length - 1 && <Divider mt="lg" color="dark.4" />}
              </Box>
            ))
          )}
        </Stack>
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default InboxPage;
