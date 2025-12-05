"use client";

import { BUCKET_NAME, supabase } from "@/client/supabase";
import { NewUserRedirect } from "@/components/auth/NewUserRedirect";
import { SuspendedUserRedirect } from "@/components/auth/SuspendedUserRedirect";
import {
  BOTTOM_NAVBAR_HEIGHT_PX,
  BottomNavbar,
} from "@/components/element/BottomNavbar";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { messageService } from "@/services/supabase/messages";
import { postService } from "@/services/supabase/posts";
import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Image,
  Modal,
  rem,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Transition,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Post = {
  id: string;
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
    role?: "USER" | "ADMIN";
  };
};

function FeedPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [chatLoading, setChatLoading] = useState<string | null>(null);
  const [infographicModalOpened, setInfographicModalOpened] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [router, status]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (status === "authenticated" && session?.user?.id) {
        try {
          const response = await fetch("/api/admin/check");
          if (response.ok) {
            const data = await response.json();
            setIsAdmin(data.isAdmin || data.role === "ADMIN");
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
      }
    };
    checkAdminStatus();
  }, [status, session]);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await postService.getPublicPosts();
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
        let profileImageUrl = null;
        if (postData.User?.profileImageKey) {
          const { data: imageData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(postData.User.profileImageKey);
          profileImageUrl = imageData.publicUrl;
        }

        // Handle backward compatibility: convert string imageUrl to array
        let imageUrlArray: string[] | null = null;
        if (postData.imageUrl) {
          if (typeof postData.imageUrl === "string") {
            imageUrlArray = [postData.imageUrl];
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
      setPosts(postsWithImageUrls as Post[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch posts"));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchPosts();
      // Show infographic modal when entering feed page
      setInfographicModalOpened(true);
    }
  }, [status, fetchPosts]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollElement = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
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
      fetchPosts(true);
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
        postAuthorId
      );

      // Navigate to the chat page
      router.push(`/inbox/${chat.id}`);
    } catch (err) {
      console.error("Error creating/finding chat:", err);
      // You could show a toast notification here
    } finally {
      setChatLoading(null);
    }
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/admin/posts/${postToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete post");
      }

      notifications.show({
        title: "สำเร็จ",
        message: "ลบโพสต์แล้ว",
        color: "green",
      });

      // Remove post from local state
      setPosts(posts.filter((p) => p.id !== postToDelete.id));
      setDeleteModalOpened(false);
      setPostToDelete(null);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "ไม่สามารถลบโพสต์ได้";
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: errorMessage,
        color: "red",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <TopNavbar title="Feed and Contents" />
        <Container
          size="xs"
          pt="md"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
          style={{ marginLeft: "auto", marginRight: "auto" }}
        >
          <Text>Loading posts...</Text>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <TopNavbar title="Feed and Contents" />
        <Container
          size="xs"
          pt="md"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
          style={{ marginLeft: "auto", marginRight: "auto" }}
        >
          <Text c="red">Error loading posts: {error.message}</Text>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <NewUserRedirect />
      <SuspendedUserRedirect />
      <TopNavbar title="Feed and Contents" />
      <Container
        size="xs"
        pt="md"
        px="md"
        mt={rem(TOP_NAVBAR_HEIGHT_PX)}
        style={{ marginLeft: "auto", marginRight: "auto" }}
      >
        <ScrollArea
          ref={scrollAreaRef}
          h={`calc(100vh - ${
            TOP_NAVBAR_HEIGHT_PX + BOTTOM_NAVBAR_HEIGHT_PX + 32
          }px)`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Box
            style={{
              transform: `translateY(${pullDistance}px)`,
              transition: pullDistance === 0 ? "transform 0.3s ease" : "none",
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px",
                    color: "var(--mantine-color-dimmed)",
                  }}
                >
                  <Text size="sm">
                    {isRefreshing ? "Refreshing..." : "Pull to refresh"}
                  </Text>
                </Box>
              )}
            </Transition>

            <Stack gap="lg" pb={rem(BOTTOM_NAVBAR_HEIGHT_PX)}>
              {posts && posts.length > 0 ? (
                posts.map((post: Post, index: number) => (
                  <Box key={post.id}>
                    <Stack gap={10}>
                      <Group gap="sm" align="center" justify="space-between">
                        <Group gap="sm" align="center">
                          <Avatar
                            radius="xl"
                            color="gray"
                            src={post.User.profileImageUrl || undefined}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleViewProfile(post.User.id)}
                          >
                            {post.User.fullName?.charAt(0) || "?"}
                          </Avatar>
                          <Group gap={4} align="center">
                            <Text
                              fw={600}
                              style={{ cursor: "pointer" }}
                              onClick={() => handleViewProfile(post.User.id)}
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
                        {isAdmin && (
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() => {
                              setPostToDelete(post);
                              setDeleteModalOpened(true);
                            }}
                            style={{
                              border: "1px solid red",
                            }}
                          >
                            X ลบโพส
                          </Button>
                        )}
                      </Group>

                      {post.content?.text && (
                        <Text fz="lg" style={{ lineHeight: 1.6 }}>
                          {post.content.text}
                        </Text>
                      )}

                      {post.imageUrl && post.imageUrl.length > 0 && (
                        <SimpleGrid
                          cols={post.imageUrl.length === 1 ? 1 : 2}
                          spacing="sm"
                        >
                          {post.imageUrl.map((url, imgIndex) => (
                            <Image
                              key={imgIndex}
                              src={url}
                              alt={`Post image ${imgIndex + 1}`}
                              radius="md"
                              fit="cover"
                              mah={500}
                            />
                          ))}
                        </SimpleGrid>
                      )}

                      <Group justify="flex-start" mt="xs">
                        <Box
                          onClick={() => handleSendClick(post.User.id)}
                          style={{
                            cursor:
                              chatLoading === post.User.id
                                ? "not-allowed"
                                : "pointer",
                            opacity: chatLoading === post.User.id ? 0.6 : 1,
                          }}
                        >
                          <Text c="yellow">Message</Text>
                        </Box>
                      </Group>
                    </Stack>
                    {index < posts.length - 1 && (
                      <Divider mt="lg" color="dark.4" />
                    )}
                  </Box>
                ))
              ) : (
                <Text c="dimmed" ta="center" mt="xl">
                  No posts yet. Be the first to create one!
                </Text>
              )}
            </Stack>
          </Box>
        </ScrollArea>
      </Container>

      <BottomNavbar />

      {/* Infographic Modal */}
      <Modal
        opened={infographicModalOpened}
        onClose={() => setInfographicModalOpened(false)}
        title="Infographic"
        size="lg"
        centered
        styles={{
          title: {
            color: "white",
            fontWeight: 600,
            textAlign: "center",
            width: "100%",
            margin: 0,
          },
          header: {
            justifyContent: "center",
            position: "relative",
          },
          close: {
            position: "absolute",
            right: "var(--mantine-spacing-md)",
          },
        }}
      >
        <Box>
          <Image
            src="/infographic/LINE_20251114_235452.jpg"
            alt="Infographic"
            fit="contain"
            radius="md"
          />
        </Box>
      </Modal>

      {/* Delete Post Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setPostToDelete(null);
        }}
        title="ยืนยันการลบโพสต์"
        centered
        styles={{
          content: { backgroundColor: "#0F0F0F" },
          header: { backgroundColor: "#0F0F0F" },
          body: { backgroundColor: "#0F0F0F" },
          title: { color: "white" },
        }}
      >
        <Stack gap="md">
          <Text c="white">
            คุณแน่ใจหรือไม่ว่าต้องการลบโพสต์นี้? การกระทำนี้ไม่สามารถยกเลิกได้
          </Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setDeleteModalOpened(false);
                setPostToDelete(null);
              }}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button color="red" onClick={handleDeletePost} loading={deleting}>
              ลบ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default FeedPage;
