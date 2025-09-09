"use client";

import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { postService } from "@/services/supabase/posts";
import {
  Avatar,
  Box,
  Button,
  Container,
  Group,
  rem,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function CreatePostPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      notifications.show({
        title: "Error",
        message: "Please enter some content for your post",
        color: "red",
      });
      return;
    }

    if (!session?.user?.id) {
      notifications.show({
        title: "Error",
        message: "You must be logged in to create a post",
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const postData = {
        id: crypto.randomUUID(),
        authorId: session.user.id,
        content: { text: content.trim() },
        visibility: "PUBLIC" as const,
        updatedAt: new Date().toISOString(),
      };

      await postService.createPost(postData);

      notifications.show({
        title: "Success",
        message: "Post created successfully!",
        color: "green",
      });
      router.push("/feed");
    } catch (error) {
      notifications.show({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Failed to create post",
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <Box>
        <TopNavbar title="Create post" showBack />
        <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
          <Text>Loading...</Text>
        </Container>
      </Box>
    );
  }

  if (status === "unauthenticated") {
    router.push("/signin");
    return null;
  }

  return (
    <Box>
      <TopNavbar
        title="Create post"
        showBack
        rightSlot={
          <Button
            variant="subtle"
            color="white"
            size="sm"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!content.trim()}
          >
            Post
          </Button>
        }
      />

      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" pb={rem(BOTTOM_NAVBAR_HEIGHT_PX)}>
          {/* User Profile Section */}
          <Group gap="sm" align="center">
            <Avatar
              radius="xl"
              color="gray"
              size="md"
              src={session?.user?.image}
            >
              {session?.user?.name?.charAt(0) || "U"}
            </Avatar>
            <Text fw={600} c="white">
              {session?.user?.name || "User"}
            </Text>
          </Group>

          {/* Content Input */}
          <Textarea
            placeholder="Your heart has something to say?"
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
            minRows={6}
            maxRows={12}
            autosize
            styles={{
              input: {
                backgroundColor: "transparent",
                border: "none",
                color: "white",
                fontSize: rem(16),
                lineHeight: 1.6,
                "&::placeholder": {
                  color: "#989898",
                },
                "&:focus": {
                  border: "none",
                  outline: "none",
                },
              },
            }}
          />
        </Stack>
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default CreatePostPage;
