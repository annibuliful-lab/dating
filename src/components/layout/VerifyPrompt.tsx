'use client';

import { LineIcon } from '@/components/icons/LineIcon';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  Badge,
  Button,
  Card,
  Container,
  Flex,
  Modal,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useState } from 'react';

const LINE_PROFILES = {
  singleMen: {
    appUrl: 'line://ti/p/cFT31iUIWt',
    webUrl: 'https://line.me/ti/p/cFT31iUIWt',
  },
  singleMenAlternative: {
    appUrl: 'line://ti/p/qZEkGGf6pZ',
    webUrl: 'https://line.me/ti/p/qZEkGGf6pZ',
  },
  couplesAndWomen: {
    appUrl: 'line://ti/p/rOmbX0',
    webUrl: 'https://lin.ee/rOmbX0',
  },
};

const VERIFY_COLORS = {
  primary: '#FFD400',
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  male: '#3B82F6',
  couplesWomen: '#EC4899',
};

function Step({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <Flex gap="sm" align="flex-start">
      <ThemeIcon
        size={26}
        radius="xl"
        style={{ backgroundColor: VERIFY_COLORS.primary }}
      >
        <Text size="md" fw={700} c={VERIFY_COLORS.background}>
          {number}
        </Text>
      </ThemeIcon>
      <Text size="md" c="gray.2" pt={2}>
        {children}
      </Text>
    </Flex>
  );
}

export function VerifyPrompt() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLocale();

  const openLineLink = (appUrl: string, webUrl: string) => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(
      window.navigator.userAgent,
    );

    if (!isMobile) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      window.location.href = webUrl;
    }, 1200);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.clearTimeout(fallbackTimer);
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );
    window.location.href = appUrl;
  };

  const lineButton = (
    profile: keyof typeof LINE_PROFILES,
    color: 'blue' | 'pink',
    label = t('openLineToVerify'),
  ) => {
    const link = LINE_PROFILES[profile];
    const buttonColor =
      color === 'blue'
        ? VERIFY_COLORS.male
        : VERIFY_COLORS.couplesWomen;
    return (
      <Button
        component="a"
        href={link.webUrl}
        target="_blank"
        rel="noreferrer"
        fullWidth
        color={color}
        variant="filled"
        styles={{
          root: {
            backgroundColor: buttonColor,
            border: 'none',
            color: '#FFFFFF',
          },
        }}
        leftSection={<LineIcon />}
        onClick={(event) => {
          event.preventDefault();
          openLineLink(link.appUrl, link.webUrl);
        }}
      >
        {label}
      </Button>
    );
  };

  return (
    <Container size="xs" px="md" py="xl">
      <Card
        radius="lg"
        padding="xl"
        withBorder
        style={{
          background: `linear-gradient(145deg, ${VERIFY_COLORS.surface} 0%, ${VERIFY_COLORS.background} 100%)`,
          borderColor: 'rgba(255, 212, 0, 0.35)',
        }}
      >
        <Stack gap="lg">
          <Stack gap="sm" align="center">
            <ThemeIcon
              size={76}
              radius="xl"
              style={{
                backgroundColor: VERIFY_COLORS.primary,
                color: VERIFY_COLORS.background,
              }}
            >
              <LineIcon />
            </ThemeIcon>
            <Badge
              size="lg"
              variant="light"
              style={{
                backgroundColor: 'rgba(255, 212, 0, 0.16)',
                color: VERIFY_COLORS.primary,
              }}
            >
              LINE Verification
            </Badge>
            <Title order={1} ta="center" c="white">
              {t('verifyTitle')}
            </Title>
            <Text ta="center" c="dimmed" size="md" maw={380}>
              {t('verifyIntro')}
            </Text>
          </Stack>

          <Stack gap="sm">
            <Step number="1">{t('verifyStepOne')}</Step>
            <Step number="2">{t('verifyStepTwo')}</Step>
            <Step number="3">{t('verifyStepThree')}</Step>
          </Stack>

          <Button
            fullWidth
            size="lg"
            color="yellow"
            leftSection={<LineIcon />}
            styles={{
              root: {
                backgroundColor: VERIFY_COLORS.primary,
                border: 'none',
                color: VERIFY_COLORS.background,
              },
            }}
            onClick={() => setIsModalOpen(true)}
          >
            {t('addLine')}
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            {t('verificationRequired')}
          </Text>
        </Stack>
      </Card>

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={<Text fw={700}>{t('verifyTitle')}</Text>}
        centered
        size="md"
        styles={{
          inner: {
            alignItems: 'center',
            paddingTop: 16,
            paddingBottom: 16,
          },
          content: {
            backgroundColor: VERIFY_COLORS.surface,
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
          },
          header: {
            backgroundColor: VERIFY_COLORS.surface,
            borderBottom: '1px solid #333',
          },
          title: { color: 'white' },
          close: { color: 'white' },
        }}
      >
        <Stack gap="lg">
          <Text size="md" c="dimmed" mt="md" mb="-8px">
            {t('lineLinks')}
          </Text>

          <Paper
            p="md"
            radius="md"
            withBorder
            bg={VERIFY_COLORS.surfaceElevated}
            style={{ borderColor: '#333' }}
          >
            <Stack gap="sm">
              <Text fw={700} c="white" size="lg">
                {t('verifySingleMen')}
              </Text>
              {lineButton('singleMen', 'blue')}
              <Text ta="center" size="sm" c="dimmed">
                หรือ
              </Text>
              {lineButton('singleMenAlternative', 'blue')}
            </Stack>
          </Paper>

          <Paper
            p="md"
            radius="md"
            withBorder
            bg={VERIFY_COLORS.surfaceElevated}
            style={{ borderColor: '#333' }}
          >
            <Stack gap="sm">
              <Text fw={700} c="white" size="lg">
                {t('verifyCouplesWomen')}
              </Text>
              {lineButton('couplesAndWomen', 'pink')}
            </Stack>
          </Paper>

          {/* <Divider
            label={t('scanQrInstead')}
            labelPosition="center"
            color="dark.4"
          />

          <Stack gap="sm">
            <Text fw={600} size="md">
              {t('verifySingleMen')}
            </Text>
            <Flex gap="sm" justify="center">
              <Image
                src="/line-qr/man-1.png"
                alt="LINE QR Code 1"
                w={130}
                fit="contain"
              />
              <Image
                src="/line-qr/man-2.png"
                alt="LINE QR Code 2"
                w={130}
                fit="contain"
              />
            </Flex>
          </Stack>

          <Box>
            <Text fw={600} size="md" mb="sm">
              {t('verifyCouplesWomen')}
            </Text>
            <Image
              src="/line-qr/woman-relation.png"
              alt="LINE QR Code"
              w={180}
              mx="auto"
              fit="contain"
            />
          </Box> */}

          <Text size="sm" c="dimmed" ta="center">
            {t('adminReview')}
          </Text>
          <Button
            variant="subtle"
            color="gray"
            onClick={() => setIsModalOpen(false)}
          >
            {t('close')}
          </Button>
        </Stack>
      </Modal>
    </Container>
  );
}
