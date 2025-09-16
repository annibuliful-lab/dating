"use client";

import { CameraIcon } from "@/components/icons/CameraIcon";
import { SendIcon } from "@/components/icons/SendIcon";
import { ActionIcon, Box, Container, Group, TextInput } from "@mantine/core";
import { useRef } from "react";

interface MessageInputProps {
  message: string;
  setMessage: (message: string) => void;
  onSend: () => void;
  onTyping: (text: string) => void;
  sending: boolean;
  onMediaSelect?: (file: File) => void;
}

export function MessageInput({
  message,
  setMessage,
  onSend,
  onTyping,
  sending,
  onMediaSelect,
}: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleMediaClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onMediaSelect) {
      // Validate file type
      const validTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "video/mp4",
        "video/webm",
        "video/quicktime",
      ];
      if (validTypes.includes(file.type)) {
        // Validate file size (10MB limit)
        if (file.size <= 10 * 1024 * 1024) {
          onMediaSelect(file);
        } else {
          alert("File size must be less than 10MB");
        }
      } else {
        alert(
          "Please select an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM, QuickTime) file"
        );
      }
    }
    // Reset input value to allow selecting the same file again
    if (e.target) {
      e.target.value = "";
    }
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <ActionIcon
            size={40}
            radius="xl"
            variant="subtle"
            onClick={handleMediaClick}
            disabled={sending}
            color="gray"
          >
            <CameraIcon color="#666" />
          </ActionIcon>
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
