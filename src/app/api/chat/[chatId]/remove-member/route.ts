import { apiError, requireCommunity, requireSameOrigin, requireUser } from "@/server/access";
import { uuid } from "@/server/validation";
import { messageService } from "@/server/data/messages";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    requireCommunity(actor);
    const session = { user: actor };
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended


    const { chatId: rawChatId } = await params;
    const chatId = uuid(rawChatId);
    const body = await req.json();
    const userId = uuid(body.userId);

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const requester = await messageService.getChatParticipant(
      chatId,
      session.user.id,
    );

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

    const targetUser = await messageService.getChatParticipant(
      chatId,
      userId,
    );
    if (!targetUser) {
      return NextResponse.json(
        { error: "User is not a participant in this chat" },
        { status: 404 }
      );
    }

    // Remove the participant
    await messageService.removeChatParticipant(chatId, userId);

    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
