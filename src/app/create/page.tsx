'use client';

import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from '@/components/element/TopNavbar';
import { CameraIcon } from '@/components/icons/CameraIcon';
import { compressImage } from '@/lib/image-compression';
import { mediaService } from '@/services/supabase/media';
import { postService } from '@/services/supabase/posts';
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
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

const MAX_IMAGES = 5;
const MAX_CHARACTERS = 300;

function CreatePostPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [router, status]);

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (selectedImages.length + files.length > MAX_IMAGES) {
      notifications.show({
        title: t('tooManyImages'),
        message: t('maxImages').replace('{count}', String(MAX_IMAGES)),
        color: 'red',
      });
      return;
    }

    // Validate and compress all files
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      // Validate file
      const validation = mediaService.validateFile(file);
      if (!validation.valid) {
        notifications.show({
          title: t('invalidFile'),
          message:
            validation.error || t('validImageRequired'),
          color: 'red',
        });
        continue;
      }

      // Compress image
      try {
        const compressedFile = await compressImage(
          file,
          1920,
          1920,
          0.8
        );
        validFiles.push(compressedFile);
        const preview = mediaService.createPreviewUrl(compressedFile);
        previews.push(preview);
      } catch (error) {
        console.error('Error compressing image:', error);
        // Use original file if compression fails
        validFiles.push(file);
        const preview = mediaService.createPreviewUrl(file);
        previews.push(preview);
      }
    }

    // Update state
    setSelectedImages((prev) => [...prev, ...validFiles]);
    setImagePreviews((prev) => [...prev, ...previews]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    // Revoke preview URL
    if (imagePreviews[index]) {
      mediaService.revokePreviewUrl(imagePreviews[index]);
    }
    // Remove from arrays
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && selectedImages.length === 0) {
      notifications.show({
        title: t('error'),
        message: t('postContentRequired'),
        color: 'red',
      });
      return;
    }

    if (content.length > MAX_CHARACTERS) {
      notifications.show({
        title: t('error'),
        message: t('maxCharacters').replace('{count}', String(MAX_CHARACTERS)),
        color: 'red',
      });
      return;
    }

    if (!session?.user?.id) {
      notifications.show({
        title: t('error'),
        message: t('loginRequiredToPost'),
        color: 'red',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrls: string[] = [];

      // Upload all images if selected
      if (selectedImages.length > 0) {
        const uploadResults = await mediaService.uploadMultipleMedia(
          selectedImages,
          'dating',
          'posts'
        );
        imageUrls = uploadResults.map((result) => result.publicUrl);
      }

      const postData = {
        id: crypto.randomUUID(),
        authorId: session.user.id,
        content: { text: content.trim() },
        visibility: 'PUBLIC' as const,
        imageUrl: imageUrls.length > 0 ? imageUrls : null,
        updatedAt: new Date().toISOString(),
      };

      await postService.createPost(postData);

      notifications.show({
        title: t('success'),
        message: t('postCreated'),
        color: 'green',
      });

      // Clean up preview URLs
      imagePreviews.forEach((preview) => {
        mediaService.revokePreviewUrl(preview);
      });

      router.push('/feed');
    } catch (error) {
      notifications.show({
        title: t('error'),
        message:
          error instanceof Error
            ? error.message
            : t('failedToCreatePost'),
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Box>
        <TopNavbar title={t('createPost')} showBack />
        <Container
          size="xs"
          pt="md"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
        >
          <Text>{t('loading')}</Text>
        </Container>
      </Box>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <Box>
      <TopNavbar
        title={t('createPost')}
        showBack
        rightSlot={
          <Button
            variant="subtle"
            color="white"
            size="sm"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={
              (!content.trim() && selectedImages.length === 0) ||
              content.length > MAX_CHARACTERS
            }
          >
            Post
          </Button>
        }
      />

      <Container
        size="xs"
        pt="md"
        px="md"
        mt={rem(TOP_NAVBAR_HEIGHT_PX)}
      >
        <Stack gap="lg">
          {/* User Profile Section */}
          <Group gap="sm" align="center">
            <Avatar
              radius="xl"
              color="gray"
              size="md"
              src={session?.user?.image}
            >
              {session?.user?.name?.charAt(0) || 'U'}
            </Avatar>
            <Text fw={600} c="white">
              {session?.user?.name || 'User'}
            </Text>
          </Group>

          {/* Content Input */}
          <Stack gap="xs">
            <Textarea
              placeholder={t('createPostPlaceholder')}
              value={content}
              onChange={(event) =>
                setContent(event.currentTarget.value)
              }
              minRows={6}
              maxRows={12}
              autosize
              maxLength={MAX_CHARACTERS}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              styles={{
                input: {
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: rem(16),
                  lineHeight: 1.6,
                  '&::placeholder': {
                    color: '#989898',
                  },
                  '&:focus': {
                    border: 'none',
                    outline: 'none',
                  },
                },
              }}
            />
            <Text size="xs" c="dimmed" ta="right">
              {content.length}/{MAX_CHARACTERS}
            </Text>
          </Stack>

          {/* Image Previews */}
          {imagePreviews.length > 0 && (
            <SimpleGrid
              cols={imagePreviews.length === 1 ? 1 : 2}
              spacing="sm"
            >
              {imagePreviews.map((preview, index) => (
                <Box key={index} pos="relative">
                  <Image
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    radius="md"
                    fit="cover"
                    mah={300}
                  />
                  <CloseButton
                    pos="absolute"
                    top={10}
                    right={10}
                    size="md"
                    radius="xl"
                    variant="filled"
                    onClick={() => handleRemoveImage(index)}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                    }}
                  />
                </Box>
              ))}
            </SimpleGrid>
          )}

          {/* Camera Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          {selectedImages.length < MAX_IMAGES && (
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
                Add photos to your post ({selectedImages.length}/
                {MAX_IMAGES})
              </Text>
            </Group>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

export default CreatePostPage;
