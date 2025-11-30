"use client";

import { TopNavbar, TOP_NAVBAR_HEIGHT_PX } from "@/components/element/TopNavbar";
import { BUCKET_NAME, supabase } from "@/client/supabase";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Image,
  Loader,
  Modal,
  rem,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";

type Post = {
  id: string;
  content: {
    text?: string;
    [key: string]: unknown;
  } | null;
  imageUrl: string[] | null;
  visibility: string;
  createdAt: string;
  User: {
    id: string;
    fullName: string;
    username: string;
    profileImageKey: string | null;
    isVerified: boolean;
    status: string;
  };
  PostLike?: Array<{ count?: number }>;
  PostSave?: Array<{ count?: number }>;
};

export default function AdminPostsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/posts");
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/feed");
          return;
        }
        throw new Error("Failed to fetch posts");
      }
      const data = await response.json();
      setPosts(data);
    } catch (error) {
      console.error("Error fetching posts:", error);
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถโหลดรายการโพสต์ได้",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/admin/posts/${selectedPost.id}`, {
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

      setDeleteModalOpened(false);
      setSelectedPost(null);
      fetchPosts();
    } catch (error: any) {
      notifications.show({
        title: "เกิดข้อผิดพลาด",
        message: error.message || "ไม่สามารถลบโพสต์ได้",
        color: "red",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getProfileImageUrl = (profileImageKey: string | null) => {
    if (!profileImageKey) return null;
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(profileImageKey);
    return data.publicUrl;
  };

  const getPostImageUrl = (imageUrl: string | string[] | null) => {
    if (!imageUrl) return null;
    if (typeof imageUrl === "string") {
      return imageUrl;
    }
    if (Array.isArray(imageUrl) && imageUrl.length > 0) {
      return imageUrl[0];
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Box>
        <TopNavbar title="จัดการโพสต์" showBack />
        <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <TopNavbar title="จัดการโพสต์" showBack />
      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <ScrollArea h={`calc(100vh - ${rem(TOP_NAVBAR_HEIGHT_PX + 100)})`}>
          <Stack gap="md" pb="xl">
            {posts.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                ไม่มีโพสต์
              </Text>
            ) : (
              posts.map((post) => (
                <Card
                  key={post.id}
                  padding="md"
                  radius="md"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                  }}
                >
                  <Stack gap="md">
                    {/* Author Info */}
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Avatar
                          src={getProfileImageUrl(post.User.profileImageKey)}
                          size="sm"
                          radius="xl"
                        />
                        <Stack gap={0}>
                          <Group gap="xs">
                            <Text size="sm" fw={600} c="white">
                              {post.User.fullName}
                            </Text>
                            {post.User.isVerified && (
                              <Badge size="xs" color="blue">
                                ยืนยันแล้ว
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">
                            @{post.User.username}
                          </Text>
                        </Stack>
                      </Group>
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => {
                          setSelectedPost(post);
                          setDeleteModalOpened(true);
                        }}
                      >
                        ลบ
                      </Button>
                    </Group>

                    {/* Post Content */}
                    {post.content?.text && (
                      <Text size="sm" c="white">
                        {post.content.text}
                      </Text>
                    )}

                    {/* Post Image */}
                    {getPostImageUrl(post.imageUrl) && (
                      <Image
                        src={getPostImageUrl(post.imageUrl) || ""}
                        alt="Post image"
                        radius="md"
                        style={{ maxHeight: "300px", objectFit: "cover" }}
                      />
                    )}

                    {/* Post Stats */}
                    <Group gap="md">
                      <Text size="xs" c="dimmed">
                        {post.PostLike?.[0]?.count || 0} ไลค์
                      </Text>
                      <Text size="xs" c="dimmed">
                        {post.PostSave?.[0]?.count || 0} บันทึก
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(post.createdAt)}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              ))
            )}
          </Stack>
        </ScrollArea>
      </Container>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setSelectedPost(null);
        }}
        title="ยืนยันการลบโพสต์"
        styles={{
          content: { backgroundColor: "#0F0F0F" },
          header: { backgroundColor: "#0F0F0F" },
          body: { backgroundColor: "#0F0F0F" },
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
                setSelectedPost(null);
              }}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button
              color="red"
              onClick={handleDeletePost}
              loading={deleting}
            >
              ลบ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

