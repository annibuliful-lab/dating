"use client";

import { ChatMessage } from "@/components/chat/ChatMessage";
import { EditMessageModal } from "@/components/chat/EditMessageModal";
import { GroupInfoModal } from "@/components/chat/GroupInfoModal";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import {
  TOP_NAVBAR_HEIGHT_PX,
  TopNavbar,
} from "@/components/element/TopNavbar";
import { MoreOptionsIcon } from "@/components/icons/MoreOptionsIcon";
import { useChatMessages } from "@/hooks/useChatMessages";
import { messageService } from "@/services/supabase/messages";
import {
  ActionIcon,
  Box,
  Center,
  Container,
  Loader,
  ScrollArea,
  Stack,
  Text,
  rem,
} from "@mantine/core";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const { status, data: session } = useSession();
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [groupInfoModalOpened, setGroupInfoModalOpened] = useState(false);
  const [chatInfo, setChatInfo] = useState<{
    name: string | null;
    isGroup: boolean;
  }>({ name: null, isGroup: false });

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

  // Fetch chat info function
  const fetchChatInfo = useCallback(async () => {
    if (params.chatId) {
      try {
        const info = await messageService.getChatInfo(params.chatId);
        let chatName = info.name;

        // If no name is set, use participant names
        if (!chatName) {
          const participants = await messageService.getChatParticipants(
            params.chatId
          );
          // Get other participants (excluding current user)
          const otherParticipants = participants.filter(
            (p) => p.userId !== session?.user?.id
          );

          if (otherParticipants.length > 0) {
            chatName = otherParticipants
              .map((p) => p.User?.fullName || "Unknown")
              .join(", ");
          } else {
            chatName = `Chat ${params.chatId.slice(0, 8)}`;
          }
        }

        setChatInfo({ name: chatName, isGroup: info.isGroup });
      } catch (error) {
        console.error("Error fetching chat info:", error);
      }
    }
  }, [params.chatId, session?.user?.id]);

  // Fetch chat info
  useEffect(() => {
    if (session?.user?.id) {
      fetchChatInfo();
    }
  }, [session?.user?.id, fetchChatInfo]);

  if (status === "loading" || loading) {
    return (
      <Box>
        <TopNavbar
          title={chatInfo.name || "Chat"}
          showBack
          rightSlot={
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setGroupInfoModalOpened(true)}
            >
              <MoreOptionsIcon />
            </ActionIcon>
          }
        />
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
        <TopNavbar
          title={chatInfo.name || "Chat"}
          showBack
          rightSlot={
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setGroupInfoModalOpened(true)}
            >
              <MoreOptionsIcon />
            </ActionIcon>
          }
        />
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
        title={chatInfo.name || "Chat"}
        showBack
        rightSlot={
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => setGroupInfoModalOpened(true)}
          >
            <MoreOptionsIcon />
          </ActionIcon>
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
                  chatInfo.isGroup &&
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

      <GroupInfoModal
        opened={groupInfoModalOpened}
        onClose={() => setGroupInfoModalOpened(false)}
        chatId={params.chatId || ""}
        chatName={chatInfo.name}
        isGroup={chatInfo.isGroup}
        onNameUpdated={(_newName: string) => {
          fetchChatInfo();
        }}
      />
    </Box>
  );
}
