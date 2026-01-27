'use client';

import { useEffect, useTransition, useState, useRef } from 'react';
import { HomeIcon } from '@/components/icons/HomeIcon';
import { InboxIcon } from '@/components/icons/InboxIcon';
import { ProfileIcon } from '@/components/icons/ProfileIcon';
import { UserStatusIcon } from '@/components/icons/UserStatusIcon';
import {
  ActionIcon,
  Box,
  Group,
  Loader,
  Text,
  rem,
} from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import { CreatePostIcon } from '../icons/CreatePostIcon';

import { useAdminCheck } from '@/hooks/useAdmin';
import { useUserStatusCheck } from '@/hooks/useUser';

export const BOTTOM_NAVBAR_HEIGHT_PX = 72;

export function BottomNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetHref, setTargetHref] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: adminData } = useAdminCheck();
  const { data: statusData } = useUserStatusCheck();

  const isAdmin = adminData?.isAdmin ?? false;
  const isSuspended = statusData?.isSuspended ?? false;

  const isActive = (href: string) => pathname === href;
  const isLoading = (href: string) =>
    isPending && targetHref === href;

  useEffect(() => {
    if (!isPending) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setTargetHref(null);
    }
  }, [isPending]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = (href: string) => {
    if (isPending) return;
    if (href === pathname) return;

    setTargetHref(href);

    // Safety timeout: clear loading state after 5 seconds if navigation doesn't complete
    timeoutRef.current = setTimeout(() => {
      console.warn(
        `Navigation to ${href} did not complete within 5 seconds`,
      );
      setTargetHref(null);
    }, 5000);

    startTransition(() => {
      try {
        router.push(href);
      } catch (error) {
        console.error(`Navigation to ${href} failed:`, error);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setTargetHref(null);
      }
    });
  };

  const navItems = isSuspended
    ? [
        {
          label: 'Home',
          icon: (
            <HomeIcon
              color={isActive('/feed') ? '#FFFFFF' : '#989898'}
            />
          ),
          href: '/feed',
        },
      ]
    : ([
        {
          label: 'Home',
          icon: (
            <HomeIcon
              color={isActive('/feed') ? '#FFFFFF' : '#989898'}
            />
          ),
          href: '/feed',
        },
        {
          label: 'Create post',
          icon: (
            <CreatePostIcon
              color={isActive('/create') ? '#FFFFFF' : '#989898'}
            />
          ),
          href: '/create',
        },
        {
          label: 'Inbox',
          icon: (
            <InboxIcon
              color={isActive('/inbox') ? '#FFFFFF' : '#989898'}
            />
          ),
          href: '/inbox',
        },
        ...(isAdmin
          ? [
              {
                label: 'User Status',
                icon: (
                  <UserStatusIcon
                    color={
                      isActive('/admin/users') ? '#FFFFFF' : '#989898'
                    }
                  />
                ),
                href: '/admin/users',
              },
            ]
          : []),
        {
          label: 'Profile',
          icon: (
            <ProfileIcon
              color={isActive('/profile') ? '#FFFFFF' : '#989898'}
            />
          ),
          href: '/profile',
        },
      ] as const);

  return (
    <Box
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="#0F0F0F"
      style={{
        borderTop: '1px solid var(--mantine-color-dark-4)',
        height: `calc(${rem(
          BOTTOM_NAVBAR_HEIGHT_PX,
        )} + env(safe-area-inset-bottom))`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Group justify="space-around" py="xs">
        {navItems.map((item, idx) => {
          const active = isActive(item.href);
          const loading = isLoading(item.href);

          return (
            <Box
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: active
                  ? 'var(--mantine-color-gray-0)'
                  : 'var(--mantine-color-gray-4)',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
                paddingBottom: rem(8),
                borderBottom: active ? '2px solid white' : 'none',
              }}
              onClick={() => handleClick(item.href)}
            >
              <ActionIcon
                variant="subtle"
                size="lg"
                color="gray"
                disabled={loading}
              >
                {loading ? <Loader size="sm" /> : item.icon}
              </ActionIcon>
              <Text size="xs">{item.label}</Text>
            </Box>
          );
        })}
      </Group>
    </Box>
  );
}
