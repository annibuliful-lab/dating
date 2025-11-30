"use client";

import { BUCKET_NAME, supabase } from "@/client/supabase";
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
  Container,
  Divider,
  Group,
  Image,
  Modal,
  rem,
  ScrollArea,
  Stack,
  Text,
  Transition,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NewUserRedirect } from "@/components/auth/NewUserRedirect";

type Post = {
  id: string;
  content: {
    text?: string;
    [key: string]: unknown;
  } | null;
  imageUrl?: string | null;
  createdAt: string;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
    profileImageUrl?: string | null;
    isVerified?: boolean;
    verificationType?: "ADMIN" | "USER" | null;
    verifiedByUsername?: string | null;
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [router, status]);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await postService.getPublicPosts();
      // Convert profileImageKey to URL for each post
      const postsWithImageUrls = (data || []).map((post) => {
        let profileImageUrl = null;
        if (post.User?.profileImageKey) {
          const { data: imageData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(post.User.profileImageKey);
          profileImageUrl = imageData.publicUrl;
        }
        return {
          ...post,
          content: post.content as {
            text?: string;
            [key: string]: unknown;
          } | null,
          User: {
            ...post.User,
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
                        <Text
                          fw={600}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleViewProfile(post.User.id)}
                        >
                          {post.User.fullName}
                        </Text>
                        <Text c="dimmed" size="sm">
                          {formatDate(post.createdAt)}
                        </Text>
                      </Group>

                      {post.content?.text && (
                        <Text fz="lg" style={{ lineHeight: 1.6 }}>
                          {post.content.text}
                        </Text>
                      )}

                      {post.imageUrl && (
                        <Image
                          src={post.imageUrl}
                          alt="Post image"
                          radius="md"
                          fit="contain"
                          mah={500}
                        />
                      )}

                      <Group justify="space-between" mt="xs">
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
                          <Text c="yellow">ทักแชท</Text>
                        </Box>
                        {post.User.isVerified && (
                          <Text
                            fz="xs"
                            fw={500}
                            c={post.User.verificationType === "ADMIN" ? "blue" : "teal"}
                            style={{
                              backgroundColor:
                                post.User.verificationType === "ADMIN"
                                  ? "rgba(37, 99, 235, 0.2)"
                                  : "rgba(20, 184, 166, 0.2)",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              border: `1px solid ${
                                post.User.verificationType === "ADMIN" ? "#2563eb" : "#14b8a6"
                              }`,
                            }}
                          >
                            verify by {post.User.verifiedByUsername || "unknown"}
                          </Text>
                        )}
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
    </Box>
  );
}

export default FeedPage;
