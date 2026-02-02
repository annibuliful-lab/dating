'use client';

import { BOTTOM_NAVBAR_HEIGHT_PX } from '@/components/element/BottomNavbar';
import { SearchInput } from '@/components/element/SearchInput';
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from '@/components/element/TopNavbar';
import { useAdminUsers } from '@/hooks/useAdmin';
import {
  Box,
  Button,
  Container,
  Group,
  Loader,
  rem,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type User = {
  id: string;
  username: string;
  name: string | null;
  lastname: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  statusUpdatedAt: string | null;
  role: 'USER' | 'ADMIN';
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type StatusType = 'verification' | 'usage' | 'account';

export default function AdminUsersPage() {
  const router = useRouter();
  const { status } = useSession();

  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusType, setStatusType] =
    useState<StatusType>('verification');
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(
    new Set(),
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const {
    data: usersData,
    loading: usersLoading,
    loadingMore,
    loadMore,
    hasMore,
    refetch: fetchUsers,
    updateUserStatus,
  } = useAdminUsers(searchQuery);
  const users = (usersData as unknown as User[]) || [];
  const loading = usersLoading || initialLoading;

  // Clean up initial loading
  useEffect(() => {
    if (!usersLoading) {
      setInitialLoading(false);
    }
  }, [usersLoading]);

  // Handle infinite scroll
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewport =
      scrollArea.querySelector('[data-radix-scroll-area-viewport]') ||
      scrollArea.querySelector('[class*="ScrollArea-viewport"]');

    if (!viewport) return;

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = viewport;
      const isNearBottom =
        scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom && !loadingMore && hasMore) {
        loadMore();
      }
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, hasMore]);

  const handleStatusChange = async (
    userId: string,
    newValue: string,
  ) => {
    setUpdatingUsers((prev) => new Set(prev).add(userId));

    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      const updateData: { status?: string; isVerified?: boolean } =
        {};

      if (statusType === 'verification') {
        updateData.isVerified = newValue === 'verified';
      } else if (statusType === 'usage') {
        updateData.status = newValue as
          | 'ACTIVE'
          | 'INACTIVE'
          | 'SUSPENDED';
      }

      await updateUserStatus(userId, updateData);

      notifications.show({
        title: 'สำเร็จ',
        message: 'อัปเดตสถานะผู้ใช้แล้ว',
        color: 'green',
      });

      fetchUsers();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถอัปเดตสถานะได้';
      notifications.show({
        title: 'เกิดข้อผิดพลาด',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setUpdatingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const getStatusOptions = () => {
    if (statusType === 'verification') {
      return [
        { value: 'pending', label: 'รอยืนยันตัวตน' },
        { value: 'verified', label: 'ยืนยันตัวตนแล้ว' },
      ];
    } else if (statusType === 'usage') {
      return [
        { value: 'ACTIVE', label: 'การใช้งานปกติ' },
        { value: 'INACTIVE', label: 'ไม่มีการใช้งาน' },
        { value: 'SUSPENDED', label: 'พักการใช้งานชั่วคราว' },
      ];
    }
    return [];
  };

  const getStatusTitle = () => {
    if (statusType === 'verification') {
      return 'ยืนยันตัวตน';
    } else if (statusType === 'usage') {
      return 'สถานะการใช้งานบัญชี';
    } else if (statusType === 'account') {
      return 'บัญชี';
    }
    return '';
  };

  const getCurrentStatusValue = (user: User) => {
    if (statusType === 'verification') {
      return user.isVerified ? 'verified' : 'pending';
    } else if (statusType === 'usage') {
      return user.status;
    }
    return '';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLastUpdatedDate = (user: User) => {
    if (statusType === 'verification') {
      return formatDate(user.verifiedAt);
    } else if (statusType === 'usage') {
      return formatDate(user.statusUpdatedAt);
    }
    return '-';
  };

  if (initialLoading) {
    return (
      <Box>
        <TopNavbar title="User Status" showBack />
        <Container
          size="xs"
          pt="md"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
        >
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <TopNavbar title="User Status" showBack />
      <Container
        size="xl"
        pt="md"
        px="md"
        mt={rem(TOP_NAVBAR_HEIGHT_PX)}
      >
        <Group align="flex-start" gap="md">
          {/* Side Menu */}
          <Box
            style={{
              width: rem(200),
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: rem(16),
            }}
          >
            <Text fw={600} size="lg" c="white" mb="md">
              ปรับสถานะ
            </Text>
            <Stack gap="xs">
              <Button
                variant={
                  statusType === 'verification' ? 'filled' : 'subtle'
                }
                color={
                  statusType === 'verification' ? 'yellow' : 'gray'
                }
                fullWidth
                justify="flex-start"
                onClick={() => setStatusType('verification')}
                styles={{
                  root: {
                    backgroundColor:
                      statusType === 'verification'
                        ? '#FFD700'
                        : 'transparent',
                    color:
                      statusType === 'verification' ? '#000' : '#fff',
                  },
                }}
              >
                ยืนยันตัวตน
              </Button>
              <Button
                variant={statusType === 'usage' ? 'filled' : 'subtle'}
                color={statusType === 'usage' ? 'yellow' : 'gray'}
                fullWidth
                justify="flex-start"
                onClick={() => setStatusType('usage')}
                styles={{
                  root: {
                    backgroundColor:
                      statusType === 'usage'
                        ? '#FFD700'
                        : 'transparent',
                    color: statusType === 'usage' ? '#000' : '#fff',
                  },
                }}
              >
                สถานะบัญชี
              </Button>
            </Stack>
          </Box>

          {/* Main Content */}
          <Box style={{ flex: 1 }}>
            {/* Title and Search Bar */}
            <Group
              justify="space-between"
              mb="md"
              align="center"
              gap="md"
            >
              <Group gap="xs" align="center">
                <Text fw={600} size="lg" c="white">
                  {getStatusTitle()}
                </Text>
                <Text size="sm" c="dimmed" fw={500}>
                  (โหลดแล้ว {users.length} คน
                  {!hasMore && ' • ไม่มีข้อมูลเพิ่มเติม'})
                </Text>
              </Group>
              <SearchInput
                placeholder="ค้นหาจาก ชื่อผู้ใช้ ชื่อ นามสกุล เบอร์ อีเมล"
                onSearch={setSearchQuery}
                debounce={300}
                style={{ flex: 1, maxWidth: rem(400) }}
              />
            </Group>

            {/* Table */}
            <ScrollArea
              h={`calc(100vh - ${rem(
                TOP_NAVBAR_HEIGHT_PX + BOTTOM_NAVBAR_HEIGHT_PX + 200,
              )})`}
              ref={scrollAreaRef}
            >
              <Box
                style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {loading && users.length === 0 && (
                  <Box
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10,
                    }}
                  >
                    <Loader size="md" />
                  </Box>
                )}
                <Table
                  striped
                  highlightOnHover
                  styles={{
                    thead: {
                      backgroundColor: '#0F0F0F',
                    },
                    th: {
                      color: 'white',
                      borderBottom: '1px solid #333',
                    },
                    td: {
                      color: 'white',
                      borderBottom: '1px solid #333',
                    },
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ชื่อผู้ใช้</Table.Th>
                      <Table.Th>ชื่อ</Table.Th>
                      <Table.Th>นามสกุล</Table.Th>
                      <Table.Th>เบอร์โทร</Table.Th>
                      <Table.Th>อีเมล</Table.Th>
                      <Table.Th>สถานะ</Table.Th>
                      <Table.Th>อัพเดทล่าสุด</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.length === 0 ? (
                      <Table.Tr>
                        <Table.Td
                          colSpan={7}
                          style={{ textAlign: 'center' }}
                        >
                          <Text c="dimmed" py="xl">
                            ไม่พบผู้ใช้
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      <>
                        {users.map((user) => (
                          <Table.Tr key={user.id}>
                            <Table.Td>{user.username}</Table.Td>
                            <Table.Td>{user.name || '-'}</Table.Td>
                            <Table.Td>
                              {user.lastname || '-'}
                            </Table.Td>
                            <Table.Td>{user.phone || '-'}</Table.Td>
                            <Table.Td>{user.email || '-'}</Table.Td>
                            <Table.Td>
                              <Select
                                value={getCurrentStatusValue(user)}
                                onChange={(value) =>
                                  value &&
                                  handleStatusChange(user.id, value)
                                }
                                data={getStatusOptions()}
                                disabled={updatingUsers.has(user.id)}
                                styles={{
                                  input: {
                                    backgroundColor: '#131313',
                                    borderColor: '#333',
                                    color: 'white',
                                    minWidth: rem(200),
                                    border: '1px solid #FFD700',
                                  },
                                  option: {
                                    backgroundColor: '#1a1a1a',
                                    color: 'white',
                                  },
                                }}
                              />
                            </Table.Td>
                            <Table.Td>
                              {getLastUpdatedDate(user)}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        {loadingMore && (
                          <Table.Tr>
                            <Table.Td
                              colSpan={7}
                              style={{ textAlign: 'center' }}
                            >
                              <Group justify="center" py="md">
                                <Loader size="sm" />
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </>
                    )}
                  </Table.Tbody>
                </Table>
              </Box>
            </ScrollArea>
          </Box>
        </Group>
      </Container>
    </Box>
  );
}
