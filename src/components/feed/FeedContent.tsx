'use client';

import { SuspendedUserRedirect } from '@/components/auth/SuspendedUserRedirect';
import { BOTTOM_NAVBAR_HEIGHT_PX } from '@/components/element/BottomNavbar';
import { SearchInput } from '@/components/element/SearchInput';
import { MoreOptionsIcon } from '@/components/icons/MoreOptionsIcon';
import { TrashIcon } from '@/components/icons/TrashIcon';
import { PostContentText } from '@/components/post/PostContentText';
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from '@/components/element/TopNavbar';
import { useAdminCheck } from '@/hooks/useAdmin';
import { useUserStatusCheck } from '@/hooks/useUser';
import { adminService } from '@/services/admin';
import { adService } from '@/services/supabase/ads';
import { messageService } from '@/services/supabase/messages';
import { postService } from '@/services/supabase/posts';
import { getProfileImageUrl } from '@/services/supabase/storage';
import { Carousel } from '@mantine/carousel';
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Image,
  Loader,
  Menu,
  Modal,
  rem,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Transition,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { EmblaCarouselType } from 'embla-carousel';
import { useSession } from 'next-auth/react';
import { useLocale } from '@/i18n/LocaleProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Post = {
  id: string;
  authorId: string;
  content: {
    text?: string;
    [key: string]: unknown;
  } | null;
  imageUrl?: string[] | null;
  createdAt: string;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
    profileImageUrl?: string | null;
    isVerified?: boolean;
    verifiedByUsername?: string | null;
    role?: 'USER' | 'ADMIN';
  };
};

