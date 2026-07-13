import { UserProfile } from '@/@types/user';
import { getUserProfile } from '@/services/profile/get';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

export const USER_PROFILE_UPDATED_EVENT = 'user-profile-updated';
const PROFILE_FETCH_TIMEOUT_MS = 10000;

export function notifyUserProfileUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(USER_PROFILE_UPDATED_EVENT));
}

async function getUserProfileWithTimeout(userId: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getUserProfile(userId),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Profile request timed out')),
          PROFILE_FETCH_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const useUserProfile = () => {
  const { data, status } = useSession();
  const userId = data?.user.id;
  const [userProfile, setUserProfile] = useState<UserProfile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();

  const refetch = useCallback(async () => {
    if (!userId || status !== 'authenticated') {
      setUserProfile(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const profile = await getUserProfileWithTimeout(userId);
      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.error('useUserProfile: ', error);
      setError(error as Error);
      setUserProfile(undefined);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [userId, status]);

  useEffect(() => {
    if (status === 'loading') return;

    let cancelled = false;
    const fetchProfile = async () => {
      if (!userId || status === 'unauthenticated') {
        setUserProfile(undefined);
        setError(undefined);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        const profile = await getUserProfileWithTimeout(userId);
        if (cancelled) return;
        setUserProfile(profile);
      } catch (error) {
        if (cancelled) return;
        console.error('useUserProfile: ', error);
        setError(error as Error);
        setUserProfile(undefined);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [userId, status]);

  useEffect(() => {
    window.addEventListener(USER_PROFILE_UPDATED_EVENT, refetch);
    return () =>
      window.removeEventListener(USER_PROFILE_UPDATED_EVENT, refetch);
  }, [refetch]);

  return {
    userProfile,
    loading,
    error,
    status,
    refetch,
  };
};
