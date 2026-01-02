'use client';

import { useUserStatusCheck } from '@/hooks/useUser';
import { Box, Container, Stack, Text, Title } from '@mantine/core';
import { useSession } from 'next-auth/react';

export function SuspendedUserRedirect() {
  const { data: session, status } = useSession();
  
  const { data } = useUserStatusCheck({
    enabled: status === 'authenticated' && !!session?.user?.id
  });

  const isSuspended = data?.isSuspended;

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

