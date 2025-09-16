"use client";

import { ActionIcon, Box, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";

interface MediaPreviewProps {
  file: File;
  onRemove: () => void;
  onSend: () => void;
  sending: boolean;
}

export function MediaPreview({
  file,
  onRemove,
  onSend,
  sending,
}: MediaPreviewProps) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));

  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");

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
        zIndex: 1000,
      }}
    >
      <Box p="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {isVideo ? "Video" : "Image"} Preview
            </Text>
            <Group gap="xs">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={onRemove}
                disabled={sending}
              >
                ✕
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="filled"
                color="blue"
                onClick={onSend}
                loading={sending}
                disabled={sending}
              >
                Send
              </ActionIcon>
            </Group>
          </Group>

          <Box
            style={{
              maxHeight: "200px",
              borderRadius: 8,
              overflow: "hidden",
              backgroundColor: "#1a1a1a",
            }}
          >
            {isImage && (
              <img
                src={previewUrl}
                alt="Preview"
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "200px",
                  objectFit: "cover",
                }}
              />
            )}
            {isVideo && (
              <video
                src={previewUrl}
                controls
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "200px",
                }}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </Box>

          <Text size="xs" c="dimmed" ta="center">
            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
