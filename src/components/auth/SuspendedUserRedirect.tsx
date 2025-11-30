'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Box, Container, Text, Title, Stack } from '@mantine/core';

export function SuspendedUserRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSuspended, setIsSuspended] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && !checked) {
      const checkUserStatus = async () => {
        setChecked(true);
        try {
          const response = await fetch('/api/user/status-check');
          if (response.ok) {
            const data = await response.json();
            if (data.isSuspended) {
              setIsSuspended(true);
            }
          }
        } catch (err) {
          console.error('Error checking user status:', err);
        }
      };

      checkUserStatus();
    }
  }, [status, session, checked]);

  if (isSuspended) {
    return (
      <Box>
        <Container size="xs" py="xl">
          <Stack align="center" gap="md">
            <Title order={2} c="red">
              บัญชีถูกพักการใช้งาน
            </Title>
            <Text c="dimmed" ta="center">
              บัญชีของคุณถูกพักการใช้งานชั่วคราว
              <br />
              กรุณาติดต่อผู้ดูแลระบบเพื่อขอความช่วยเหลือ
            </Text>
          </Stack>
        </Container>
      </Box>
    );
  }

  return null;
}

