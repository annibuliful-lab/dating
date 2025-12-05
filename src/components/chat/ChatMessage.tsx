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
  onViewProfile?: (userId: string) => void;
}

export function ChatMessage({
  message,
  showAvatar,
  showTimestamp,
  isOwnMessage,
  onEdit,
  onDelete,
  formatMessageTime,
  onViewProfile,
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
                bg="#ebb609"
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
                {message.videoUrl && (
                  <video
                    src={message.videoUrl}
                    controls
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      borderRadius: 8,
                      marginTop: message.text ? 8 : 0,
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
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
              src={message.senderAvatar || undefined}
              style={{ cursor: onViewProfile ? "pointer" : "default" }}
              onClick={() => onViewProfile && message.senderId && onViewProfile(message.senderId)}
            >
              {message.senderName?.charAt(0) || "?"}
            </Avatar>
          ) : (
            <Box w={40} />
          )}
          <Stack gap={4} style={{ flex: 1 }}>
            {showAvatar && (
              <Group gap={6} align="center" wrap="nowrap">
                <Text 
                  fw={600} 
                  size="sm" 
                  c="dimmed"
                  style={{ cursor: onViewProfile ? "pointer" : "default" }}
                  onClick={() => onViewProfile && message.senderId && onViewProfile(message.senderId)}
                >
                  {message.senderName}
                </Text>
                {message.senderIsVerified && (
                  <Text
                  size="xs"
                  fw={700}
                  c={message.senderRole === "ADMIN" ? "blue" : "teal"}
                  style={{
                    backgroundColor: message.senderRole === "ADMIN" 
                      ? "rgba(37, 99, 235, 0.2)" 
                      : "rgba(20, 184, 166, 0.2)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    border: `1px solid ${message.senderRole === "ADMIN" ? "#2563eb" : "#14b8a6"}`,
                  }}
                  title={
                    message.senderRole === "ADMIN"
                      ? "Verified by Admin"
                      : "Verified by User"
                  }
                >
                  VERIFIED
                </Text>
                )}
              </Group>
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
                  {message.videoUrl && (
                    <video
                      src={message.videoUrl}
                      controls
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        borderRadius: 8,
                        marginTop: message.text ? 8 : 0,
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
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
