'use client';

import {
  Button,
  Container,
  Stack,
  Text,
  Box,
  rem,
  Image,
} from '@mantine/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { LineIcon } from '@/components/icons/LineIcon';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');

  const handleSkip = () => {
    // Redirect to feed page
    router.push('/feed');
  };

  const handleAddLineOA = () => {
    // TODO: Implement Line OA verification flow
    // For now, redirect to feed
    router.push('/feed');
  };

  return (
    <Container
      px="md"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: rem(812),
        maxWidth: rem(375),
        justifyContent: 'center',
      }}
    >
      <Stack gap="xl" align="center">
        <Box
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: rem(120),
            height: rem(120),
            borderRadius: '50%',
            backgroundColor: '#131313',
            border: '2px solid #FFD400',
          }}
        >
          <LineIcon />
        </Box>

        <Stack gap="md" align="center">
          <Text size="xl" fw={700} ta="center">
            เพิ่ม Line OA เพื่อยืนยันตัวตน
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            เพื่อความปลอดภัยและความน่าเชื่อถือ กรุณาเพิ่ม Line OA
            เพื่อยืนยันตัวตนของคุณ
          </Text>
        </Stack>

        <Stack gap="md" w="100%">
          <Button
            fullWidth
            variant="primary"
            leftSection={<LineIcon />}
            onClick={handleAddLineOA}
          >
            เพิ่ม Line OA
          </Button>

          <Button
            fullWidth
            variant="subtle"
            onClick={handleSkip}
            styles={{
              root: {
                color: 'white',
              },
            }}
          >
            ข้าม
          </Button>
        </Stack>

        <Text size="xs" c="dimmed" ta="center">
          หากข้าม คุณสามารถใช้งานได้ แต่จะไม่มีเครื่องหมาย verify
          และสถานะจะยังเป็นรอยืนยันตัวตน
        </Text>
      </Stack>
    </Container>
  );
}
