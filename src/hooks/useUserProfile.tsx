import { UserProfile } from '@/@types/user';
import { getUserProfile } from '@/services/profile/get';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export const useUserProfile = () => {
  const { data, status } = useSession();
  const userId = data?.user.id;
  const [userProfile, setUserProfile] = useState<UserProfile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    if (status === 'loading') return;

    if (!userId || status === 'unauthenticated') {
      setUserProfile(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    (async () => {
      try {
        const profile = await getUserProfile(userId);
        if (cancelled) return;
        setUserProfile(profile);
      } catch (error) {
        if (cancelled) return;
        console.error('useUserProfile: ', error);
        setError(error as never);
        setUserProfile(undefined);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, status]);

  return {
    userProfile,
    loading,
    error,
    status,
  };
};
