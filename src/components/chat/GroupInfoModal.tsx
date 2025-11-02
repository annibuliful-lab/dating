"use client";

import { userService } from "@/services/supabase/users";
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  rem,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface User {
  id: string;
  fullName: string;
  username: string;
  profileImageKey: string | null;
  age: number | null;
  gender: string | null;
}

interface ChatParticipant {
  id: string;
  userId: string;
  isAdmin: boolean;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
    status: string | null;
  };
}

interface GroupInfoModalProps {
  opened: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string | null;
  isGroup: boolean;
  onNameUpdated?: (newName: string) => void;
}

export function GroupInfoModal({
  opened,
  onClose,
  chatId,
  chatName,
  isGroup,
  onNameUpdated,
}: GroupInfoModalProps) {
  const { data: session } = useSession();
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(chatName || "");
  const [savingName, setSavingName] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("members");

  // Invite user states
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  // Sync chatName prop with local state
  useEffect(() => {
    setNewName(chatName || "");
  }, [chatName]);

  // Fetch participants
  useEffect(() => {
    if (opened) {
      fetchParticipants();
    }
  }, [opened, chatId]);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/chat/${chatId}/participants`);
      if (!response.ok) throw new Error("Failed to fetch participants");
      const data = await response.json();
      setParticipants(data);
    } catch (error) {
      console.error("Error fetching participants:", error);
      notifications.show({
        title: "Error",
        message: "Failed to load participants",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Search for users to invite
  useEffect(() => {
    const searchForUsers = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await userService.searchUsers(debouncedSearch);
        // Filter out users who are already participants
        const participantIds = participants.map((p) => p.userId);
        const filteredResults = results.filter(
          (user) => !participantIds.includes(user.id)
        );
        setSearchResults(filteredResults);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setSearching(false);
      }
    };

    if (activeTab === "add") {
      searchForUsers();
    }
  }, [debouncedSearch, participants, activeTab]);

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      notifications.show({
        title: "Error",
        message: "Chat name cannot be empty",
        color: "red",
      });
      return;
    }

    setSavingName(true);
    try {
      const response = await fetch(`/api/chat/${chatId}/update-name`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update chat name");
      }

      notifications.show({
        title: "Success",
        message: "Chat name updated successfully",
        color: "green",
      });
      setEditingName(false);

      // Notify parent component of the name change
      if (onNameUpdated) {
        onNameUpdated(newName.trim());
      }
    } catch (error) {
      console.error("Error updating chat name:", error);
      notifications.show({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Failed to update chat name",
        color: "red",
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (userId === session?.user?.id) {
      notifications.show({
        title: "Error",
        message: "You cannot remove yourself from the chat",
        color: "red",
      });
      return;
    }

    setRemovingUserId(userId);
    try {
      const response = await fetch(`/api/chat/${chatId}/remove-member`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      // Update participants list
      setParticipants(participants.filter((p) => p.userId !== userId));

      notifications.show({
        title: "Success",
        message: "Member removed successfully",
        color: "green",
      });
    } catch (error) {
      console.error("Error removing member:", error);
      notifications.show({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Failed to remove member",
        color: "red",
      });
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleInviteUser = async (userId: string) => {
    setInviting(userId);
    try {
      const response = await fetch(`/api/chat/${chatId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite user");
      }

      // Refresh participants list
      await fetchParticipants();

      // Remove from search results
      setSearchResults(searchResults.filter((u) => u.id !== userId));

      notifications.show({
        title: "Success",
        message: "User invited successfully",
        color: "green",
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      notifications.show({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Failed to invite user",
        color: "red",
      });
    } finally {
      setInviting(null);
    }
  };

  const handleClose = () => {
    setEditingName(false);
    setNewName(chatName || "");
    setSearchTerm("");
    setSearchResults([]);
    setActiveTab("members");
    onClose();
  };

  const currentUserIsAdmin = participants.find(
    (p) => p.userId === session?.user?.id
  )?.isAdmin;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isGroup ? "Group Info" : "Conversation Info"}
      size="md"
      centered
    >
      <Stack gap="md">
        {/* Chat Name Section */}
        {isGroup && (
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Group Name
            </Text>
            {editingName ? (
              <Group gap="xs">
                <TextInput
                  value={newName}
                  onChange={(e) => setNewName(e.currentTarget.value)}
                  placeholder="Enter group name"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUpdateName();
                    } else if (e.key === "Escape") {
                      setEditingName(false);
                      setNewName(chatName || "");
                    }
                  }}
                />
                <Button
                  onClick={handleUpdateName}
                  loading={savingName}
                  size="sm"
                >
                  Save
                </Button>
                <Button
                  variant="subtle"
                  onClick={() => {
                    setEditingName(false);
                    setNewName(chatName || "");
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
              </Group>
            ) : (
              <Group justify="space-between">
                <Text size="lg" fw={500}>
                  {chatName || "Unnamed Group"}
                </Text>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setEditingName(true)}
                >
                  Edit
                </Button>
              </Group>
            )}
            <Divider my="md" />
          </Box>
        )}

        {/* Tabs for Members and Add */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab value="members">Members ({participants.length})</Tabs.Tab>
            <Tabs.Tab value="add">Add Members</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="members" pt="md">
            <ScrollArea h={rem(400)}>
              <Stack gap="xs">
                {loading ? (
                  <Center py="xl">
                    <Loader size="md" />
                  </Center>
                ) : participants.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    No members found
                  </Text>
                ) : (
                  participants.map((participant) => (
                    <Box
                      key={participant.id}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #e0e0e0",
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                          <Avatar
                            src={
                              participant.User.profileImageKey
                                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-images/${participant.User.profileImageKey}`
                                : null
                            }
                            alt={participant.User.fullName}
                            size="md"
                            radius="xl"
                          >
                            {participant.User.fullName.charAt(0).toUpperCase()}
                          </Avatar>
                          <div>
                            <Group gap="xs">
                              <Text size="sm" fw={500}>
                                {participant.User.fullName}
                              </Text>
                              {participant.userId === session?.user?.id && (
                                <Text size="xs" c="dimmed">
                                  (You)
                                </Text>
                              )}
                              {participant.isAdmin && (
                                <Text size="xs" c="blue" fw={600}>
                                  Admin
                                </Text>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              @{participant.User.username}
                            </Text>
                          </div>
                        </Group>
                        {currentUserIsAdmin &&
                          participant.userId !== session?.user?.id && (
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() =>
                                handleRemoveMember(participant.userId)
                              }
                              loading={removingUserId === participant.userId}
                            >
                              ✕
                            </ActionIcon>
                          )}
                      </Group>
                    </Box>
                  ))
                )}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="add" pt="md">
            <Stack gap="md">
              <TextInput
                placeholder="Search by name or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                size="md"
              />

              <ScrollArea h={rem(400)}>
                <Stack gap="xs">
                  {searching && (
                    <Center py="xl">
                      <Loader size="md" />
                    </Center>
                  )}

                  {!searching &&
                    searchTerm.length > 0 &&
                    searchTerm.length < 2 && (
                      <Text size="sm" c="dimmed" ta="center" py="xl">
                        Type at least 2 characters to search
                      </Text>
                    )}

                  {!searching &&
                    debouncedSearch.length >= 2 &&
                    searchResults.length === 0 && (
                      <Text size="sm" c="dimmed" ta="center" py="xl">
                        No users found
                      </Text>
                    )}

                  {searchResults.map((user) => (
                    <Box
                      key={user.id}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #e0e0e0",
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                          <Avatar
                            src={
                              user.profileImageKey
                                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-images/${user.profileImageKey}`
                                : null
                            }
                            alt={user.fullName}
                            size="md"
                            radius="xl"
                          >
                            {user.fullName.charAt(0).toUpperCase()}
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500}>
                              {user.fullName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              @{user.username}
                              {user.age &&
                                user.gender &&
                                ` • ${user.age} • ${user.gender}`}
                            </Text>
                          </div>
                        </Group>
                        <Button
                          size="sm"
                          onClick={() => handleInviteUser(user.id)}
                          loading={inviting === user.id}
                        >
                          Add
                        </Button>
                      </Group>
                    </Box>
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Modal>
  );
}
