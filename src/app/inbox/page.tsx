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
import {
  Avatar,
  Box,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  rem,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type ChatPreview = {
  id: string;
  name: string;
  preview: string;
  dateLabel: string;
  unread: boolean;
};

const MOCK_CHATS: ChatPreview[] = [
  {
    id: "1",
    name: "Saiparn Brave, Aommy",
    preview: "Lorem Ipsum is simply dummy text of the printing and types...",
    dateLabel: "Apr 3",
    unread: true,
  },
  {
    id: "2",
    name: "Saiparn Brave",
    preview: "Lorem Ipsum is simply dummy text of the printing and types...",
    dateLabel: "Apr 3",
    unread: true,
  },
  {
    id: "3",
    name: "Saiparn Brave",
    preview: "Lorem Ipsum is simply dummy text of the printing and types...",
    dateLabel: "Apr 3",
    unread: false,
  },
  {
    id: "4",
    name: "Saiparn Brave",
    preview: "Lorem Ipsum is simply dummy text of the printing and types...",
    dateLabel: "Apr 3",
    unread: false,
  },
];

function InboxPage() {
  const router = useRouter();
  const { status } = useSession();

  //   useEffect(() => {
  //     if (status === "unauthenticated") {
  //       router.push("/");
  //     }
  //   }, [router, status]);

  return (
    <Box>
      <TopNavbar title="Inbox" rightSlot={<UserPlusIcon />} />
      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" pb={rem(BOTTOM_NAVBAR_HEIGHT_PX)}>
          {MOCK_CHATS.map((chat, index) => (
            <Box
              key={chat.id}
              onClick={() => router.push(`/inbox/${chat.id}`)}
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
                  <Avatar radius="xl" color="gray" size={62} />
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
              {index < MOCK_CHATS.length - 1 && (
                <Divider mt="lg" color="dark.4" />
              )}
            </Box>
          ))}
        </Stack>
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default InboxPage;
