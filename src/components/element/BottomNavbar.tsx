import { Group, ActionIcon, Text, Box } from '@mantine/core';
import { HomeIcon } from '@/components/icons/HomeIcon';
import { CreatePostIcon } from '../icons/CreatePostIcon';

export function BottomNavbar() {
  const navItems = [
    {
      label: 'Home',
      icon: <HomeIcon />,
      onClick: () => console.log('Home'),
    },
    {
      label: 'Create Post',
      icon: <CreatePostIcon />,
      onClick: () => console.log('Create Post'),
    },
  ];

  return (
    <Box
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="dark"
      style={{
        borderTop: '1px solid var(--mantine-color-dark-4)',
      }}
    >
      <Group justify="space-around" py="xs">
        {navItems.map((item, idx) => (
          <Box
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: 'var(--mantine-color-gray-4)',
              cursor: 'pointer',
            }}
            onClick={item.onClick}
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
