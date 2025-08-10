"use client";

import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { SendIcon } from "@/components/icons/SendIcon";
import { UserPlusIcon } from "@/components/icons/UserPlusIcon";
import {
  ActionIcon,
  Avatar,
  Box,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
  rem,
} from "@mantine/core";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ChatMessage = {
  id: string;
  text: string;
  author: "me" | "other";
  name?: string;
  createdAtLabel: string;
};

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    text: "Thanks everyone! Almost there.",
    author: "other",
    name: "Orlando Diggs",
    createdAtLabel: "Thursday 10:16am",
  },
  {
    id: "m2",
    text: "Hey team, I’ve finished with the requirements doc!",
    author: "other",
    name: "Lana Steiner",
    createdAtLabel: "Thursday 11:40am",
  },
  {
    id: "m3",
    text: "Awesome! Thanks.",
    author: "me",
    createdAtLabel: "Thursday 11:41am",
  },
  {
    id: "m4",
    text: "Good timing — was just looking at this.",
    author: "other",
    name: "Demi Wilkinson",
    createdAtLabel: "Thursday 11:44am",
  },
];

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const [message, setMessage] = useState("");

  const messages = useMemo(() => MOCK_MESSAGES, []);

  const handleSend = () => {
    if (!message.trim()) return;
    // In real app, send message to API here.
    setMessage("");
  };

  return (
    <Box>
      <TopNavbar title="Chat" showBack rightSlot={<UserPlusIcon />} />

      <Container size="xs" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)} pb={rem(90)}>
        <Stack gap="lg">
          {messages.map((m) => (
            <Box key={m.id}>
              {m.author === "other" ? (
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <Avatar radius="xl" color="gray" size={40} />
                  <Stack gap={6} style={{ flex: 1 }}>
                    {m.name && (
                      <Text fw={600} size="sm">
                        {m.name}
                      </Text>
                    )}
                    <Box
                      p="md"
                      bg="#2A2A2A"
                      style={{ borderRadius: 16, maxWidth: "85%" }}
                    >
                      <Text>{m.text}</Text>
                    </Box>
                    <Text c="dimmed" size="xs">
                      {m.createdAtLabel}
                    </Text>
                  </Stack>
                </Group>
              ) : (
                <Stack gap={6} align="flex-end">
                  <Text c="dimmed" size="xs">
                    {m.createdAtLabel}
                  </Text>
                  <Box
                    p="md"
                    bg="#FFD700"
                    c="#191919"
                    style={{ borderRadius: 16, maxWidth: "85%" }}
                  >
                    <Text>{m.text}</Text>
                  </Box>
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      </Container>

      <Box
        pos="fixed"
        left={0}
        right={0}
        bottom={0}
        bg="#0F0F0F"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--mantine-color-dark-4)",
        }}
      >
        <Container size="xs" px="md" py="sm">
          <Group align="center" gap="sm">
            <TextInput
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              placeholder="Message"
              style={{ flex: 1 }}
              radius="xl"
              size="md"
            />
            <ActionIcon
              size={40}
              radius="xl"
              variant="subtle"
              onClick={handleSend}
            >
              <SendIcon />
            </ActionIcon>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
