"use client";

import { BottomNavbar } from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { CheckCircle } from "@/components/icons/CheckCircle";
import { SendIcon } from "@/components/icons/SendIcon";
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Group,
  Image,
  rem,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useRouter } from "next/navigation";

function ProfilePage() {
  const router = useRouter();
  return (
    <Box>
      <TopNavbar title="Profile" />
      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack align="center" gap="xs" pb="lg">
          {/* Avatar */}
          <Box
            style={{
              width: rem(150),
              height: rem(150),
              borderRadius: "50%",
              overflow: "hidden",
              border: "1px solid var(--mantine-color-dark-4)",
            }}
          >
            <Image
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop"
              alt="Toxic_cat profile"
              w="100%"
              h="100%"
              fit="cover"
            />
          </Box>
          <Flex direction="column" align="center">
            <Group gap={6} align="center">
              <Text fw={800} fz={20}>
                Toxic_cat
              </Text>
              <ThemeIcon size={22} radius="xl" color="teal" variant="light">
                <CheckCircle />
              </ThemeIcon>
            </Group>
            <Text c="#979797">Luca meowmeow</Text>
          </Flex>

          <Text ta="center" px="lg" style={{ lineHeight: 1.5 }}>
            Looking for someone who won’t judge my obsession with wet bathroom
            floors.
          </Text>

          <Button
            variant="secondary"
            color="dark.4"
            radius="md"
            mt="xs"
            onClick={() => router.push("/profile/edit")}
          >
            Edit profile
          </Button>
        </Stack>

        <Stack gap="xs" pb={rem(80)}>
          <Group align="center" gap="sm">
            <Box
              style={{
                width: rem(24),
                height: rem(24),
                borderRadius: "50%",
                overflow: "hidden",
                border: "1px solid var(--mantine-color-dark-4)",
              }}
            >
              <Image
                src="https://images.unsplash.com/photo-1531590878845-12627191e687?q=80&w=400&auto=format&fit=crop"
                alt="Chaya Aom avatar"
                w="100%"
                h="100%"
                fit="cover"
              />
            </Box>
            <Text fw={600}>Chaya Aom</Text>
            <Text c="dimmed">Aug 3</Text>
          </Group>

          <Text fz="lg" style={{ lineHeight: 1.6 }}>
            Full heart, full class, but still have room for one more person who
            gets it.
          </Text>

          <Group justify="space-between" mt="xs">
            <SendIcon />
            <Badge color="teal" radius="xl" variant="light">
              Verified
            </Badge>
          </Group>
        </Stack>
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default ProfilePage;
