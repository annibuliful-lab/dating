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
import { getUserProfile } from "@/services/profile/get";
import {
  Box,
  Center,
  Container,
  Group,
  Image,
  Loader,
  rem,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function ProfileViewPage() {
  const params = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!params.userId) {
        setError("User ID not provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userProfile = await getUserProfile(params.userId);
        setProfile(userProfile);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params.userId]);

  const calculateAge = (birthday: string | null): number | null => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <Box>
        <TopNavbar title="Profile" showBack />
        <Container size="xs" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        </Container>
        <BottomNavbar />
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box>
        <TopNavbar title="Profile" showBack />
        <Container size="xs" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
          <Center py="xl">
            <Text c="red" ta="center">
              {error || "Profile not found"}
            </Text>
          </Center>
        </Container>
        <BottomNavbar />
      </Box>
    );
  }

  const age = calculateAge(profile.birthday);

  return (
    <Box>
      <TopNavbar title="Profile" showBack />
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
            src={profile.avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1974&auto=format&fit=crop"}
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
                {profile.username || "User"}
              </Text>
              <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                <CheckCircle />
              </ThemeIcon>
            </Group>
            <Text c="dimmed" fz="sm">
              {profile.fullName || "Unknown"}
            </Text>
            <Text fz="sm" style={{ maxWidth: rem(320), lineHeight: 1.5 }}>
              {profile.bio || "No bio available"}
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
              <Text fz="sm">{profile.relationShipStatus || "N/A"}</Text>
            </Stack>
            <Stack gap={2} align="center">
              <GenderIcon />
              <Text fz="sm">{profile.gender || "N/A"}</Text>
            </Stack>
            <Stack gap={2} align="center">
              <AgeIcon />
              <Text fz="sm">{age || "N/A"}</Text>
            </Stack>
            <Stack gap={2} align="center">
              <RulerIcon />
              <Text fz="sm">
                {profile.height && profile.weight
                  ? `${profile.height}/${profile.weight}`
                  : "N/A"}
              </Text>
            </Stack>
          </Group>
        </Box>
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default ProfileViewPage;

