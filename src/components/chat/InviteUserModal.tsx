"use client";

import { userService } from "@/services/supabase/users";
import {
  Avatar,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";

interface User {
  id: string;
  fullName: string;
  username: string;
  profileImageKey: string | null;
  age: number | null;
  gender: string | null;
}

interface InviteUserModalProps {
  opened: boolean;
  onClose: () => void;
  chatId: string;
  currentParticipantIds: string[];
  onInvite: (userId: string) => Promise<void>;
}

export function InviteUserModal({
  opened,
  onClose,
  chatId,
  currentParticipantIds,
  onInvite,
}: InviteUserModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    const searchForUsers = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setUsers([]);
        return;
      }

      setLoading(true);
      try {
        const results = await userService.searchUsers(debouncedSearch);
        // Filter out users who are already participants
        const filteredResults = results.filter(
          (user) => !currentParticipantIds.includes(user.id)
        );
        setUsers(filteredResults);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setLoading(false);
      }
    };

    searchForUsers();
  }, [debouncedSearch, currentParticipantIds]);

  const handleInvite = async (userId: string) => {
    setInviting(userId);
    try {
      await onInvite(userId);
      // Remove the invited user from the list
      setUsers(users.filter((u) => u.id !== userId));
    } catch (error) {
      console.error("Error inviting user:", error);
    } finally {
      setInviting(null);
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setUsers([]);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Invite Users to Chat"
      size="md"
      centered
    >
      <Stack gap="md">
        <TextInput
          placeholder="Search by name or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          size="md"
        />

        {loading && (
          <Center py="xl">
            <Loader size="md" />
          </Center>
        )}

        {!loading && searchTerm.length > 0 && searchTerm.length < 2 && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Type at least 2 characters to search
          </Text>
        )}

        {!loading && debouncedSearch.length >= 2 && users.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No users found
          </Text>
        )}

        <Stack gap="xs">
          {users.map((user) => (
            <UnstyledButton
              key={user.id}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                width: "100%",
              }}
              disabled={inviting === user.id}
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
                  onClick={() => handleInvite(user.id)}
                  loading={inviting === user.id}
                >
                  Invite
                </Button>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </Stack>
    </Modal>
  );
}
