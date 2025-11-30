import { supabase } from "@/client/supabase";
import { requireAdmin } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/chats
 * Get all group chats for admin management
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const { data: chats, error } = await supabase
      .from("Chat")
      .select(
        `
        *,
        User!Chat_createdById_fkey (
          id,
          fullName,
          username,
          profileImageKey
        ),
        ChatParticipant!ChatParticipant_chatId_fkey (
          id,
          userId,
          isAdmin,
          User!ChatParticipant_userId_fkey (
            id,
            fullName,
            username,
            profileImageKey,
            status
          )
        ),
        Message (
          id,
          createdAt
        )
      `
      )
      .eq("isGroup", true)
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Error fetching group chats:", error);
      return NextResponse.json(
        { error: "Failed to fetch group chats" },
        { status: 500 }
      );
    }

    // Get latest message for each chat
    const chatsWithLatestMessage = await Promise.all(
      (chats || []).map(async (chat) => {
        const { data: latestMessage } = await supabase
          .from("Message")
          .select(
            `
            *,
            User!Message_senderId_fkey (
              id,
              fullName,
              username,
              profileImageKey
            )
          `
          )
          .eq("chatId", chat.id)
          .order("createdAt", { ascending: false })
          .limit(1)
          .single();

        return {
          ...chat,
          latestMessage: latestMessage || null,
        };
      })
    );

    return NextResponse.json(chatsWithLatestMessage);
  } catch (error) {
    console.error("Error in GET /api/admin/chats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
