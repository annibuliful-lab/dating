'use client';

import { UserProfile } from '@/@types/user';
import { supabase } from '@/client/supabase';
import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from '@/components/element/BottomNavbar';
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from '@/components/element/TopNavbar';
import { AgeIcon } from '@/components/icons/AgeIcon';
import { CheckCircle } from '@/components/icons/CheckCircle';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { RulerIcon } from '@/components/icons/RulerIcon';
import { SingleIcon } from '@/components/icons/SingleIcon';
import { useApiMutation } from '@/hooks/useApiMutation';
import { getUserProfile } from '@/services/profile/get';
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
  ThemeIcon,
} from '@mantine/core';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function ProfileViewPage() {
  const params = useParams<{ userId: string }>();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    isAdmin: boolean;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnverifying, setIsUnverifying] = useState(false);

  const verifyMutation = useApiMutation<{ success: boolean }>(
    `/api/users/${params.userId}/verify`
  );
  const unverifyMutation = useApiMutation<{ success: boolean }>(
    `/api/users/${params.userId}/unverify`
  );

  useEffect(() => {
    const fetchProfile = async () => {
      if (!params.userId) {
        setError('User ID not provided');
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
            .from('User')
            .select('isAdmin')
            .eq('id', session.user.id)
            .single();
          setCurrentUser(currentUserData);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
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
      await verifyMutation.mutate({ verificationType: 'ADMIN' });
      // Refresh profile after verification
      window.location.reload();
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error verifying user:', error);
        alert(
          error?.message || 'Failed to verify. Please try again.'
        );
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
        console.error('Error unverifying user:', error);
        alert(
          error?.message || 'Failed to unverify. Please try again.'
        );
      }
    } finally {
      setIsUnverifying(false);
    }
  };

  const isAdmin = currentUser?.isAdmin === true;
  const isOwnProfile = session?.user?.id === params.userId;

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
              {error || 'Profile not found'}
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
        <Box h="100%" style={{ position: 'relative' }}>
          <Image
            src={
              profile.avatarUrl ||
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1974&auto=format&fit=crop'
            }
            alt="profile"
            radius={0}
            h="100%"
            w="100%"
            fit="cover"
          />

          <Box
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0.95) 100%)',
            }}
          />

          <Stack
            gap={4}
            style={{
              position: 'absolute',
              left: rem(16),
              bottom: rem(96),
            }}
          >
            <Group gap={6} align="center">
              <Text fw={700} fz={24}>
                {profile.username || 'User'}
              </Text>
              {profile.isVerified && (
                <ThemeIcon
                  size={20}
                  radius="xl"
                  color={
                    profile.verificationType === 'ADMIN'
                      ? 'blue'
                      : 'teal'
                  }
                  variant="light"
                  title={
                    profile.verificationType === 'ADMIN'
                      ? 'Verified by Admin'
                      : 'Verified by User'
                  }
                >
                  <CheckCircle />
                </ThemeIcon>
              )}
            </Group>
            <Text c="dimmed" fz="sm">
              {profile.fullName || 'Unknown'}
            </Text>
            <Text
              fz="sm"
              style={{ maxWidth: rem(320), lineHeight: 1.5 }}
            >
              {profile.bio || 'No bio available'}
            </Text>
          </Stack>

          {isAdmin && !isOwnProfile && (
            <Stack
              gap="xs"
              style={{
                position: 'absolute',
                bottom: rem(30),
                left: rem(16),
                right: rem(16),
              }}
            >
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
            </Stack>
          )}

          <Group
            justify="center"
            gap={36}
            style={{
              position: 'absolute',
              bottom: isAdmin && !isOwnProfile ? rem(90) : rem(30),
              left: rem(16),
              right: rem(16),
            }}
          >
            <Stack gap={2} align="center">
              <SingleIcon />
              <Text fz="sm">
                {profile.relationShipStatus || 'N/A'}
              </Text>
            </Stack>
            <Stack gap={2} align="center">
              <GenderIcon />
              <Text fz="sm">{profile.gender || 'N/A'}</Text>
            </Stack>
            <Stack gap={2} align="center">
              <AgeIcon />
              <Text fz="sm">{age || 'N/A'}</Text>
            </Stack>
            <Stack gap={2} align="center">
              <RulerIcon />
              <Text fz="sm">
                {profile.height && profile.weight
                  ? `${profile.height}/${profile.weight}`
                  : 'N/A'}
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
