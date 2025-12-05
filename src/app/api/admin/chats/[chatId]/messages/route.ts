import { requireAdmin } from "@/lib/admin";
import { messageService } from "@/services/supabase/messages";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/chats/[chatId]/messages
 * Get all messages in any chat (admin can see all chat messages)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const { chatId } = await params;

    // Admin can see messages in all chats (both direct and group)
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

