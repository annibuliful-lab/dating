"use client";

import { Box, Center, Text, rem } from "@mantine/core";

export const TOP_NAVBAR_HEIGHT_PX = 52;

type TopNavbarProps = {
  title: string;
};

export function TopNavbar({ title }: TopNavbarProps) {
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
      <Center h={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Text fz="lg" fw={600} c="white">
          {title}
        </Text>
      </Center>
    </Box>
  );
}
