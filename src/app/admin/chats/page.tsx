"use client";

import { TopNavbar, TOP_NAVBAR_HEIGHT_PX } from "@/components/element/TopNavbar";
import { BUCKET_NAME, supabase } from "@/client/supabase";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  rem,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";

type ChatParticipant = {
  id: string;
  userId: string;
  isAdmin: boolean;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
    status: string;
  };
};

type Chat = {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
  };
  ChatParticipant: ChatParticipant[];
  latestMessage: {
    id: string;
    text: string | null;
    createdAt: string;
    User: {
      fullName: string;
    };
  } | null;
};

export default function AdminChatsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [filterType, setFilterType] = useState<"all" | "group" | "direct">("all");
  const [modalOpened, setModalOpened] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [addUserModalOpened, setAddUserModalOpened] = useState(false);
  const [removeUserModalOpened, setRemoveUserModalOpened] = useState(false);
  const [userIdToAdd, setUserIdToAdd] = useState("");
  const [userIdToRemove, setUserIdToRemove] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/chats");
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/feed");
          return;
        }
        throw new Error("Failed to fetch chats");
      }
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error("Error fetching chats:", error);
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถโหลดรายการแชทได้",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      setLoadingMessages(true);
      const response = await fetch(`/api/admin/chats/${chatId}/messages`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error("Error fetching messages:", error);
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถโหลดข้อความได้",
        color: "red",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleViewChat = (chat: GroupChat) => {
    setSelectedChat(chat);
    setModalOpened(true);
    fetchMessages(chat.id);
  };

  const handleAddUser = async () => {
    if (!selectedChat || !userIdToAdd.trim()) {
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: "กรุณากรอก User ID",
        color: "red",
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/chats/${selectedChat.id}/add-member`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userIdToAdd.trim() }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add user");
      }

      notifications.show({
        title: "สำเร็จ",
        message: "เพิ่มผู้ใช้เข้าห้องแชทแล้ว",
        color: "green",
      });

      setUserIdToAdd("");
      setAddUserModalOpened(false);
      fetchChats();
      if (selectedChat) {
        const updatedChat = { ...selectedChat };
        // Refresh chat data
        fetchChats();
      }
    } catch (error: any) {
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: error.message || "ไม่สามารถเพิ่มผู้ใช้ได้",
        color: "red",
      });
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedChat || !userIdToRemove.trim()) {
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: "กรุณาเลือกผู้ใช้",
        color: "red",
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/chats/${selectedChat.id}/remove-member`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userIdToRemove.trim() }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove user");
      }

      notifications.show({
        title: "สำเร็จ",
        message: "ลบผู้ใช้ออกจากห้องแชทแล้ว",
        color: "green",
      });

      setUserIdToRemove("");
      setRemoveUserModalOpened(false);
      fetchChats();
    } catch (error: any) {
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: error.message || "ไม่สามารถลบผู้ใช้ได้",
        color: "red",
      });
    }
  };

  const getProfileImageUrl = (profileImageKey: string | null) => {
    if (!profileImageKey) return null;
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(profileImageKey);
    return data.publicUrl;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Box>
        <TopNavbar title="จัดการแชท" showBack />
        <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <TopNavbar title="จัดการแชท" showBack />
      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="md" mb="md">
          <SegmentedControl
            value={filterType}
            onChange={(value) => setFilterType(value as "all" | "group" | "direct")}
            data={[
              { label: "ทั้งหมด", value: "all" },
              { label: "แชทกลุ่ม", value: "group" },
              { label: "แชทเดี่ยว", value: "direct" },
            ]}
            fullWidth
            styles={{
              root: { backgroundColor: "#1a1a1a" },
            }}
          />
        </Stack>
        <ScrollArea h={`calc(100vh - ${rem(TOP_NAVBAR_HEIGHT_PX + 160)})`}>
          <Stack gap="md" pb="xl">
            {(() => {
              const filteredChats = chats.filter((chat) => {
                if (filterType === "all") return true;
                if (filterType === "group") return chat.isGroup;
                if (filterType === "direct") return !chat.isGroup;
                return true;
              });

              if (filteredChats.length === 0) {
                return (
                  <Text c="dimmed" ta="center" py="xl">
                    {filterType === "all"
                      ? "ไม่มีแชท"
                      : filterType === "group"
                      ? "ไม่มีแชทกลุ่ม"
                      : "ไม่มีแชทเดี่ยว"}
                  </Text>
                );
              }

              return filteredChats.map((chat) => {
                // For direct chats, show participant names
                let chatDisplayName = chat.name;
                if (!chat.isGroup && !chat.name) {
                  const participantNames = chat.ChatParticipant.map(
                    (p) => p.User.fullName || p.User.username
                  ).join(", ");
                  chatDisplayName = participantNames || "แชทเดี่ยว";
                }

                return (
                <Card
                  key={chat.id}
                  padding="md"
                  radius="md"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    cursor: "pointer",
                  }}
                  onClick={() => handleViewChat(chat)}
                >
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text fw={600} size="lg" c="white">
                          {chatDisplayName}
                        </Text>
                        <Badge
                          size="sm"
                          color={chat.isGroup ? "blue" : "gray"}
                          variant="light"
                        >
                          {chat.isGroup ? "แชทกลุ่ม" : "แชทเดี่ยว"}
                        </Badge>
                      </Group>
                      <Badge color="blue" variant="light">
                        {chat.ChatParticipant.length} คน
                      </Badge>
                    </Group>
                    {chat.latestMessage && (
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {chat.latestMessage.User.fullName}:{" "}
                        {chat.latestMessage.text || "[รูปภาพ]"}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      สร้างเมื่อ: {formatDate(chat.createdAt)}
                    </Text>
                    </Stack>
                </Card>
                );
              });
            })()}
          </Stack>
        </ScrollArea>
      </Container>

      {/* Chat Detail Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setSelectedChat(null);
          setMessages([]);
        }}
        title={selectedChat?.name || "รายละเอียดแชท"}
        size="lg"
        styles={{
          content: { backgroundColor: "#0F0F0F" },
          header: { backgroundColor: "#0F0F0F" },
          body: { backgroundColor: "#0F0F0F" },
        }}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600} c="white">
              สมาชิก ({selectedChat?.ChatParticipant.length || 0} คน)
            </Text>
            {selectedChat?.isGroup && (
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setAddUserModalOpened(true)}
                >
                  เพิ่มผู้ใช้
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={() => setRemoveUserModalOpened(true)}
                >
                  ลบผู้ใช้
                </Button>
              </Group>
            )}
          </Group>

          <ScrollArea h={300}>
            <Stack gap="xs">
              {selectedChat?.ChatParticipant.map((participant) => (
                <Group key={participant.id} justify="space-between">
                  <Group gap="xs">
                    <Avatar
                      src={getProfileImageUrl(participant.User.profileImageKey)}
                      size="sm"
                      radius="xl"
                    />
                    <Text size="sm" c="white">
                      {participant.User.fullName}
                    </Text>
                    {participant.isAdmin && (
                      <Badge size="xs" color="blue">
                        แอดมิน
                      </Badge>
                    )}
                  </Group>
                  <Badge
                    size="xs"
                    color={
                      participant.User.status === "ACTIVE"
                        ? "green"
                        : participant.User.status === "SUSPENDED"
                        ? "red"
                        : "gray"
                    }
                  >
                    {participant.User.status === "ACTIVE"
                      ? "ใช้งาน"
                      : participant.User.status === "SUSPENDED"
                      ? "พักการใช้งาน"
                      : "ไม่ใช้งาน"}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </ScrollArea>

          <Divider />

          <Text fw={600} c="white">
            ข้อความล่าสุด
          </Text>
          {loadingMessages ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : (
            <ScrollArea h={300}>
              <Stack gap="xs">
                {messages.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    ไม่มีข้อความ
                  </Text>
                ) : (
                  messages
                    .slice()
                    .reverse()
                    .map((message) => (
                      <Box
                        key={message.id}
                        p="xs"
                        style={{
                          backgroundColor: "#1a1a1a",
                          borderRadius: "8px",
                        }}
                      >
                        <Group gap="xs" mb={4}>
                          <Text size="xs" fw={600} c="white">
                            {message.User?.fullName || "Unknown"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatDate(message.createdAt)}
                          </Text>
                        </Group>
                        <Text size="sm" c="white">
                          {message.text || "[รูปภาพ]"}
                        </Text>
                      </Box>
                    ))
                )}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Modal>

      {/* Add User Modal */}
      <Modal
        opened={addUserModalOpened}
        onClose={() => {
          setAddUserModalOpened(false);
          setUserIdToAdd("");
        }}
        title="เพิ่มผู้ใช้เข้าห้องแชท"
        styles={{
          content: { backgroundColor: "#0F0F0F" },
          header: { backgroundColor: "#0F0F0F" },
          body: { backgroundColor: "#0F0F0F" },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="User ID"
            placeholder="กรอก User ID"
            value={userIdToAdd}
            onChange={(e) => setUserIdToAdd(e.target.value)}
            styles={{
              input: { backgroundColor: "#131313", borderColor: "#333" },
            }}
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setAddUserModalOpened(false);
                setUserIdToAdd("");
              }}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleAddUser}>เพิ่ม</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Remove User Modal */}
      <Modal
        opened={removeUserModalOpened}
        onClose={() => {
          setRemoveUserModalOpened(false);
          setUserIdToRemove("");
        }}
        title="ลบผู้ใช้ออกจากห้องแชท"
        styles={{
          content: { backgroundColor: "#0F0F0F" },
          header: { backgroundColor: "#0F0F0F" },
          body: { backgroundColor: "#0F0F0F" },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="User ID"
            placeholder="กรอก User ID"
            value={userIdToRemove}
            onChange={(e) => setUserIdToRemove(e.target.value)}
            styles={{
              input: { backgroundColor: "#131313", borderColor: "#333" },
            }}
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setRemoveUserModalOpened(false);
                setUserIdToRemove("");
              }}
            >
              ยกเลิก
            </Button>
            <Button color="red" onClick={handleRemoveUser}>
              ลบ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

