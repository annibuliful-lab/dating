"use client";

import { BackIcon } from "@/components/icons/BackIcon";
import { Box, Group, Text, rem } from "@mantine/core";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

export const TOP_NAVBAR_HEIGHT_PX = 52;

type TopNavbarProps = {
  title: string;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
};

export function TopNavbar({
  title,
  showBack,
  backLabel = "Back",
  onBack,
  rightSlot,
}: TopNavbarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    router.back();
  };

  return (
    <Box
      pos="fixed"
      top={0}
      left={0}
      right={0}
      bg="#0F0F0F"
      style={{
        borderBottom: "1px solid var(--mantine-color-dark-4)",
        height: `calc(${rem(TOP_NAVBAR_HEIGHT_PX)} + env(safe-area-inset-top))`,
        paddingTop: "env(safe-area-inset-top)",
        zIndex: 100,
      }}
    >
      <Group
        h={rem(TOP_NAVBAR_HEIGHT_PX)}
        px="md"
        justify="space-between"
        wrap="nowrap"
      >
        <Box
          w={84}
          onClick={showBack ? handleBack : undefined}
          style={{ cursor: showBack ? "pointer" : "default" }}
        >
          {showBack && (
            <Group gap={6} wrap="nowrap">
              <BackIcon />
              <Text fw={600}>{backLabel}</Text>
            </Group>
          )}
        </Box>

        <Text fz="lg" fw={600} c="white">
          {title}
        </Text>

        <Box w={84} style={{ display: "flex", justifyContent: "flex-end" }}>
          {rightSlot}
        </Box>
      </Group>
    </Box>
  );
}
