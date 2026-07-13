import { useInfiniteQuery } from '@/hooks/useInfiniteQuery';

type Chat = {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
  };
  ChatParticipant: Array<{
    id: string;
    userId: string;
    isAdmin: boolean;
    User: {
      id: string;
      fullName: string;
      username: string;
      profileImageKey: string | null;
      status: string;
    };
  }>;
  latestMessage: {
    id: string;
    text: string | null;
    createdAt: string;
    User: {
      fullName: string;
    };
  } | null;
};

export function useAdminChats() {
  const result = useInfiniteQuery<Chat[]>('/api/admin/chats', {
    retries: 0,
    pageSize: 10,
  });

  return result;
}
