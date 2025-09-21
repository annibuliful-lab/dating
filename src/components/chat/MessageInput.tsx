"use client";

import { MediaPreview } from "@/components/chat/MediaPreview";
import { CameraIcon } from "@/components/icons/CameraIcon";
import { SendIcon } from "@/components/icons/SendIcon";
import { ActionIcon, Box, Container, Group, TextInput } from "@mantine/core";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface MessageInputProps {
  message: string;
  setMessage: (message: string) => void;
  onSend: () => void;
  onTyping: (text: string) => void;
  sending: boolean;
  onMediaSelect?: (files: File[]) => void;
  selectedMedia?: File[];
  onRemoveMedia?: (index: number) => void;
  onSendMedia?: () => void;
  uploadingMedia?: boolean;
}

export const MessageInput = forwardRef<
  { focus: () => void },
  MessageInputProps
>(
  (
    {
      message,
      setMessage,
      onSend,
      onTyping,
      sending,
      onMediaSelect,
      selectedMedia,
      onRemoveMedia,
      onSendMedia,
      uploadingMedia,
    },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Expose focus method to parent component
    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    // Auto-focus input after sending
    useEffect(() => {
      if (!sending && !uploadingMedia) {
        // Small delay to ensure the input is ready
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }, [sending, uploadingMedia]);
    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleSend = () => {
      if (selectedMedia && selectedMedia.length > 0 && onSendMedia) {
        // If there's media selected, send media first
        onSendMedia();
      } else {
        // If no media, send regular message
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
      const files = Array.from(e.target.files || []);
      if (files.length > 0 && onMediaSelect) {
        // Validate each file
        const validTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "video/mp4",
          "video/webm",
          "video/quicktime",
        ];

        const validFiles: File[] = [];
        const errors: string[] = [];

        files.forEach((file, index) => {
          if (!validTypes.includes(file.type)) {
            errors.push(`File ${index + 1}: Invalid file type`);
          } else if (file.size > 10 * 1024 * 1024) {
            errors.push(`File ${index + 1}: File size must be less than 10MB`);
          } else {
            validFiles.push(file);
          }
        });

        if (errors.length > 0) {
          alert(errors.join("\n"));
        }

        if (validFiles.length > 0) {
          onMediaSelect(validFiles);
        }
      }
      // Reset input value to allow selecting the same files again
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
        {selectedMedia && selectedMedia.length > 0 && onRemoveMedia && (
          <MediaPreview
            files={selectedMedia}
            onRemove={onRemoveMedia}
            sending={uploadingMedia || false}
          />
        )}

        <Container size="xs" px="md" py="sm">
          <Group align="center" gap="sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
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
              ref={inputRef}
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
              onClick={handleSend}
              disabled={
                (!message.trim() &&
                  (!selectedMedia || selectedMedia.length === 0)) ||
                sending ||
                uploadingMedia
              }
              loading={sending || uploadingMedia}
            >
              <SendIcon />
            </ActionIcon>
          </Group>
        </Container>
      </Box>
    );
  }
);

MessageInput.displayName = "MessageInput";
