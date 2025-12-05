"use client";

import { TypingUser } from "@/@types/message";
import { Box, Container, rem, Text } from "@mantine/core";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) {
    return null;
  }

  return (
    <Box
      pos="fixed"
      left={0}
      right={0}
      bottom={rem(90)}
      bg="#0F0F0F"
      style={{
        borderTop: "1px solid var(--mantine-color-dark-4)",
      }}
    >
      <Container size="xs" px="md" py="xs">
        <Text c="dimmed" size="sm" style={{ fontStyle: "italic" }}>
          {typingUsers.length === 1
            ? `${typingUsers[0].userName} is typing...`
            : `${typingUsers.map((u) => u.userName).join(", ")} are typing...`}
        </Text>
      </Container>
    </Box>
  );
}
