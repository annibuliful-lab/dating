"use client";

import { SendIcon } from "@/components/icons/SendIcon";
import { ActionIcon, Box, Container, Group, TextInput } from "@mantine/core";

interface MessageInputProps {
  message: string;
  setMessage: (message: string) => void;
  onSend: () => void;
  onTyping: (text: string) => void;
  sending: boolean;
}

export function MessageInput({
  message,
  setMessage,
  onSend,
  onTyping,
  sending,
}: MessageInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setMessage(value);
    onTyping(value);
  };

  return (
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
            onChange={handleMessageChange}
            onKeyDown={handleKeyPress}
            placeholder="Message"
            style={{ flex: 1 }}
            radius="xl"
            size="md"
            disabled={sending}
          />
          <ActionIcon
            size={40}
            radius="xl"
            variant="subtle"
            onClick={onSend}
            disabled={!message.trim() || sending}
            loading={sending}
          >
            <SendIcon />
          </ActionIcon>
        </Group>
      </Container>
    </Box>
  );
}
