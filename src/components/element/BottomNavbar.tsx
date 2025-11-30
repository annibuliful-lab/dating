"use client";

import { HomeIcon } from "@/components/icons/HomeIcon";
import { InboxIcon } from "@/components/icons/InboxIcon";
import { ProfileIcon } from "@/components/icons/ProfileIcon";
import { UserStatusIcon } from "@/components/icons/UserStatusIcon";
import { ActionIcon, Box, Group, Text, rem } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";
import { CreatePostIcon } from "../icons/CreatePostIcon";
import { useEffect, useState } from "react";

export const BOTTOM_NAVBAR_HEIGHT_PX = 72;

export function BottomNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const isActive = (href: string) => pathname === href;

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/api/admin/check");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    };
    checkAdminStatus();
  }, []);

  const navItems = [
    {
      label: "Home",
      icon: <HomeIcon color={isActive("/feed") ? "#FFFFFF" : "#989898"} />,
      href: "/feed",
    },
    {
      label: "Create post",
      icon: (
        <CreatePostIcon color={isActive("/create") ? "#FFFFFF" : "#989898"} />
      ),
      href: "/create",
    },
    {
      label: "Inbox",
      icon: <InboxIcon color={isActive("/inbox") ? "#FFFFFF" : "#989898"} />,
      href: "/inbox",
    },
    ...(isAdmin
      ? [
          {
            label: "User Status",
            icon: (
              <UserStatusIcon
                color={
                  isActive("/admin/users") ? "#FFFFFF" : "#989898"
                }
              />
            ),
            href: "/admin/users",
          },
        ]
      : []),
    {
      label: "Profile",
      icon: (
        <ProfileIcon color={isActive("/profile") ? "#FFFFFF" : "#989898"} />
      ),
      href: "/profile",
    },
  ] as const;

  return (
    <Box
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="#0F0F0F"
      style={{
        borderTop: "1px solid var(--mantine-color-dark-4)",
        height: `calc(${rem(
          BOTTOM_NAVBAR_HEIGHT_PX
        )} + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Group justify="space-around" py="xs">
        {navItems.map((item, idx) => (
          <Box
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: isActive(item.href)
                ? "var(--mantine-color-gray-0)"
                : "var(--mantine-color-gray-4)",
              cursor: "pointer",
            }}
            onClick={() => router.push(item.href)}
          >
            <ActionIcon variant="subtle" size="lg" color="gray">
              {item.icon}
            </ActionIcon>
            <Text size="xs">{item.label}</Text>
          </Box>
        ))}
      </Group>
    </Box>
  );
}
