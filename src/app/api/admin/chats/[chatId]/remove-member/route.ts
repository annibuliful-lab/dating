import { requireAdmin } from "@/lib/admin";
import { messageService } from "@/services/supabase/messages";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/admin/chats/[chatId]/remove-member
 * Admin can remove users from group chats
 */
export async function DELETE(
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

    // Check if user is a participant
    const isParticipant = await messageService.isUserInChat(userId, chatId);
    if (!isParticipant) {
      return NextResponse.json(
        { error: "User is not a participant in this chat" },
        { status: 404 }
      );
    }

    // Remove the participant
    await messageService.removeChatParticipant(chatId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member from chat:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to remove member",
      },
      { status: 500 }
    );
  }
}

