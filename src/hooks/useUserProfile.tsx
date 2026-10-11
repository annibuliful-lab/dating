import { UserProfile } from '@/@types/user';
import { getUserProfile } from '@/services/profile/get';
import { invalidateUserApiReads } from '@/services/user-api';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const USER_PROFILE_UPDATED_EVENT = 'user-profile-updated';

export function notifyUserProfileUpdated() {
  if (typeof window === 'undefined') return;
  invalidateUserApiReads('profile');
  window.dispatchEvent(new Event(USER_PROFILE_UPDATED_EVENT));
}

export const useUserProfile = () => {
  const { data, status } = useSession();
  const userId = data?.user.id;
  const scope = JSON.stringify([status, userId, data?.user.role, data?.user.status, data?.user.isVerified]);
  const [userProfile, setUserProfile] = useState<UserProfile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const requestRef = useRef(0);
  const scopeRef = useRef(scope);
  useLayoutEffect(() => { scopeRef.current = scope; }, [scope]);
  const cancelFetch = useCallback(() => { requestRef.current++; }, []);

  const fetchProfile = useCallback(async (force = false) => {
    const requestId = ++requestRef.current;
    const isCurrent = () => requestRef.current === requestId && scopeRef.current === scope;
    if (!userId || status !== 'authenticated') {
      setUserProfile(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const profile = await getUserProfile(userId, force);
      if (!isCurrent()) return;
      setUserProfile(profile);
      return profile;
    } catch (error) {
      if (!isCurrent()) return;
      console.error('useUserProfile: ', error);
      setError(error as Error);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [userId, status, scope]);

  useEffect(() => {
    if (status === 'loading') return;
    void fetchProfile();
    return cancelFetch;
  }, [fetchProfile, status, cancelFetch]);

  const refetch = useCallback(() => fetchProfile(true), [fetchProfile]);
  useEffect(() => {
    window.addEventListener(USER_PROFILE_UPDATED_EVENT, refetch);
    return () => window.removeEventListener(USER_PROFILE_UPDATED_EVENT, refetch);
  }, [refetch]);

  return { userProfile: userProfile?.id === userId ? userProfile : undefined, loading, error, status, refetch };
};
