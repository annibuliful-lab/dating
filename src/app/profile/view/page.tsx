"use client";

import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { AgeIcon } from "@/components/icons/AgeIcon";
import { CheckCircle } from "@/components/icons/CheckCircle";
import { GenderIcon } from "@/components/icons/GenderIcon";
import { RulerIcon } from "@/components/icons/RulerIcon";
import { SingleIcon } from "@/components/icons/SingleIcon";
import {
  Box,
  Container,
  Group,
  Image,
  rem,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";

function ProfileViewPage() {
  return (
    <Box>
      <TopNavbar title="Profile" />
      <Container
        size="xs"
        px={0}
        mx="auto"
        h={`calc(100dvh - ${rem(TOP_NAVBAR_HEIGHT_PX)} - ${rem(
          BOTTOM_NAVBAR_HEIGHT_PX
        )} - env(safe-area-inset-bottom) - env(safe-area-inset-top))`}
        style={{
          marginTop: `calc(${rem(
            TOP_NAVBAR_HEIGHT_PX
          )} + env(safe-area-inset-top))`,
        }}
      >
        <Box h="100%" style={{ position: "relative" }}>
          <Image
            src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1974&auto=format&fit=crop"
            alt="profile"
            radius={0}
            h="100%"
            w="100%"
            fit="cover"
          />

          <Box
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0.95) 100%)",
            }}
          />

          <Stack
            gap={4}
            style={{ position: "absolute", left: rem(16), bottom: rem(96) }}
          >
            <Group gap={6} align="center">
              <Text fw={700} fz={24}>
                Toxic_cat
              </Text>
              <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                <CheckCircle />
              </ThemeIcon>
            </Group>
            <Text c="dimmed" fz="sm">
              Luca meowmeow
            </Text>
            <Text fz="sm" style={{ maxWidth: rem(320), lineHeight: 1.5 }}>
              Looking for someone who won’t judge my obsession with wet bathroom
              floors.
            </Text>
          </Stack>

          <Group
            justify="center"
            gap={36}
            style={{
              position: "absolute",
              bottom: rem(30),
              left: rem(16),
              right: rem(16),
            }}
          >
            <Stack gap={2} align="center">
              <SingleIcon />
              <Text fz="sm">Single</Text>
            </Stack>
            <Stack gap={2} align="center">
              <GenderIcon />
              <Text fz="sm">Female</Text>
            </Stack>
            <Stack gap={2} align="center">
              <AgeIcon />
              <Text fz="sm">32</Text>
            </Stack>
            <Stack gap={2} align="center">
              <RulerIcon />
              <Text fz="sm">190/82</Text>
            </Stack>
          </Group>
        </Box>
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default ProfileViewPage;
