'use client';

import { LineIcon } from '@/components/icons/LineIcon';
import {
  Box,
  Button,
  Container,
  Image,
  Modal,
  rem,
  Stack,
  Text,
  Flex,
} from '@mantine/core';
import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

export function VerifyPrompt() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLocale();

  const handleAddLineOA = () => {
    // Open modal to show QR code
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
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
              {t('addLine')}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              {t('addLineDescription')}
            </Text>
            <Text size="l" ta="center" fw="bold">
              {t('verificationRequired')}
            </Text>
          </Stack>

          <Stack gap="md" w="100%">
            <Button
              fullWidth
              variant="primary"
              leftSection={<LineIcon />}
              onClick={handleAddLineOA}
            >
              {t('addLine')}
            </Button>
          </Stack>

          {/* <Text size="xs" c="dimmed" ta="center">
            หากข้าม คุณสามารถใช้งานได้ แต่จะไม่มีเครื่องหมาย verify
            และสถานะจะยังเป็นรอยืนยันตัวตน
          </Text> */}
        </Stack>
      </Container>

      {/* Modal for LINE OA QR Code */}
      <Modal
        opened={isModalOpen}
        onClose={handleCloseModal}
        title={
          <Text size="lg" fw={700}>
            {t('scanLine')}
          </Text>
        }
        centered
        size="lg"
        styles={{
          content: {
            backgroundColor: '#1a1a1a',
          },
          header: {
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #333',
          },
          title: {
            color: 'white',
          },
          close: {
            color: 'white',
            '&:hover': {
              backgroundColor: '#333',
            },
          },
        }}
      >
        <Stack gap="lg" align="center" py="md">
          <Box>
            <Box
              style={{
                backgroundColor: 'white',
                padding: rem(16),
                borderRadius: rem(12),
              }}
            >
              <Image
                src="/line-qr/woman-relation.png"
                alt="LINE OA QR Code woman-relation"
                width={280}
                height={280}
                fit="contain"
              />
            </Box>
            <Text
              fz="h4"
              mt={12}
              style={{
                textAlign: 'center',
              }}
            >
              ผู้หญิงและคู่รัก
            </Text>
          </Box>

          <Flex justify="space-evenly" gap={32}>
            <Box
              style={{
                backgroundColor: 'white',
                padding: rem(16),
                borderRadius: rem(12),
              }}
            >
              <Image
                src="/line-qr/man-1.png"
                alt="LINE OA QR Code man-1"
                width={280}
                height={280}
                fit="contain"
              />
            </Box>
            <Box
              style={{
                backgroundColor: 'white',
                padding: rem(16),
                borderRadius: rem(12),
              }}
            >
              <Image
                src="/line-qr/man-2.png"
                alt="LINE OA QR Code man-2"
                width={280}
                height={280}
                fit="contain"
              />
            </Box>
          </Flex>
          <Text fz="h4" style={{ textAlign: 'center' }}>
            ผู้ชาย
          </Text>

          <Stack gap="sm" align="center">
            <Text size="sm" ta="center" c="white">
              {t('openLine')}
            </Text>
            <Text size="xs" ta="center" c="dimmed">
              {t('adminReview')}
            </Text>
            <Text size="l" ta="center" fw="bold">
              {t('verificationRequired')}
            </Text>
          </Stack>

          <Stack gap="sm" w="100%">
            <Button
              fullWidth
              variant="primary"
              onClick={handleCloseModal}
              styles={{
                root: {
                  color: 'white',
                },
              }}
            >
              {t('close')}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
}
