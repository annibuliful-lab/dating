import { requireAdmin } from "@/lib/admin";
import { messageService } from "@/services/supabase/messages";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/chats/[chatId]/messages
 * Get all messages in a group chat (admin can always see group chat messages)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const { chatId } = await params;

    // Verify it's a group chat
    const chatInfo = await messageService.getChatInfo(chatId);
    if (!chatInfo.isGroup) {
      return NextResponse.json(
        { error: "This endpoint is only for group chats" },
        { status: 400 }
      );
    }

    // Get all messages
    const messages = await messageService.getChatMessages(chatId, 100, 0);

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch chat messages",
      },
      { status: 500 }
    );
  }
}

