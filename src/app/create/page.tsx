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

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function CreatePostPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dropTargetImageId, setDropTargetImageId] = useState<string | null>(
    null,
  );
  const draggedImageIdRef = useRef<string | null>(null);
  const dropTargetImageIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [router, status]);

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (selectedImages.length + files.length > MAX_IMAGES) {
      notifications.show({
        title: t('tooManyImages'),
        message: t('maxImages').replace(
          '{count}',
          String(MAX_IMAGES),
        ),
        color: 'red',
      });
      return;
    }

    // Validate and compress all files
    const validImages: SelectedImage[] = [];

    for (const file of files) {
      // Validate file
      const validation = mediaService.validateFile(file);
      if (!validation.valid) {
        notifications.show({
          title: t('invalidFile'),
          message: validation.error || t('validImageRequired'),
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
          0.8,
        );
        validImages.push({
          id: crypto.randomUUID(),
          file: compressedFile,
          previewUrl: mediaService.createPreviewUrl(compressedFile),
        });
      } catch (error) {
        console.error('Error compressing image:', error);
        // Use original file if compression fails
        validImages.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: mediaService.createPreviewUrl(file),
        });
      }
    }

    // Update state
    setSelectedImages((prev) => [...prev, ...validImages]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    // Revoke preview URL
    const image = selectedImages[index];
    if (image) {
      mediaService.revokePreviewUrl(image.previewUrl);
    }
    // Remove the image and its preview together so their order cannot diverge.
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImagePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    imageId: string,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    draggedImageIdRef.current = imageId;
    dropTargetImageIdRef.current = null;
    setDraggedImageId(imageId);
    setDropTargetImageId(null);
  };

  const handleImagePointerMove = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const draggedId = draggedImageIdRef.current;
    if (!draggedId) return;

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-sortable-image-id]');
    const targetId = target?.dataset.sortableImageId;
    if (!targetId || targetId === draggedId) return;

    dropTargetImageIdRef.current = targetId;
    setDropTargetImageId(targetId);
  };

  const handleImagePointerUp = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const draggedId = draggedImageIdRef.current;
    const targetId = dropTargetImageIdRef.current;
    if (draggedId && targetId && draggedId !== targetId) {
      setSelectedImages((currentImages) => {
        const fromIndex = currentImages.findIndex(
          (image) => image.id === draggedId,
        );
        const toIndex = currentImages.findIndex(
          (image) => image.id === targetId,
        );
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          return currentImages;
        }

        const reorderedImages = [...currentImages];
        const [movedImage] = reorderedImages.splice(fromIndex, 1);
        reorderedImages.splice(toIndex, 0, movedImage);
        return reorderedImages;
      });
    }

    draggedImageIdRef.current = null;
    dropTargetImageIdRef.current = null;
    setDraggedImageId(null);
    setDropTargetImageId(null);
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
        message: t('maxCharacters').replace(
          '{count}',
          String(MAX_CHARACTERS),
        ),
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
          selectedImages.map((image) => image.file),
          'dating',
          'posts',
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
      selectedImages.forEach((image) => {
        mediaService.revokePreviewUrl(image.previewUrl);
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

  const isPostDisabled =
    (!content.trim() && selectedImages.length === 0) ||
    content.length > MAX_CHARACTERS;

  return (
    <Box>
      <TopNavbar
        title={t('createPost')}
        showBack
        rightSlot={
          <Button
            variant={isPostDisabled ? 'subtle' : 'primary'}
            color={isPostDisabled ? 'white' : undefined}
            size="sm"
            style={{ height: 'auto', alignSelf: 'center' }}
            styles={{
              root: { borderColor: 'transparent' },
            }}
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isPostDisabled}
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
          {selectedImages.length > 0 && (
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {t('dragToReorderImages')}
              </Text>
              <SimpleGrid
                cols={selectedImages.length === 1 ? 1 : 2}
                spacing="sm"
              >
                {selectedImages.map((image, index) => (
                <Box
                  key={image.id}
                  pos="relative"
                  data-sortable-image-id={image.id}
                  style={{
                    cursor: 'default',
                    opacity: draggedImageId === image.id ? 0.65 : 1,
                    transform:
                      draggedImageId === image.id ? 'scale(1.02)' : 'none',
                    outline:
                      dropTargetImageId === image.id
                        ? '3px solid var(--mantine-color-blue-5)'
                        : 'none',
                    outlineOffset: 2,
                    transition:
                      'opacity 120ms ease, transform 120ms ease, outline 120ms ease',
                  }}
                >
                  <Image
                    src={image.previewUrl}
                    alt={`Preview ${index + 1}`}
                    radius="md"
                    fit="cover"
                    mah={300}
                  />
                  <Box
                    component="button"
                    type="button"
                    aria-label={t('dragToReorderImages')}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      handleImagePointerDown(event, image.id);
                    }}
                    onPointerMove={handleImagePointerMove}
                    onPointerUp={handleImagePointerUp}
                    onPointerCancel={handleImagePointerUp}
                    style={{
                      position: 'absolute',
                      left: 10,
                      bottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 32,
                      border: 0,
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.65)',
                      color: 'white',
                      cursor: draggedImageId ? 'grabbing' : 'grab',
                      touchAction: 'none',
                      fontSize: 20,
                      lineHeight: 1,
                    }}
                  >
                    ⋮⋮
                  </Box>
                  <CloseButton
                    pos="absolute"
                    top={10}
                    right={10}
                    size="md"
                    radius="xl"
                    variant="filled"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => handleRemoveImage(index)}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                    }}
                  />
                </Box>
                ))}
              </SimpleGrid>
            </Stack>
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
