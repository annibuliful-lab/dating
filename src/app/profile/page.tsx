'use client';

import { BottomNavbar } from '@/components/element/BottomNavbar';
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from '@/components/element/TopNavbar';
import { CheckCircle } from '@/components/icons/CheckCircle';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
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
} from '@mantine/core';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function ProfilePage() {
  const router = useRouter();
  const { data, status } = useSession();
  const userId = data?.user.id;

  const { userProfile, loading } = useUserProfile(userId as string);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const verifyMutation = useApiMutation<{ success: boolean }>(
    `/api/users/${userId}/verify`
  );

  const handleVerify = async () => {
    if (!userId) return;
    
    try {
      setIsVerifying(true);
      await verifyMutation.mutate({ verificationType: "USER" });
      // Refresh profile after verification
      window.location.reload();
    } catch (error) {
      console.error("Error verifying user:", error);
      alert("Failed to verify. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if ((loading && status === 'loading') || !userProfile) {
    return null;
  }

  return (
    <Box>
      <TopNavbar title="Profile" />
      <Container
        size="xs"
        pt="md"
        px="md"
        mt={rem(TOP_NAVBAR_HEIGHT_PX)}
      >
        <Stack align="center" gap="xs" pb="lg">
          {/* Avatar */}
          <Box
            style={{
              width: rem(150),
              height: rem(150),
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1px solid var(--mantine-color-dark-4)',
            }}
          >
            <Image
              src={userProfile.avatarUrl}
              alt="Toxic_cat profile"
              w="100%"
              h="100%"
              fit="cover"
            />
          </Box>
          <Flex direction="column" align="center">
            <Group gap={6} align="center">
              <Text fw={800} fz={20}>
                {userProfile.username}
              </Text>
              {userProfile.isVerified && (
                <ThemeIcon
                  size={22}
                  radius="xl"
                  color={userProfile.verificationType === "ADMIN" ? "blue" : "teal"}
                  variant="light"
                  title={
                    userProfile.verificationType === "ADMIN"
                      ? "Verified by Admin"
                      : "Verified by User"
                  }
                >
                  <CheckCircle />
                </ThemeIcon>
              )}
            </Group>
            <Text c="#979797">
              {userProfile.fullName} {userProfile.lastname}
            </Text>
          </Flex>

          <Text ta="center" px="lg" style={{ lineHeight: 1.5 }}>
            {userProfile.bio}
          </Text>

          {!userProfile.isVerified && (
            <Button
              variant="filled"
              color="teal"
              radius="md"
              mt="xs"
              onClick={handleVerify}
              loading={isVerifying}
            >
              Verify Yourself
            </Button>
          )}

          <Button
            variant="secondary"
            color="dark.4"
            radius="md"
            mt="xs"
            onClick={() => router.push('/profile/edit')}
          >
            Edit profile
          </Button>

          <Button
            variant="filled"
            color="red"
            style={{
              border: '#fa5252 solid 1px',
            }}
            onClick={async () => {
              await signOut();
              router.push('/');
            }}
          >
            <Text c="white">Logout</Text>
          </Button>
        </Stack>

        {/* <Stack gap="xs" pb={rem(80)}>
          <Group align="center" gap="sm">
            <Box
              style={{
                width: rem(24),
                height: rem(24),
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1px solid var(--mantine-color-dark-4)',
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
            Full heart, full class, but still have room for one more
            person who gets it.
          </Text>

          <Group justify="space-between" mt="xs">
            <SendIcon />
            <Badge color="teal" radius="xl" variant="light">
              Verified
            </Badge>
          </Group>
        </Stack> */}
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default ProfilePage;
