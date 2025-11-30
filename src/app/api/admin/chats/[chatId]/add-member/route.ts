import { requireAdmin } from "@/lib/admin";
import { messageService } from "@/services/supabase/messages";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/chats/[chatId]/add-member
 * Admin can add users to group chats
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const { chatId } = await params;
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify it's a group chat
    const chatInfo = await messageService.getChatInfo(chatId);
    if (!chatInfo.isGroup) {
      return NextResponse.json(
        { error: "This endpoint is only for group chats" },
        { status: 400 }
      );
    }

    // Check if user is already in the chat
    const isAlreadyParticipant = await messageService.isUserInChat(
      userId,
      chatId
    );

    if (isAlreadyParticipant) {
      return NextResponse.json(
        { error: "User is already in this chat" },
        { status: 400 }
      );
    }

    // Add the user to the chat
    const participant = await messageService.addChatParticipant(
      chatId,
      userId,
      false
    );

    return NextResponse.json({ success: true, participant });
  } catch (error) {
    console.error("Error adding member to chat:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add member",
      },
      { status: 500 }
    );
  }
}
