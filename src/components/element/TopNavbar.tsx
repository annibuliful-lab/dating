'use client';

import { BackIcon } from '@/components/icons/BackIcon';
import { Box, Group, Text, rem } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

export const TOP_NAVBAR_HEIGHT_PX = 52;
const DEFAULT_BACK_FALLBACK = '/feed';

type TopNavbarProps = {
  title: string;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
};

export function TopNavbar({
  title,
  showBack,
  backLabel,
  onBack,
  rightSlot,
}: TopNavbarProps) {
  const router = useRouter();
  const { t } = useLocale();
  const resolvedBackLabel = backLabel ?? t('back');
  const titleTranslations: Record<string, string> = {
    'Feed and Contents': t('feed'),
    Feed: t('feed'),
    Inbox: t('inbox'),
    Profile: t('profile'),
    'Create post': t('createPost'),
    'User Status': t('userStatus'),
    'Admin Dashboard': t('adminDashboard'),
  };
  const resolvedTitle = titleTranslations[title] ?? title;

  const handleBack = () => {
    if (onBack) return onBack();

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(DEFAULT_BACK_FALLBACK);
  };

  return (
    <Box
      pos="fixed"
      top={0}
      left={0}
      right={0}
      bg="#0F0F0F"
      style={{
        borderBottom: '1px solid var(--mantine-color-dark-4)',
        height: `calc(${rem(TOP_NAVBAR_HEIGHT_PX)} + env(safe-area-inset-top))`,
        paddingTop: 'env(safe-area-inset-top)',
        zIndex: 100,
      }}
    >
      <Group
        h={rem(TOP_NAVBAR_HEIGHT_PX)}
        px="md"
        justify="space-between"
        wrap="nowrap"
        style={{ position: 'relative' }}
      >
        <Box
          w={84}
          onClick={showBack ? handleBack : undefined}
          style={{ cursor: showBack ? 'pointer' : 'default' }}
        >
          {showBack && (
            <Group gap={6} wrap="nowrap">
              <BackIcon />
              <Text fw={600}>{resolvedBackLabel}</Text>
            </Group>
          )}
        </Box>

        <Text
          fz="lg"
          fw={600}
          c="white"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {resolvedTitle}
        </Text>

        <Box w={84} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {rightSlot}
        </Box>
      </Group>
    </Box>
  );
}
