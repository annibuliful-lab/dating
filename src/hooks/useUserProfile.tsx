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

    if (!userId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const profile = await getUserProfile(userId);
        setUserProfile(profile);
      } catch (error) {
        console.error('useUserProfile: ', error);
        setError(error as never);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return {
    userProfile,
    loading,
    error,
    status,
  };
};
