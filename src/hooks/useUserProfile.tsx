import { UserProfile } from '@/@types/user';
import { getUserProfile } from '@/services/profile/get';
import { useEffect, useState } from 'react';

export const useUserProfile = (userId: string) => {
  const [userProfile, setUserProfile] = useState<UserProfile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();

  useEffect(() => {
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
  };
};
