"use client";

import { BUCKET_NAME, supabase } from "@/client/supabase";
import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { UserPlusIcon } from "@/components/icons/UserPlusIcon";
// Using a simple refresh icon from Mantine
import { messageService } from "@/services/supabase/messages";
import { userService } from "@/services/supabase/users";
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Flex,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  rem,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
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
    profileImageUrl?: string | null;
  }>;
  latestMessage?: {
    text: string | null;
    createdAt: string;
    senderId: string;
  };
};

type UserSearchResult = {
  id: string;
  fullName: string;
  username: string | null;
  profileImageKey: string | null;
  profileImageUrl?: string | null;
  age: number | null;
  gender: string | null;
};

function InboxPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [isGroupChatMode, setIsGroupChatMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupChatName, setGroupChatName] = useState("");

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

          // Determine if unread based on lastReadAt vs latest message
          const unread = chat.hasUnread || false;

          return {
            id: chat.id,
            name: chatName,
            preview,
            dateLabel,
            unread,
            participants: otherParticipants
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((p: any) => {
                let profileImageUrl = null;
                if (p.User?.profileImageKey) {
                  const { data: imageData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(p.User.profileImageKey);
                  profileImageUrl = imageData.publicUrl;
                }
                return {
                  id: p.userId,
                  fullName: p.User?.fullName || "Unknown",
                  profileImageKey: p.User?.profileImageKey || null,
                  profileImageUrl,
                };
              }),
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

  // Auto-refresh chat list every 2 minutes (Facebook-style)
  useEffect(() => {
    if (!session?.user?.id) return;

    const interval = setInterval(() => {
      fetchUserChats();
    }, 120000); // Refresh every 2 minutes to prevent rate limiting

    return () => clearInterval(interval);
  }, [session?.user?.id, fetchUserChats]);

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

  const handleChatClick = async (chatId: string) => {
    // Mark messages as read when opening chat
    if (session?.user?.id) {
      try {
        await messageService.markMessagesAsRead(chatId, session.user.id);
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    }
    router.push(`/inbox/${chatId}`);
  };

  const handleRefresh = () => {
    fetchUserChats();
  };

  // Search users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        // If no search query, show active users
        try {
          setSearchLoading(true);
          const users = await userService.getActiveUsers();
          // Filter out current user and convert profileImageKey to URL
          const filteredUsers = users
            .filter((user) => user.id !== session?.user?.id)
            .map((user) => {
              let profileImageUrl = null;
              if (user.profileImageKey) {
                const { data: imageData } = supabase.storage
                  .from(BUCKET_NAME)
                  .getPublicUrl(user.profileImageKey);
                profileImageUrl = imageData.publicUrl;
              }
              return {
                ...user,
                profileImageUrl,
              };
            });
          setSearchResults(filteredUsers);
        } catch (err) {
          console.error("Error fetching users:", err);
        } finally {
          setSearchLoading(false);
        }
        return;
      }

      try {
        setSearchLoading(true);
        const results = await userService.searchUsers(searchQuery);
        // Filter out current user and convert profileImageKey to URL
        const filteredResults = results
          .filter((user) => user.id !== session?.user?.id)
          .map((user) => {
            let profileImageUrl = null;
            if (user.profileImageKey) {
              const { data: imageData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(user.profileImageKey);
              profileImageUrl = imageData.publicUrl;
            }
            return {
              ...user,
              profileImageUrl,
            };
          });
        setSearchResults(filteredResults);
      } catch (err) {
        console.error("Error searching users:", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, session?.user?.id]);

  const handleStartChat = async (userId: string) => {
    if (!session?.user?.id) return;

    if (isGroupChatMode) {
      // Add to selected users
      if (!selectedUsers.includes(userId)) {
        setSelectedUsers([...selectedUsers, userId]);
      }
      return;
    }

    try {
      setCreatingChat(true);
      // Get or create direct chat
      const chat = await messageService.getOrCreateDirectChat(
        session.user.id,
        userId
      );
      // Close modal and navigate to chat
      close();
      router.push(`/inbox/${chat.id}`);
    } catch (err) {
      console.error("Error creating chat:", err);
      alert("Failed to start chat. Please try again.");
    } finally {
      setCreatingChat(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (!session?.user?.id || selectedUsers.length === 0) {
      alert("Please select at least one user to create a group chat");
      return;
    }

    if (!groupChatName.trim()) {
      alert("Please enter a group name");
      return;
    }

    try {
      setCreatingChat(true);
      const chat = await messageService.createGroupChat(
        session.user.id,
        groupChatName.trim(),
        selectedUsers
      );
      // Close modal and navigate to chat
      close();
      setIsGroupChatMode(false);
      setSelectedUsers([]);
      setGroupChatName("");
      router.push(`/inbox/${chat.id}`);
    } catch (err) {
      console.error("Error creating group chat:", err);
      alert("Failed to create group chat. Please try again.");
    } finally {
      setCreatingChat(false);
    }
  };

  const handleOpenModal = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsGroupChatMode(false);
    setSelectedUsers([]);
    setGroupChatName("");
    open();
  };

  const handleToggleGroupChatMode = () => {
    setIsGroupChatMode(!isGroupChatMode);
    setSelectedUsers([]);
    setGroupChatName("");
  };

  const handleRemoveSelectedUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((id) => id !== userId));
  };

  if (status === "loading" || loading) {
    return (
      <Box>
        <TopNavbar
          title="Inbox"
          rightSlot={
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleOpenModal}
              disabled={status !== "authenticated"}
            >
              <UserPlusIcon />
            </ActionIcon>
          }
        />
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
        <TopNavbar
          title="Inbox"
          rightSlot={
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleOpenModal}
              disabled={status !== "authenticated"}
            >
              <UserPlusIcon />
            </ActionIcon>
          }
        />
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
      <TopNavbar
        title="Inbox"
        rightSlot={
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleRefresh}
              loading={loading}
            >
              <Text size="lg">↻</Text>
            </ActionIcon>
            <ActionIcon variant="subtle" size="lg" onClick={handleOpenModal}>
              <UserPlusIcon />
            </ActionIcon>
          </Group>
        }
      />
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
                  <Group wrap="nowrap" align="flex-start" gap="md" w="100%">
                    {/* Avatar - show first participant's avatar or default */}
                    <Avatar
                      radius="xl"
                      color="gray"
                      size={62}
                      src={chat.participants[0]?.profileImageUrl || undefined}
                    >
                      {chat.participants[0]?.fullName?.charAt(0) || "?"}
                    </Avatar>

                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      <Group
                        justify="space-between"
                        wrap="nowrap"
                        align="flex-start"
                      >
                        <Text
                          fw={700}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={chat.name}
                          w={200}
                        >
                          {chat.name}
                        </Text>
                        <Flex justify="end" direction="column" align="end">
                          <Text
                            c="dimmed"
                            size="sm"
                            style={{
                              flexShrink: 0,
                              marginLeft: "8px",
                            }}
                          >
                            {chat.dateLabel}
                          </Text>
                          {/* Unread dot */}
                          <Box
                            mt={rem(10)}
                            w={8}
                            h={8}
                            style={{
                              borderRadius: 9999,
                              background: chat.unread
                                ? "#ef4444"
                                : "transparent",
                            }}
                          />
                        </Flex>
                      </Group>
                      <Text c="white" size="md" lineClamp={2}>
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

      {/* New Chat Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={isGroupChatMode ? "Create Group Chat" : "Start New Chat"}
        size="md"
        centered
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {isGroupChatMode ? "Group Chat" : "Direct Chat"}
            </Text>
            <Button
              variant={isGroupChatMode ? "filled" : "outline"}
              size="xs"
              onClick={handleToggleGroupChatMode}
            >
              {isGroupChatMode ? "Switch to Direct" : "Create Group"}
            </Button>
          </Group>

          {isGroupChatMode && (
            <TextInput
              placeholder="Enter group name..."
              value={groupChatName}
              onChange={(e) => setGroupChatName(e.currentTarget.value)}
              required
            />
          )}

          {isGroupChatMode && selectedUsers.length > 0 && (
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Selected Users ({selectedUsers.length})
              </Text>
              <Stack gap="xs">
                {selectedUsers.map((userId) => {
                  const user = searchResults.find((u) => u.id === userId);
                  if (!user) return null;
                  return (
                    <Group key={userId} justify="space-between">
                      <Group gap="xs">
                        <Avatar
                          src={user.profileImageUrl || undefined}
                          alt={user.fullName}
                          radius="xl"
                          size={30}
                        >
                          {user.fullName?.charAt(0) || "?"}
                        </Avatar>
                        <Text size="sm">{user.fullName}</Text>
                      </Group>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        size="sm"
                        onClick={() => handleRemoveSelectedUser(userId)}
                      >
                        ✕
                      </ActionIcon>
                    </Group>
                  );
                })}
              </Stack>
            </Box>
          )}

          <TextInput
            placeholder="Search users by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />

          {searchLoading ? (
            <Center py="xl">
              <Loader size="md" />
            </Center>
          ) : searchResults.length === 0 ? (
            <Center py="xl">
              <Text c="dimmed" size="sm">
                {searchQuery.trim()
                  ? "No users found"
                  : "No active users available"}
              </Text>
            </Center>
          ) : (
            <Stack gap="xs" mah={400} style={{ overflowY: "auto" }}>
                  {searchResults.map((user) => (
                    <Box
                      key={user.id}
                      p="sm"
                      style={{
                        cursor: "pointer",
                        borderRadius: "8px",
                        border: "1px solid #373A40",
                        transition: "background-color 0.2s",
                        opacity: isGroupChatMode && selectedUsers.includes(user.id) ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#25262b";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      onClick={() => handleStartChat(user.id)}
                    >
                      <Group wrap="nowrap" justify="space-between">
                        <Group wrap="nowrap">
                          <Avatar
                            src={user.profileImageUrl || undefined}
                            alt={user.fullName}
                            radius="xl"
                            size={50}
                          >
                            {user.fullName?.charAt(0) || "?"}
                          </Avatar>
                          <Stack gap={2}>
                            <Text fw={600}>{user.fullName}</Text>
                            <Group gap="xs">
                              {user.username && (
                                <Text c="dimmed" size="sm">
                                  @{user.username}
                                </Text>
                              )}
                              {user.age && (
                                <Text c="dimmed" size="sm">
                                  • {user.age} years
                                </Text>
                              )}
                              {user.gender && (
                                <Text c="dimmed" size="sm">
                                  • {user.gender}
                                </Text>
                              )}
                            </Group>
                          </Stack>
                        </Group>
                        {isGroupChatMode && selectedUsers.includes(user.id) && (
                          <Text c="blue" size="sm" fw={600}>
                            ✓
                          </Text>
                        )}
                      </Group>
                    </Box>
                  ))}
            </Stack>
          )}

          {isGroupChatMode && selectedUsers.length > 0 && (
            <Button
              onClick={handleCreateGroupChat}
              loading={creatingChat}
              disabled={!groupChatName.trim() || selectedUsers.length === 0}
              fullWidth
            >
              Create Group Chat ({selectedUsers.length} members)
            </Button>
          )}

          {creatingChat && !isGroupChatMode && (
            <Center>
              <Loader size="sm" />
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}

export default InboxPage;
