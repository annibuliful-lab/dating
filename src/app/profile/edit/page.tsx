"use client";

import { TOP_NAVBAR_HEIGHT_PX } from "@/components/element/TopNavbar";
import { CalendarIcon } from "@/components/icons/CalendarIcon";
import { CameraIcon } from "@/components/icons/CameraIcon";
import {
  Box,
  Container,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  rem,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useRouter } from "next/navigation";
import { useState } from "react";

function EditProfilePage() {
  const router = useRouter();

  const [bio, setBio] = useState("");
  const BIO_LIMIT = 150;

  return (
    <Box>
      {/* Header */}
      <Box
        pos="fixed"
        top={0}
        left={0}
        right={0}
        bg="#0F0F0F"
        style={{
          borderBottom: "1px solid var(--mantine-color-dark-4)",
          height: `calc(${rem(
            TOP_NAVBAR_HEIGHT_PX
          )} + env(safe-area-inset-top))`,
          paddingTop: "env(safe-area-inset-top)",
          zIndex: 100,
        }}
      >
        <Group h={rem(TOP_NAVBAR_HEIGHT_PX)} px="md" justify="space-between">
          <Text c="white" onClick={() => router.back()}>
            ← Back
          </Text>
          <Text c="white" fw={600}>
            Edit Profile
          </Text>
          <Text c="gold.5" fw={600} onClick={() => router.back()}>
            Save
          </Text>
        </Group>
      </Box>

      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" pb="xl">
          <Box style={{ display: "grid", placeItems: "center" }}>
            <Box
              style={{
                position: "relative",
                width: rem(150),
                height: rem(150),
              }}
            >
              <Box
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "1px solid var(--mantine-color-dark-4)",
                  background:
                    "repeating-conic-gradient(#333 0% 25%, transparent 0% 50%) 50% / 20px 20px",
                  opacity: 0.8,
                }}
              />

              <ThemeIcon
                radius="xl"
                size={34}
                style={{
                  position: "absolute",
                  right: rem(4),
                  bottom: rem(4),
                  backgroundColor: "white",
                  border: "1px solid var(--mantine-color-dark-4)",
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.35)",
                  zIndex: 1,
                }}
                variant="light"
                color="dark.4"
              >
                <CameraIcon />
              </ThemeIcon>
            </Box>
          </Box>

          <Stack gap="sm">
            <Text fw={700}>Public profile</Text>
            <TextInput placeholder="Username" />
            <TextInput placeholder="Name" />
            <TextInput placeholder="Lastname" />

            <Select
              placeholder="Gender"
              data={["Male", "Female", "Other"]}
              rightSection={<Text>›</Text>}
              comboboxProps={{ withinPortal: true }}
            />

            <DateInput
              placeholder="Birthday"
              valueFormat="MMM DD, YYYY"
              variant="filled"
              rightSection={<CalendarIcon />}
            />

            <Select
              placeholder="Status"
              data={["Single", "In a relationship", "Married"]}
              rightSection={<Text>›</Text>}
              comboboxProps={{ withinPortal: true }}
            />

            <Box>
              <Textarea
                placeholder="Bio"
                autosize
                minRows={5}
                maxRows={6}
                value={bio}
                onChange={(e) =>
                  setBio(e.currentTarget.value.slice(0, BIO_LIMIT))
                }
              />
              <Text fz="xs" c="dimmed" ta="right">
                {bio.length}/{BIO_LIMIT}
              </Text>
            </Box>
          </Stack>

          {/* Private details section */}
          <Stack gap="sm">
            <Text fw={700}>Private details</Text>
            <TextInput placeholder="Phone" type="tel" />
            <TextInput placeholder="Line ID" />
            <TextInput
              placeholder="Height"
              rightSection={<Text c="dimmed">cm</Text>}
            />
            <TextInput
              placeholder="Weigh"
              rightSection={<Text c="dimmed">kg</Text>}
            />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

export default EditProfilePage;
