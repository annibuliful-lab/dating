"use client";

import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import {
  Box,
  Button,
  Container,
  Group,
  Loader,
  rem,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
  id: string;
  username: string;
  name: string | null;
  lastname: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  role: "USER" | "ADMIN";
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type StatusType = "verification" | "usage" | "account";

export default function AdminUsersPage() {
  const router = useRouter();
  const { status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("verification");
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);

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

  const handleStatusChange = async (userId: string, newValue: string) => {
    setUpdatingUsers((prev) => new Set(prev).add(userId));

    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      const updateData: { status?: string; isVerified?: boolean } = {};

      if (statusType === "verification") {
        updateData.isVerified = newValue === "verified";
      } else if (statusType === "usage") {
        updateData.status = newValue as "ACTIVE" | "INACTIVE" | "SUSPENDED";
      }

      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user status");
      }

      notifications.show({
        title: "สำเร็จ",
        message: "อัปเดตสถานะผู้ใช้แล้ว",
        color: "green",
      });

      fetchUsers();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "ไม่สามารถอัปเดตสถานะได้";
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: errorMessage,
        color: "red",
      });
    } finally {
      setUpdatingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const getStatusOptions = () => {
    if (statusType === "verification") {
      return [
        { value: "pending", label: "รอยืนยันตัวตน" },
        { value: "verified", label: "ยืนยันตัวตนแล้ว" },
      ];
    } else if (statusType === "usage") {
      return [
        { value: "ACTIVE", label: "การใช้งานปกติ" },
        { value: "INACTIVE", label: "ไม่มีการใช้งาน" },
        { value: "SUSPENDED", label: "พักการใช้งานชั่วคราว" },
      ];
    }
    return [];
  };

  const getStatusTitle = () => {
    if (statusType === "verification") {
      return "ยืนยันตัวตน";
    } else if (statusType === "usage") {
      return "สถานะการใช้งานบัญชี";
    } else if (statusType === "account") {
      return "บัญชี";
    }
    return "";
  };

  const getCurrentStatusValue = (user: User) => {
    if (statusType === "verification") {
      return user.isVerified ? "verified" : "pending";
    } else if (statusType === "usage") {
      return user.status;
    }
    return "";
  };

  if (loading) {
    return (
      <Box>
        <TopNavbar title="User Status" showBack />
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
      <TopNavbar title="User Status" showBack />
      <Container
        size="xl"
        pt="md"
        px="md"
        mt={rem(TOP_NAVBAR_HEIGHT_PX)}
        pb={rem(BOTTOM_NAVBAR_HEIGHT_PX + 20)}
      >
        <Group align="flex-start" gap="md">
          {/* Side Menu */}
          <Box
            style={{
              width: rem(200),
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: rem(16),
            }}
          >
            <Text fw={600} size="lg" c="white" mb="md">
              ปรับสถานะ
            </Text>
            <Stack gap="xs">
              <Button
                variant={statusType === "verification" ? "filled" : "subtle"}
                color={statusType === "verification" ? "yellow" : "gray"}
                fullWidth
                justify="flex-start"
                onClick={() => setStatusType("verification")}
                styles={{
                  root: {
                    backgroundColor:
                      statusType === "verification" ? "#FFD700" : "transparent",
                    color: statusType === "verification" ? "#000" : "#fff",
                  },
                }}
              >
                ยืนยันตัวตน
              </Button>
              <Button
                variant={statusType === "usage" ? "filled" : "subtle"}
                color={statusType === "usage" ? "yellow" : "gray"}
                fullWidth
                justify="flex-start"
                onClick={() => setStatusType("usage")}
                styles={{
                  root: {
                    backgroundColor:
                      statusType === "usage" ? "#FFD700" : "transparent",
                    color: statusType === "usage" ? "#000" : "#fff",
                  },
                }}
              >
                สถานะการใช้งานบัญชี
              </Button>
              <Button
                variant={statusType === "account" ? "filled" : "subtle"}
                color={statusType === "account" ? "yellow" : "gray"}
                fullWidth
                justify="flex-start"
                onClick={() => setStatusType("account")}
                disabled
                styles={{
                  root: {
                    backgroundColor:
                      statusType === "account" ? "#FFD700" : "transparent",
                    color: statusType === "account" ? "#000" : "#fff",
                  },
                }}
              >
                บัญชี
              </Button>
            </Stack>
          </Box>

          {/* Main Content */}
          <Box style={{ flex: 1 }}>
            {/* Title and Search Bar */}
            <Group justify="space-between" mb="md" align="center">
              <Text fw={600} size="lg" c="white">
                {getStatusTitle()}
              </Text>
              <TextInput
                placeholder="ค้นหาจาก ชื่อผู้ใช้ ชื่อ นามสกุล เบอร์"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={
                  <Text size="sm" c="dimmed">
                    🔍
                  </Text>
                }
                style={{ flex: 1, maxWidth: rem(300) }}
                styles={{
                  input: {
                    backgroundColor: "#131313",
                    borderColor: "#333",
                    color: "white",
                  },
                }}
              />
            </Group>

            {/* Table */}
            <ScrollArea
              h={`calc(100vh - ${rem(
                TOP_NAVBAR_HEIGHT_PX + BOTTOM_NAVBAR_HEIGHT_PX + 200
              )})`}
            >
              <Box
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <Table
                  striped
                  highlightOnHover
                  styles={{
                    thead: {
                      backgroundColor: "#0F0F0F",
                    },
                    th: {
                      color: "white",
                      borderBottom: "1px solid #333",
                    },
                    td: {
                      color: "white",
                      borderBottom: "1px solid #333",
                    },
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ชื่อผู้ใช้</Table.Th>
                      <Table.Th>ชื่อ</Table.Th>
                      <Table.Th>นามสกุล</Table.Th>
                      <Table.Th>เบอร์โทร</Table.Th>
                      <Table.Th>สถานะ</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={5} style={{ textAlign: "center" }}>
                          <Text c="dimmed" py="xl">
                            ไม่พบผู้ใช้
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      users.map((user) => (
                        <Table.Tr key={user.id}>
                          <Table.Td>{user.username}</Table.Td>
                          <Table.Td>{user.name || "-"}</Table.Td>
                          <Table.Td>{user.lastname || "-"}</Table.Td>
                          <Table.Td>{user.phone || "-"}</Table.Td>
                          <Table.Td>
                            <Select
                              value={getCurrentStatusValue(user)}
                              onChange={(value) =>
                                value && handleStatusChange(user.id, value)
                              }
                              data={getStatusOptions()}
                              disabled={updatingUsers.has(user.id)}
                              styles={{
                                input: {
                                  backgroundColor: "#131313",
                                  borderColor: "#333",
                                  color: "white",
                                  minWidth: rem(200),
                                  border: "1px solid #FFD700",
                                },
                                option: {
                                  backgroundColor: "#1a1a1a",
                                  color: "white",
                                },
                              }}
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Box>
            </ScrollArea>
          </Box>
        </Group>
      </Container>
      <BottomNavbar />
    </Box>
  );
}
