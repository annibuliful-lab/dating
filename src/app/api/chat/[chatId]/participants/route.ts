import { apiError, requireCommunity, requireSameOrigin, requireUser } from "@/server/access";
import { uuid } from "@/server/validation";
import { messageService } from "@/server/data/messages";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
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

    const { chatId: rawChatId } = await params;
    const chatId = uuid(rawChatId);

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

    // Get all participants
    const participants = await messageService.getChatParticipants(chatId);

    return NextResponse.json(participants);
  } catch (error) { return apiError(error); }
}
