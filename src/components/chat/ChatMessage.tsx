"use client";

import { ChatMessage as ChatMessageType } from "@/@types/message";
import { Avatar, Box, Group, Menu, Stack, Text } from "@mantine/core";
import Image from "next/image";

interface ChatMessageProps {
  message: ChatMessageType;
  showAvatar: boolean;
  showTimestamp: boolean;
  isOwnMessage: boolean;
  onEdit: (message: ChatMessageType) => void;
  onDelete: (messageId: string) => void;
  formatMessageTime: (date: Date) => string;
}

export function ChatMessage({
  message,
  showAvatar,
  showTimestamp,
  isOwnMessage,
  onEdit,
  onDelete,
  formatMessageTime,
}: ChatMessageProps) {
  return (
    <Box>
      {showTimestamp && (
        <Box ta="center" my="md">
          <Text
            c="dimmed"
            size="xs"
            style={{
              backgroundColor: "#0F0F0F",
              padding: "4px 12px",
              borderRadius: 12,
              border: "1px solid var(--mantine-color-dark-4)",
              display: "inline-block",
            }}
          >
            {formatMessageTime(new Date(message.createdAt))}
          </Text>
        </Box>
      )}

      {isOwnMessage ? (
        <Stack gap={4} align="flex-end">
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Box
                p="md"
                bg="#FFD700"
                c="#191919"
                style={{
                  borderRadius: "16px 16px 4px 16px",
                  maxWidth: "85%",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                {message.text && (
                  <Text style={{ wordBreak: "break-word" }}>
                    {message.text}
                  </Text>
                )}
                {message.imageUrl && (
                  <Image
                    src={message.imageUrl}
                    alt="Message attachment"
                    width={300}
                    height={200}
                    style={{
                      maxWidth: "100%",
                      borderRadius: 8,
                      objectFit: "cover",
                      marginTop: message.text ? 8 : 0,
                    }}
                  />
                )}
              </Box>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onEdit(message)}>Edit</Menu.Item>
              <Menu.Item color="red" onClick={() => onDelete(message.id)}>
                Delete
              </Menu.Item>
              <Menu.Item>Copy</Menu.Item>
              <Menu.Item>Reply</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Stack>
      ) : (
        <Group align="flex-start" gap="md" wrap="nowrap">
          {showAvatar ? (
            <Avatar
              radius="xl"
              color="gray"
              size={40}
              src={message.senderAvatar}
            />
          ) : (
            <Box w={40} />
          )}
          <Stack gap={4} style={{ flex: 1 }}>
            {showAvatar && (
              <Text fw={600} size="sm" c="dimmed">
                {message.senderName}
              </Text>
            )}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Box
                  p="md"
                  bg="#2A2A2A"
                  style={{
                    borderRadius: showAvatar
                      ? "16px 16px 16px 4px"
                      : "16px 16px 16px 4px",
                    maxWidth: "85%",
                    position: "relative",
                    cursor: "pointer",
                  }}
                >
                  {message.text && (
                    <Text style={{ wordBreak: "break-word" }}>
                      {message.text}
                    </Text>
                  )}
                  {message.imageUrl && (
                    <Image
                      src={message.imageUrl}
                      alt="Message attachment"
                      width={300}
                      height={200}
                      style={{
                        maxWidth: "100%",
                        borderRadius: 8,
                        objectFit: "cover",
                        marginTop: message.text ? 8 : 0,
                      }}
                    />
                  )}
                </Box>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => onEdit(message)}>Edit</Menu.Item>
                <Menu.Item color="red" onClick={() => onDelete(message.id)}>
                  Delete
                </Menu.Item>
                <Menu.Item>Copy</Menu.Item>
                <Menu.Item>Reply</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Stack>
        </Group>
      )}
    </Box>
  );
}
