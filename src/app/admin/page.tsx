"use client";

import { TopNavbar, TOP_NAVBAR_HEIGHT_PX } from "@/components/element/TopNavbar";
import {
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  rem,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated" && session?.user?.id) {
      checkAdminStatus();
    }
  }, [status, session, router]);

  const checkAdminStatus = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch("/api/admin/check");
      if (!response.ok) {
        throw new Error("Failed to check admin status");
      }
      const data = await response.json();
      setIsUserAdmin(data.isAdmin || data.role === "ADMIN");
      if (!data.isAdmin && data.role !== "ADMIN") {
        router.push("/feed");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.push("/feed");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !isUserAdmin) {
    return (
      <Box>
        <TopNavbar title="Admin Dashboard" />
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
      <TopNavbar title="แดชบอร์ดแอดมิน" />
      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" py="xl">
          <Title order={2} c="white">
            จัดการระบบ
          </Title>

          <Card
            padding="lg"
            radius="md"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              cursor: "pointer",
            }}
            onClick={() => router.push("/admin/chats")}
          >
            <Stack gap="xs">
              <Text fw={600} size="lg" c="white">
                จัดการแชท
              </Text>
              <Text size="sm" c="dimmed">
                ดูรายการแชทกลุ่มทั้งหมด เพิ่ม/ลบผู้ใช้ในแชท
              </Text>
            </Stack>
          </Card>

          <Card
            padding="lg"
            radius="md"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              cursor: "pointer",
            }}
            onClick={() => router.push("/admin/users")}
          >
            <Stack gap="xs">
              <Text fw={600} size="lg" c="white">
                จัดการผู้ใช้
              </Text>
              <Text size="sm" c="dimmed">
                ดูรายการผู้ใช้ทั้งหมด ปรับสถานะการใช้งานและสถานะการยืนยันตัวตน
              </Text>
            </Stack>
          </Card>

          <Card
            padding="lg"
            radius="md"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              cursor: "pointer",
            }}
            onClick={() => router.push("/admin/posts")}
          >
            <Stack gap="xs">
              <Text fw={600} size="lg" c="white">
                จัดการโพสต์
              </Text>
              <Text size="sm" c="dimmed">
                ดูรายการโพสต์ทั้งหมด และลบโพสต์
              </Text>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}