function FeedContent({ hashtag }: { hashtag?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const { status, data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef('');
  const postsRequestRef = useRef(0);
  const fetchingPostsRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [chatLoading, setChatLoading] = useState<string | null>(null);
  const [infographicModalOpened, setInfographicModalOpened] =
    useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const emblaApiRef = useRef<EmblaCarouselType | null>(null);
  const bannerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [bannerImages, setBannerImages] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [router, status]);

  useEffect(() => {
    if (status === 'authenticated' && !hashtag) {
      (async function () {
        fetchBannerAds();
        // Show infographic modal when entering feed page
        setInfographicModalOpened(true);
      })();
    }
  }, [status, hashtag]);

  const { data: adminData } = useAdminCheck();
  const { data: userStatusData } = useUserStatusCheck();

  useEffect(() => {
    if (adminData) {
      setIsAdmin(adminData.isAdmin || adminData.role === 'ADMIN');
    }
    if (userStatusData) {
      setIsSuspended(userStatusData.isSuspended);
    }
  }, [adminData, userStatusData]);

  const fetchPosts = useCallback(async (offset = 0, isRefresh = false) => {
    if (offset > 0 && fetchingPostsRef.current) return;
    const requestId = ++postsRequestRef.current;
    fetchingPostsRef.current = true;
    setError(null);
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const limit = 20;
      const data = await postService.getPublicPosts(limit, offset, {
        force: isRefresh,
        search: searchQueryRef.current,
        hashtag,
      });

      if (requestId !== postsRequestRef.current) return;

      // Check if we have more posts
      if (data.length < limit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      // Convert profileImageKey to URL for each post
      const postsWithImageUrls = (data || []).map((post: unknown) => {
        const postData = post as {
          User?: {
            profileImageKey?: string | null;
            [key: string]: unknown;
          };
          imageUrl?: string | string[] | null;
          content?: unknown;
          [key: string]: unknown;
        };
        const profileImageUrl = getProfileImageUrl(
          postData.User?.profileImageKey,
        );

        // Handle backward compatibility: convert string imageUrl to array
        let imageUrlArray: string[] | null = null;
        if (postData.imageUrl) {
          if (typeof postData.imageUrl === 'string') {
            imageUrlArray = JSON.parse(postData.imageUrl as string);
          } else if (Array.isArray(postData.imageUrl)) {
            imageUrlArray = postData.imageUrl;
          }
        }

        return {
          ...postData,
          content: postData.content as {
            text?: string;
            [key: string]: unknown;
          } | null,
          imageUrl: imageUrlArray,
          User: {
            ...postData.User,
            profileImageUrl,
          },
        };
      });

      if (offset === 0) {
        setPosts(postsWithImageUrls as Post[]);
      } else {
        setPosts((prevPosts) => [
          ...prevPosts,
          ...(postsWithImageUrls as Post[]),
        ]);
      }
    } catch (err) {
      if (requestId !== postsRequestRef.current) return;
      setError(
        err instanceof Error
          ? err
          : new Error('Failed to fetch posts'),
      );
    } finally {
      if (requestId === postsRequestRef.current) {
        fetchingPostsRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [hashtag]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPosts(0);
    }
    return () => {
      postsRequestRef.current += 1;
      fetchingPostsRef.current = false;
    };
  }, [status, searchQuery, fetchPosts]);

  const handleSearch = useCallback((value: string) => {
    const search = value.trim();
    if (search === searchQueryRef.current) return;
    searchQueryRef.current = search;
    postsRequestRef.current += 1;
    setSearchQuery(search);
    setPosts([]);
    setHasMore(true);
    setError(null);
    setLoading(true);
    setLoadingMore(false);
    setIsRefreshing(false);
    viewportRef.current?.scrollTo({ top: 0 });
  }, []);

  const fetchBannerAds = async (options?: { force?: boolean }) => {
    try {
      const ads = await adService.getActiveAds(options);
      setBannerImages(ads.map((ad) => ad.imageUrl).filter(Boolean));
    } catch (err) {
      console.error('Error fetching banner ads:', err);
      setBannerImages([]);
    }
  };

  // Clean up banner interval on unmount
  useEffect(() => {
    return () => {
      if (bannerIntervalRef.current) {
        clearInterval(bannerIntervalRef.current);
      }
    };
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollElement = viewportRef.current;
    if (scrollElement && scrollElement.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    if (distance > 0) {
      e.preventDefault();
      const maxPull = 100;
      const pullAmount = Math.min(distance * 0.5, maxPull);
      setPullDistance(pullAmount);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling.current && pullDistance > 50) {
      fetchPosts(0, true);
      if (!hashtag) fetchBannerAds({ force: true });
    }
    setPullDistance(0);
    isPulling.current = false;
  };

  const handleSendClick = async (postAuthorId: string) => {
    if (!session?.user?.id || chatLoading) return;

    try {
      setChatLoading(postAuthorId);

      // Get or create a direct chat between current user and post author
      const chat = await messageService.getOrCreateDirectChat(
        session.user.id,
        postAuthorId,
      );

      // Navigate to the chat page
      router.push(`/inbox/${chat.id}`);
    } catch (err) {
      console.error('Error creating/finding chat:', err);
      // You could show a toast notification here
    } finally {
      setChatLoading(null);
    }
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleDeletePost = async () => {
    if (!postToDelete || deleting) return;

    try {
      setDeleting(true);
      if (postToDelete.authorId === session?.user?.id) {
        await postService.deletePost(postToDelete.id);
      } else if (isAdmin) {
        await adminService.deletePost(postToDelete.id);
      } else {
        throw new Error(t('requestDenied'));
      }

      notifications.show({
        title: t('success'),
        message: t('postDeleted'),
        color: 'green',
      });

      // Remove post from local state
      setPosts((currentPosts) => currentPosts.filter((p) => p.id !== postToDelete.id));
      setDeleteModalOpened(false);
      setPostToDelete(null);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('failedToDeletePost');
      notifications.show({
        title: t('error'),
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      <SuspendedUserRedirect />
      <TopNavbar title={hashtag ? `#${hashtag}` : t('feed')} />
      <Container
        size="xs"
        pt="md"
        px="md"
        mt={rem(TOP_NAVBAR_HEIGHT_PX)}
        style={{ marginLeft: 'auto', marginRight: 'auto' }}
      >
        <ScrollArea
          ref={scrollAreaRef}
          viewportRef={viewportRef}
          h={`calc(100vh - ${
            TOP_NAVBAR_HEIGHT_PX + BOTTOM_NAVBAR_HEIGHT_PX + 32
          }px)`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onScrollPositionChange={() => {
            const scrollElement = viewportRef.current;
            if (scrollElement) {
              const { scrollTop, scrollHeight, clientHeight } =
                scrollElement;
              if (
                scrollHeight - scrollTop <= clientHeight + 100 &&
                !loading &&
                !isRefreshing &&
                !loadingMore &&
                hasMore
              ) {
                // Prevent multiple calls
                if (posts.length > 0) {
                  fetchPosts(posts.length);
                }
              }
            }
          }}
        >
          <Box
            style={{
              transform: `translateY(${pullDistance}px)`,
              transition:
                pullDistance === 0 ? 'transform 0.3s ease' : 'none',
            }}
          >
            <Transition
              mounted={isRefreshing || pullDistance > 0}
              transition="fade"
              duration={200}
            >
              {(styles) => (
                <Box
                  style={{
                    ...styles,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    color: 'var(--mantine-color-dimmed)',
                  }}
                >
                  <Text size="sm">
                    {isRefreshing
                      ? t('refreshingFeed')
                      : t('pullToRefresh')}
                  </Text>
                </Box>
              )}
            </Transition>

            <Stack gap="lg">
              {hashtag ? (
                <Stack align="flex-start" gap="xs">
                  <Button component={Link} href="/feed" variant="subtle" color="yellow">
                    {t('backToFeed')}
                  </Button>
                  <Text size="sm" c="dimmed">{t('searchPostsScope')}</Text>
                </Stack>
              ) : <SearchInput
                placeholder={t('searchPosts')}
                aria-label={t('searchPosts')}
                description={t('searchPostsScope')}
                onSearch={handleSearch}
              />}
              {/* Banner Carousel */}
              {bannerImages.length > 0 && (
                <Box
                  style={{
                    width: rem(200),
                    height: rem(50),
                    margin: '0 auto',
                    borderRadius: rem(4),
                    overflow: 'hidden',
                  }}
                >
                  <Carousel
                    getEmblaApi={(embla) => {
                      emblaApiRef.current = embla;

                      // Clear existing interval if any
                      if (bannerIntervalRef.current) {
                        clearInterval(bannerIntervalRef.current);
                      }

                      // Set up auto-rotate interval (6 seconds)
                      if (bannerImages.length > 1) {
                        bannerIntervalRef.current = setInterval(
                          () => {
                            if (emblaApiRef.current) {
                              emblaApiRef.current.scrollNext();
                            }
                          },
                          6000,
                        );
                      }
                    }}
                    withIndicators={false}
                    withControls={false}
                    slideSize="100%"
                    slideGap={0}
                    draggable={false}
                    emblaOptions={{
                      loop: true,
                    }}
                    styles={{
                      root: {
                        width: rem(200),
                        height: rem(50),
                      },
                      viewport: {
                        width: rem(200),
                        height: rem(50),
                      },
                      slide: {
                        width: rem(200),
                        height: rem(50),
                      },
                    }}
                  >
                    {bannerImages.map((imageUrl, index) => (
                      <Carousel.Slide key={index}>
                        <Image
                          src={imageUrl}
                          alt={`Banner ${index + 1}`}
                          width={rem(200)}
                          height={rem(50)}
                          fit="cover"
                          style={{
                            width: rem(200),
                            height: rem(50),
                          }}
                        />
                      </Carousel.Slide>
                    ))}
                  </Carousel>
                </Box>
              )}

              {loading || (isRefreshing && posts.length === 0) ? (
                <Center py="md" role="status" aria-label={t('loadingPosts')}>
                  <Loader color="#D4AF37" />
                </Center>
              ) : error ? (
                <Stack align="center" gap="sm">
                  <Text c="red" role="alert">
                    {t('failedToLoadPosts')}
                  </Text>
                  <Button variant="light" color="yellow" onClick={() => fetchPosts(0, true)}>
                    {t('retry')}
                  </Button>
                </Stack>
              ) : posts.length > 0 ? (
                posts.map((post: Post, index: number) => (
                  <Box key={post.id}>
                    <Stack gap={10}>
                      <Group
                        gap="sm"
                        align="center"
                        justify="space-between"
                        wrap="nowrap"
                      >
                        <Group gap="sm" align="center">
                          <Avatar
                            radius="xl"
                            color="gray"
                            src={
                              post.User.profileImageUrl || undefined
                            }
                            style={{ cursor: 'pointer' }}
                            onClick={() =>
                              handleViewProfile(post.User.id)
                            }
                          >
                            {post.User.fullName?.charAt(0) || '?'}
                          </Avatar>
                          <Group gap={4} align="center">
                            <Text
                              fw={600}
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                handleViewProfile(post.User.id)
                              }
                            >
                              {post.User.username}
                            </Text>
                            {post.User.isVerified && (
                              <Text fz="sm" c="blue" fw={600}>
                                ✅
                              </Text>
                            )}
                          </Group>
                          <Text c="dimmed" size="sm">
                            {formatDate(post.createdAt)}
                          </Text>
                        </Group>
                        {(isAdmin || (!isSuspended && session?.user?.status !== 'SUSPENDED' && post.authorId === session?.user?.id)) && (
                          <Menu position="bottom-end" shadow="md" width={190} withinPortal>
                            <Menu.Target>
                              <ActionIcon
                                size={44}
                                radius="xl"
                                color="gray"
                                variant="subtle"
                                aria-label={t('postOptions')}
                                style={{ flexShrink: 0 }}
                              >
                                <span aria-hidden="true"><MoreOptionsIcon /></span>
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                color="red"
                                leftSection={<TrashIcon />}
                                mih={44}
                                onClick={() => {
                                  setPostToDelete(post);
                                  setDeleteModalOpened(true);
                                }}
                              >
                                {t('deletePost')}
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        )}
                      </Group>

                      {post.content?.text && (
                        <PostContentText
                          text={post.content.text}
                          highlight={searchQuery}
                          hashtagLinks={!isSuspended}
                          highlightHashtag={hashtag}
                          textProps={{
                            fz: 'lg',
                            style: { lineHeight: 1.6 },
                          }}
                        />
                      )}

                      {post.imageUrl && post.imageUrl.length > 0 && (
                        <SimpleGrid
                          cols={post.imageUrl.length === 1 ? 1 : 2}
                          spacing="sm"
                        >
                          {post.imageUrl.map((url, imgIndex) => (
                            <Image
                              key={url}
                              src={url}
                              alt={`Post image ${imgIndex + 1}`}
                              radius="md"
                              fit="contain"
                              mah={500}
                            />
                          ))}
                        </SimpleGrid>
                      )}

                      {!isSuspended && (
                        <Group justify="flex-start" mt="xs">
                          <Box
                            onClick={() =>
                              handleSendClick(post.User.id)
                            }
                            style={{
                              cursor:
                                chatLoading === post.User.id
                                  ? 'not-allowed'
                                  : 'pointer',
                              opacity:
                                chatLoading === post.User.id
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            <Text c="yellow">{t('message')}</Text>
                          </Box>
                        </Group>
                      )}
                    </Stack>
                    {index < posts.length - 1 && (
                      <Divider mt="lg" color="dark.4" />
                    )}
                  </Box>
                ))
              ) : (
                <Text c="dimmed" ta="center" mt="xl" role="status">
                  {t(hashtag ? 'noHashtagPosts' : searchQuery ? 'noMatchingPosts' : 'noFeedPosts')}
                </Text>
              )}
              {loadingMore && (
                <Center py="md" role="status" aria-label={t('loadingPosts')}>
                  <Loader color="#D4AF37" size="sm" />
                </Center>
              )}
            </Stack>
          </Box>
        </ScrollArea>
      </Container>

      {/* Infographic Modal */}
      <Modal
        opened={infographicModalOpened}
        onClose={() => setInfographicModalOpened(false)}
        title={t('infographic')}
        size="lg"
        centered
        styles={{
          title: {
            color: 'white',
            fontWeight: 600,
            textAlign: 'center',
            width: '100%',
            margin: 0,
          },
          header: {
            justifyContent: 'center',
            position: 'relative',
          },
          close: {
            position: 'absolute',
            right: 'var(--mantine-spacing-md)',
          },
        }}
      >
        <Box>
          <Image
            src="/infographic/LINE_20251114_235452.jpg"
            alt={t('infographic')}
            fit="contain"
            radius="md"
          />
        </Box>
      </Modal>

      {/* Delete Post Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          if (deleting) return;
          setDeleteModalOpened(false);
          setPostToDelete(null);
        }}
        title={t('deletePostConfirm')}
        closeOnClickOutside={!deleting}
        closeOnEscape={!deleting}
        withCloseButton={!deleting}
        size="sm"
        centered
        styles={{
          content: { backgroundColor: '#0F0F0F' },
          header: { backgroundColor: '#0F0F0F' },
          body: { backgroundColor: '#0F0F0F' },
          title: { color: 'white' },
        }}
      >
        <Stack gap="md">
          {postToDelete && (
            <Box bg="dark.8" p="md" style={{ borderRadius: rem(8), border: '1px solid var(--mantine-color-dark-4)' }}>
              <Text fw={600} size="sm" mb="xs" style={{ overflowWrap: 'anywhere' }}>
                {postToDelete.User.username}
              </Text>
              <Text size="sm" lineClamp={3} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {postToDelete.content?.text || t('postWithoutText')}
              </Text>
              {postToDelete.imageUrl?.[0] && (
                <Image src={postToDelete.imageUrl[0]} alt={t('postImagePreview')} w={72} h={72} radius="sm" mt="sm" />
              )}
            </Box>
          )}
          <Text size="sm" c="dimmed">{t('deletePostWarning')}</Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              style={{ border: 'none' }}
              data-autofocus
              onClick={() => {
                setDeleteModalOpened(false);
                setPostToDelete(null);
              }}
              disabled={deleting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="filled"
              color="red.8"
              autoContrast={false}
              style={{ borderColor: 'var(--mantine-color-red-8)' }}
              onClick={handleDeletePost}
              loading={deleting}
            >
              {t('deletePost')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default FeedContent;
