"use client";

import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { SendIcon } from "@/components/icons/SendIcon";
import {
  Avatar,
  Badge,
  Box,
  Container,
  Divider,
  Group,
  rem,
  Stack,
  Text,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type FeedStatus = "verified" | "pending";

type FeedItem = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAtLabel: string;
  content: string;
  status: FeedStatus;
};

const MOCK_FEED: FeedItem[] = [
  {
    id: "1",
    authorName: "Chaya Aom",
    createdAtLabel: "Aug 3",
    content:
      "Full heart, full class, but still have room for one more person who gets it.",
    status: "verified",
  },
  {
    id: "2",
    authorName: "Chaya Aom",
    createdAtLabel: "Aug 3",
    content:
      "Full heart, full class, but still have room for one more person who gets it.",
    status: "pending",
  },
  {
    id: "3",
    authorName: "Chaya Aom",
    createdAtLabel: "Aug 3",
    content:
      "Full heart, full class, but still have room for one more person who gets it.",
    status: "verified",
  },
  {
    id: "4",
    authorName: "Chaya Aom",
    createdAtLabel: "Aug 3",
    content:
      "Full heart, full class, but still have room for one more person who gets it.",
    status: "pending",
  },
];

function FeedPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [router, status]);

  const renderStatus = (postStatus: FeedStatus) => {
    if (postStatus === "verified") {
      return (
        <Badge color="teal" radius="xl" variant="light">
          Verified
        </Badge>
      );
    }
    return (
      <Badge color="orange" radius="xl" variant="light">
        Pending verification
      </Badge>
    );
  };

  return (
    <Box>
      <TopNavbar title="Feed and Contents" />
      <Container size="xs" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" pb={rem(BOTTOM_NAVBAR_HEIGHT_PX)}>
          {MOCK_FEED.map((item, index) => (
            <Box key={item.id}>
              <Stack gap={10}>
                <Group gap="sm" align="center">
                  <Avatar radius="xl" color="gray" />
                  <Text fw={600}>{item.authorName}</Text>
                  <Text c="dimmed">{item.createdAtLabel}</Text>
                </Group>

                <Text fz="lg" style={{ lineHeight: 1.6 }}>
                  {item.content}
                </Text>

                <Group justify="space-between" mt="xs">
                  <SendIcon />
                  {renderStatus(item.status)}
                </Group>
              </Stack>
              {index < MOCK_FEED.length - 1 && (
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

export default FeedPage;
