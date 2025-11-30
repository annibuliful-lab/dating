"use client";

import { UserProfile } from "@/@types/user";
import { supabase } from "@/client/supabase";
import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { AgeIcon } from "@/components/icons/AgeIcon";
import { GenderIcon } from "@/components/icons/GenderIcon";
import { RulerIcon } from "@/components/icons/RulerIcon";
import { SingleIcon } from "@/components/icons/SingleIcon";
import { useApiMutation } from "@/hooks/useApiMutation";
import { getUserProfile } from "@/services/profile/get";
import { messageService } from "@/services/supabase/messages";
import { Carousel } from "@mantine/carousel";
import {
  Box,
  Button,
  Center,
  Container,
  Group,
  Image,
  Loader,
  rem,
  Stack,
  Text,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function ProfileViewPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    role: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnverifying, setIsUnverifying] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const verifyMutation = useApiMutation<{ success: boolean }>(
    `/api/users/${params.userId}/verify`
  );
  const unverifyMutation = useApiMutation<{ success: boolean }>(
    `/api/users/${params.userId}/unverify`
  );

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

        // Fetch current user to check if admin
        if (session?.user?.id) {
          const { data: currentUserData } = await supabase
            .from("User")
            .select("role")
            .eq("id", session.user.id)
            .single();
          setCurrentUser(currentUserData);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params.userId, session?.user?.id]);

  const handleVerify = async () => {
    if (!params.userId) return;

    try {
      setIsVerifying(true);
      await verifyMutation.mutate({});
      // Refresh profile after verification
      window.location.reload();
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error verifying user:", error);
        alert(error?.message || "Failed to verify. Please try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnverify = async () => {
    if (!params.userId) return;

    try {
      setIsUnverifying(true);
      await unverifyMutation.mutate({});
      // Refresh profile after unverification
      window.location.reload();
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error unverifying user:", error);
        alert(error?.message || "Failed to unverify. Please try again.");
      }
    } finally {
      setIsUnverifying(false);
    }
  };

  const isAdmin = currentUser?.role === "ADMIN";
  const isOwnProfile = session?.user?.id === params.userId;

  const handleStartChat = async () => {
    if (!session?.user?.id || !params.userId || isStartingChat) return;

    try {
      setIsStartingChat(true);
      // Get or create direct chat
      const chat = await messageService.getOrCreateDirectChat(
        session.user.id,
        params.userId
      );
      // Navigate to the chat page
      router.push(`/inbox/${chat.id}`);
    } catch (err) {
      console.error("Error creating/finding chat:", err);
      alert("Failed to start chat. Please try again.");
    } finally {
      setIsStartingChat(false);
    }
  };

  const calculateAge = (birthday: string | null): number | null => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
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

  // Create combined image array for carousel
  const carouselImages: Array<{ url: string; id: string }> = [];

  // Add avatar as first image if exists
  if (profile.avatarUrl) {
    carouselImages.push({
      url: profile.avatarUrl,
      id: "avatar",
    });
  }

  // Add profile images (sorted by order)
  if (profile.profileImages && profile.profileImages.length > 0) {
    // Sort by order to ensure correct sequence
    const sortedImages = [...profile.profileImages].sort(
      (a, b) => a.order - b.order
    );
    sortedImages.forEach((img) => {
      console.log(img.imageUrl);
      // Only add if imageUrl exists and is not duplicate of avatar
      if (img.imageUrl && img.imageUrl !== profile.avatarUrl) {
        carouselImages.push({
          url: img.imageUrl,
          id: img.id,
        });
      }
    });
  }

  // Fallback to default image if no images available
  if (carouselImages.length === 0) {
    carouselImages.push({
      url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1974&auto=format&fit=crop",
      id: "default",
    });
  }

  return (
    <Box>
      <TopNavbar title="Profile" showBack />
      <Box
        style={{
          height: `calc(100dvh - ${rem(TOP_NAVBAR_HEIGHT_PX)} - ${rem(
            BOTTOM_NAVBAR_HEIGHT_PX
          )} - env(safe-area-inset-bottom) - env(safe-area-inset-top))`,
          marginTop: `calc(${rem(
            TOP_NAVBAR_HEIGHT_PX
          )} + env(safe-area-inset-top))`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <Carousel
            withIndicators={carouselImages.length > 1}
            draggable={carouselImages.length > 1}
            slideSize="100%"
            slideGap={0}
            withControls={false}
            emblaOptions={{
              dragFree: false,
              watchDrag: true,
              // Lower drag threshold - default is 10, we'll use 5 for easier swiping
              dragThreshold: 5,
            }}
            styles={{
              root: {
                height: "100%",
                width: "100%",
                position: "relative",
              },
              viewport: {
                height: "100%",
                cursor: "grab",
                overflow: "hidden",
              },
              slide: {
                height: "100%",
                width: "100%",
                flexShrink: 0,
                minWidth: 0,
              },
              container: {
                height: "100%",
                display: "flex",
              },
              indicator: {
                width: rem(8),
                height: rem(8),
                backgroundColor: "rgba(255, 255, 255, 0.5)",
                transition: "all 0.2s",
              },
              indicators: {
                bottom: `calc(${rem(100)} + env(safe-area-inset-bottom))`,
                zIndex: 10,
              },
            }}
          >
            {carouselImages.length > 0 ? (
              carouselImages.map((img, index) => (
                <Carousel.Slide key={img.id || `slide-${index}`}>
                  <Image
                    src={img.url}
                    alt={`Profile image ${index + 1}`}
                    radius={0}
                    h="100%"
                    w="100%"
                    fit="cover"
                    loading="lazy"
                  />
                </Carousel.Slide>
              ))
            ) : (
              <Carousel.Slide key="default">
                <Image
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1974&auto=format&fit=crop"
                  alt="Default profile"
                  radius={0}
                  h="100%"
                  w="100%"
                  fit="cover"
                />
              </Carousel.Slide>
            )}
          </Carousel>

          <Box
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0.95) 100%)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />

          <Stack
            gap={4}
            style={{
              position: "absolute",
              left: rem(16),
              bottom: `calc(${rem(80)} + env(safe-area-inset-bottom))`,
              right: rem(16),
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <Group gap={6} align="center">
              <Text fw={700} fz={24}>
                {profile.username || "User"}
              </Text>
              {profile.isVerified && (
                <Text fz="sm" c="blue" fw={600}>
                  ✅
                </Text>
              )}
            </Group>
            <Text c="dimmed" fz="sm">
              {profile.fullName || "Unknown"}
            </Text>
            <Text fz="sm" style={{ maxWidth: rem(320), lineHeight: 1.5 }}>
              {profile.bio || "No bio available"}
            </Text>
          </Stack>

          <Stack
            gap="xs"
            style={{
              position: "absolute",
              bottom: isAdmin && !isOwnProfile
                ? `calc(${rem(140)} + env(safe-area-inset-bottom))`
                : `calc(${rem(16)} + env(safe-area-inset-bottom))`,
              left: rem(16),
              right: rem(16),
              zIndex: 2,
              pointerEvents: "auto",
            }}
          >
            {!isOwnProfile && (
              <Button
                variant="filled"
                color="yellow"
                radius="md"
                onClick={handleStartChat}
                loading={isStartingChat}
                fullWidth
              >
                Message
              </Button>
            )}
            {isAdmin && !isOwnProfile && (
              <>
                {profile.isVerified ? (
                  <Button
                    variant="filled"
                    color="red"
                    radius="md"
                    onClick={handleUnverify}
                    loading={isUnverifying}
                    fullWidth
                  >
                    Unverify User
                  </Button>
                ) : (
                  <Button
                    variant="filled"
                    color="blue"
                    radius="md"
                    onClick={handleVerify}
                    loading={isVerifying}
                    fullWidth
                  >
                    Verify User (Admin)
                  </Button>
                )}
              </>
            )}
          </Stack>

          <Group
            justify="center"
            gap={36}
            style={{
              position: "absolute",
              bottom:
                isAdmin && !isOwnProfile
                  ? `calc(${rem(280)} + env(safe-area-inset-bottom))`
                  : isOwnProfile
                  ? `calc(${rem(16)} + env(safe-area-inset-bottom))`
                  : `calc(${rem(80)} + env(safe-area-inset-bottom))`,
              left: rem(16),
              right: rem(16),
              zIndex: 2,
              pointerEvents: "none",
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
      </Box>

      <BottomNavbar />
    </Box>
  );
}

export default ProfileViewPage;
