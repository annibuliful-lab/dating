import { auth } from "@/auth";
import { messageService } from "@/services/supabase/messages";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;

    // Check if user is a participant in the chat
    const isParticipant = await messageService.isUserInChat(
      session.user.id,
      chatId
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: "You are not a participant in this chat" },
        { status: 403 }
      );
    }

    // Get all participants
    const participants = await messageService.getChatParticipants(chatId);

    return NextResponse.json(participants);
  } catch (error) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch participants",
      },
      { status: 500 }
    );
  }
}
