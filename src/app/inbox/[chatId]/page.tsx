"use client";

import { ChatMessage } from "@/components/chat/ChatMessage";
import { EditMessageModal } from "@/components/chat/EditMessageModal";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { UserPlusIcon } from "@/components/icons/UserPlusIcon";
import { useChatMessages } from "@/hooks/useChatMessages";
import {
  ActionIcon,
  Box,
  Center,
  Container,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  rem,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const { status } = useSession();
  const messageInputRef = useRef<HTMLInputElement>(null);

  const {
    message,
    setMessage,
    messages,
    loading,
    sending,
    error,
    typingUsers,
    editText,
    setEditText,
    showEditModal,
    soundEnabled,
    setSoundEnabled,
    messagesEndRef,
    messagesContainerRef,
    selectedMedia,
    uploadingMedia,
    loadingOlderMessages,
    hasOlderMessages,
    handleSend,
    handleTyping,
    handleEditMessage,
    handleSaveEdit,
    handleDeleteMessage,
    closeEditModal,
    fetchMessages,
    loadOlderMessages,
    handleScroll,
    formatMessageTime,
    handleMediaSelect,
    handleSendMedia,
    handleRemoveMedia,
  } = useChatMessages({ chatId: params.chatId || "" });

  // Handle authentication redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <Box>
        <TopNavbar title="Chat" showBack rightSlot={<UserPlusIcon />} />
        <Container
          size="xs"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
          pb={rem(90)}
        >
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <TopNavbar title="Chat" showBack rightSlot={<UserPlusIcon />} />
        <Container
          size="xs"
          px="md"
          mt={rem(TOP_NAVBAR_HEIGHT_PX)}
          pb={rem(90)}
        >
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="red" ta="center">
                {error}
              </Text>
              <Text
                c="blue"
                style={{ cursor: "pointer" }}
                onClick={fetchMessages}
              >
                Try again
              </Text>
            </Stack>
          </Center>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <TopNavbar
        title="Chat"
        showBack
        rightSlot={
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setSoundEnabled(!soundEnabled)}
              color={soundEnabled ? "blue" : "gray"}
            >
              <Text size="lg">{soundEnabled ? "🔊" : "🔇"}</Text>
            </ActionIcon>
            <UserPlusIcon />
          </Group>
        }
      />

      <Container size="xs" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)} pb={rem(90)}>
        <ScrollArea
          ref={messagesContainerRef}
          h={`calc(100vh - ${rem(TOP_NAVBAR_HEIGHT_PX)} - ${rem(90)})`}
          onScrollPositionChange={(position) => {
            if (position.y < 100 && hasOlderMessages && !loadingOlderMessages) {
              loadOlderMessages();
            }
          }}
        >
          <Stack gap="lg">
            {/* Loading indicator for older messages */}
            {loadingOlderMessages && (
              <Center py="md">
                <Loader size="sm" />
              </Center>
            )}

            {messages.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" ta="center">
                  No messages yet. Start the conversation!
                </Text>
              </Center>
            ) : (
              messages.map((m, index) => {
                const prevMessage = index > 0 ? messages[index - 1] : null;
                const showAvatar =
                  m.author === "other" &&
                  (!prevMessage || prevMessage.senderId !== m.senderId);
                const showTimestamp =
                  !prevMessage ||
                  new Date(m.createdAt).getTime() -
                    new Date(prevMessage.createdAt).getTime() >
                    5 * 60 * 1000; // 5 minutes

                return (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    showAvatar={showAvatar}
                    showTimestamp={showTimestamp}
                    isOwnMessage={m.author === "me"}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    formatMessageTime={formatMessageTime}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Stack>
        </ScrollArea>
      </Container>

      <TypingIndicator typingUsers={typingUsers} />

      <MessageInput
        ref={messageInputRef}
        message={message}
        setMessage={setMessage}
        onSend={handleSend}
        onTyping={handleTyping}
        sending={sending}
        onMediaSelect={handleMediaSelect}
        selectedMedia={selectedMedia}
        onRemoveMedia={handleRemoveMedia}
        onSendMedia={handleSendMedia}
        uploadingMedia={uploadingMedia}
      />

      <EditMessageModal
        opened={showEditModal}
        onClose={closeEditModal}
        editText={editText}
        setEditText={setEditText}
        onSave={handleSaveEdit}
      />
    </Box>
  );
}
