import { apiError, requireCommunity, requireSameOrigin, requireUser } from "@/server/access";
import { uuid } from "@/server/validation";
import { messageService } from "@/server/data/messages";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
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
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim() || name.length > 100) {
      return NextResponse.json(
        { error: "Valid chat name is required" },
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
        { error: "Only admins can change the group name" },
        { status: 403 }
      );
    }

    // Update the chat name
    await messageService.updateChatName(chatId, name.trim());

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (error) { return apiError(error); }
}
