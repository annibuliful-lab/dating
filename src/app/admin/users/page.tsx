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
  Group,
  Loader,
  Modal,
  rem,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";

type User = {
  id: string;
  username: string;
  name: string | null;
  lastname: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  isVerified: boolean;
  verificationType: "ADMIN" | "USER" | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [verificationFilter, setVerificationFilter] = useState<string | null>(
    null
  );
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [newVerificationStatus, setNewVerificationStatus] = useState<boolean>(
    false
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, statusFilter, verificationFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter) params.append("status", statusFilter);
      if (verificationFilter !== null)
        params.append("isVerified", verificationFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/feed");
          return;
        }
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถโหลดรายการผู้ใช้ได้",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedUser) return;

    try {
      const updateData: { status?: string; isVerified?: boolean } = {};
      if (newStatus) updateData.status = newStatus;
      if (newVerificationStatus !== selectedUser.isVerified)
        updateData.isVerified = newVerificationStatus;

      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user status");
      }

      notifications.show({
        title: "สำเร็จ",
        message: "อัปเดตสถานะผู้ใช้แล้ว",
        color: "green",
      });

      setModalOpened(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: error.message || "ไม่สามารถอัปเดตสถานะได้",
        color: "red",
      });
    }
  };

  const handleOpenModal = (user: User) => {
    setSelectedUser(user);
    setNewStatus(user.status);
    setNewVerificationStatus(user.isVerified);
    setModalOpened(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "green";
      case "SUSPENDED":
        return "red";
      case "INACTIVE":
        return "gray";
      default:
        return "gray";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "ใช้งานปกติ";
      case "SUSPENDED":
        return "พักการใช้งานชั่วคราว";
      case "INACTIVE":
        return "ไม่มีการใช้งาน";
      default:
        return status;
    }
  };

  const getVerificationLabel = (isVerified: boolean) => {
    return isVerified ? "ยืนยันตัวตนแล้ว" : "รอยืนยันตัวตน";
  };

  if (loading) {
    return (
      <Box>
        <TopNavbar title="จัดการผู้ใช้" showBack />
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
      <TopNavbar title="จัดการผู้ใช้" showBack />
      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="md" pb="xl">
          {/* Search and Filters */}
          <Stack gap="xs">
            <TextInput
              placeholder="ค้นหาจากชื่อผู้ใช้, ชื่อ, นามสกุล, เบอร์"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              styles={{
                input: { backgroundColor: "#131313", borderColor: "#333" },
              }}
            />
            <Group gap="xs">
              <Select
                placeholder="สถานะการใช้งาน"
                value={statusFilter}
                onChange={setStatusFilter}
                data={[
                  { value: "ACTIVE", label: "ใช้งานปกติ" },
                  { value: "INACTIVE", label: "ไม่มีการใช้งาน" },
                  { value: "SUSPENDED", label: "พักการใช้งานชั่วคราว" },
                ]}
                clearable
                style={{ flex: 1 }}
                styles={{
                  input: { backgroundColor: "#131313", borderColor: "#333" },
                }}
              />
              <Select
                placeholder="สถานะการยืนยัน"
                value={verificationFilter}
                onChange={setVerificationFilter}
                data={[
                  { value: "true", label: "ยืนยันตัวตนแล้ว" },
                  { value: "false", label: "รอยืนยันตัวตน" },
                ]}
                clearable
                style={{ flex: 1 }}
                styles={{
                  input: { backgroundColor: "#131313", borderColor: "#333" },
                }}
              />
            </Group>
          </Stack>

          {/* Users List */}
          <ScrollArea h={`calc(100vh - ${rem(TOP_NAVBAR_HEIGHT_PX + 200)})`}>
            <Stack gap="md">
              {users.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  ไม่พบผู้ใช้
                </Text>
              ) : (
                users.map((user) => (
                  <Card
                    key={user.id}
                    padding="md"
                    radius="md"
                    style={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                      cursor: "pointer",
                    }}
                    onClick={() => handleOpenModal(user)}
                  >
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={600} size="lg" c="white">
                          {user.fullName}
                        </Text>
                        <Badge
                          color={getStatusColor(user.status)}
                          variant="light"
                        >
                          {getStatusLabel(user.status)}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        @{user.username}
                      </Text>
                      {user.phone && (
                        <Text size="sm" c="dimmed">
                          เบอร์: {user.phone}
                        </Text>
                      )}
                      <Group gap="xs">
                        <Badge
                          color={user.isVerified ? "green" : "yellow"}
                          variant="light"
                          size="sm"
                        >
                          {getVerificationLabel(user.isVerified)}
                        </Badge>
                        {user.verificationType && (
                          <Badge size="sm" variant="light">
                            {user.verificationType === "ADMIN"
                              ? "ยืนยันโดยแอดมิน"
                              : "ยืนยันเอง"}
                          </Badge>
                        )}
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Container>

      {/* Update Status Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setSelectedUser(null);
        }}
        title="ปรับสถานะผู้ใช้"
        styles={{
          content: { backgroundColor: "#0F0F0F" },
          header: { backgroundColor: "#0F0F0F" },
          body: { backgroundColor: "#0F0F0F" },
        }}
      >
        {selectedUser && (
          <Stack gap="md">
            <Text size="sm" c="white">
              ผู้ใช้: {selectedUser.fullName} (@{selectedUser.username})
            </Text>

            <Select
              label="สถานะการใช้งาน"
              value={newStatus}
              onChange={(value) => setNewStatus(value || "")}
              data={[
                { value: "ACTIVE", label: "ใช้งานปกติ" },
                { value: "INACTIVE", label: "ไม่มีการใช้งาน" },
                { value: "SUSPENDED", label: "พักการใช้งานชั่วคราว" },
              ]}
              styles={{
                input: { backgroundColor: "#131313", borderColor: "#333" },
              }}
            />

            <Select
              label="สถานะการยืนยันตัวตน"
              value={newVerificationStatus ? "true" : "false"}
              onChange={(value) =>
                setNewVerificationStatus(value === "true")
              }
              data={[
                { value: "false", label: "รอยืนยันตัวตน" },
                { value: "true", label: "ยืนยันตัวตนแล้ว" },
              ]}
              styles={{
                input: { backgroundColor: "#131313", borderColor: "#333" },
              }}
            />

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => {
                  setModalOpened(false);
                  setSelectedUser(null);
                }}
              >
                ยกเลิก
              </Button>
              <Button onClick={handleUpdateStatus}>บันทึก</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}

