"use client";

import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { CameraIcon } from "@/components/icons/CameraIcon";
import { mediaService } from "@/services/supabase/media";
import { postService } from "@/services/supabase/posts";
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  CloseButton,
  Container,
  Group,
  Image,
  rem,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

function CreatePostPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = mediaService.validateFile(file);
    if (!validation.valid) {
      notifications.show({
        title: "Invalid File",
        message: validation.error || "Please select a valid image file",
        color: "red",
      });
      return;
    }

    // Set selected image and create preview
    setSelectedImage(file);
    const preview = mediaService.createPreviewUrl(file);
    setImagePreview(preview);
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      mediaService.revokePreviewUrl(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !selectedImage) {
      notifications.show({
        title: "Error",
        message: "Please enter some content or select an image for your post",
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
      let imageUrl: string | null = null;

      // Upload image if selected
      if (selectedImage) {
        const uploadResult = await mediaService.uploadMedia(
          selectedImage,
          "dating",
          "posts"
        );
        imageUrl = uploadResult.publicUrl;
      }

      const postData = {
        id: crypto.randomUUID(),
        authorId: session.user.id,
        content: { text: content.trim() },
        visibility: "PUBLIC" as const,
        imageUrl: imageUrl,
        updatedAt: new Date().toISOString(),
      };

      await postService.createPost(postData);

      notifications.show({
        title: "Success",
        message: "Post created successfully!",
        color: "green",
      });

      // Clean up preview URL
      if (imagePreview) {
        mediaService.revokePreviewUrl(imagePreview);
      }

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
            disabled={!content.trim() && !selectedImage}
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

          {/* Image Preview */}
          {imagePreview && (
            <Box pos="relative">
              <Image
                src={imagePreview}
                alt="Preview"
                radius="md"
                fit="contain"
                mah={400}
              />
              <CloseButton
                pos="absolute"
                top={10}
                right={10}
                size="lg"
                radius="xl"
                variant="filled"
                onClick={handleRemoveImage}
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  color: "white",
                }}
              />
            </Box>
          )}

          {/* Camera Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
          <Group>
            <ActionIcon
              size="lg"
              variant="subtle"
              color="gray"
              onClick={() => fileInputRef.current?.click()}
            >
              <CameraIcon color="#989898" />
            </ActionIcon>
            <Text size="sm" c="dimmed">
              Add a photo to your post
            </Text>
          </Group>
        </Stack>
      </Container>

      <BottomNavbar />
    </Box>
  );
}

export default CreatePostPage;
