import { auth } from "@/auth";
import { messageService } from "@/services/supabase/messages";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
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
        { error: "Only admins can remove members" },
        { status: 403 }
      );
    }

    // Cannot remove yourself
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the chat" },
        { status: 400 }
      );
    }

    // Check if the user to be removed is a participant
    const targetUser = participants.find((p) => p.userId === userId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "User is not a participant in this chat" },
        { status: 404 }
      );
    }

    // Remove the participant
    await messageService.removeChatParticipant(chatId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to remove member",
      },
      { status: 500 }
    );
  }
}
