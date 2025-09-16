"use client";

import { ActionIcon, Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import Image from "next/image";
import { useState } from "react";

interface MediaPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  sending: boolean;
}

export function MediaPreview({ files, onRemove, sending }: MediaPreviewProps) {
  const [previewUrls] = useState(() =>
    files.map((file) => URL.createObjectURL(file))
  );

  return (
    <Box
      bg="#0F0F0F"
      style={{
        borderTop: "1px solid var(--mantine-color-dark-4)",
      }}
    >
      <Box p="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {files.length} {files.length === 1 ? "File" : "Files"} Preview
            </Text>
          </Group>

          <SimpleGrid
            cols={files.length === 1 ? 1 : files.length <= 4 ? 2 : 3}
            spacing="sm"
          >
            {files.map((file, index) => {
              const isVideo = file.type.startsWith("video/");
              const isImage = file.type.startsWith("image/");
              const previewUrl = previewUrls[index];

              return (
                <Box
                  key={index}
                  style={{
                    position: "relative",
                    width: files.length === 1 ? "200px" : "100%",
                    height: files.length === 1 ? "200px" : "120px",
                    borderRadius: 8,
                    overflow: "hidden",
                    backgroundColor: "#1a1a1a",
                    margin: files.length === 1 ? "0 auto" : "0",
                  }}
                >
                  <ActionIcon
                    size="sm"
                    variant="filled"
                    color="red"
                    onClick={() => onRemove(index)}
                    disabled={sending}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      zIndex: 1,
                    }}
                  >
                    ✕
                  </ActionIcon>

                  {isImage && (
                    <Image
                      src={previewUrl}
                      alt={`Preview ${index + 1}`}
                      width={200}
                      height={200}
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 8,
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
                        height: "100%",
                        borderRadius: 8,
                        objectFit: "cover",
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </Box>
              );
            })}
          </SimpleGrid>

          <Text size="xs" c="dimmed" ta="center">
            {files.length} {files.length === 1 ? "file" : "files"} selected
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
