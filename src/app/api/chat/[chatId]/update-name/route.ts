import { auth } from "@/auth";
import { messageService } from "@/services/supabase/messages";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Valid chat name is required" },
        { status: 400 }
      );
    }

    // Check if the requester is a participant and admin
    const participants = await messageService.getChatParticipants(chatId);
    const requester = participants.find((p) => p.userId === session.user.id);

    if (!requester) {
      return NextResponse.json(
        { error: "You are not a participant in this chat" },
        { status: 403 }
      );
    }

    if (!requester.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can change the group name" },
        { status: 403 }
      );
    }

    // Update the chat name
    await messageService.updateChatName(chatId, name.trim());

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error("Error updating chat name:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update chat name",
      },
      { status: 500 }
    );
  }
}
