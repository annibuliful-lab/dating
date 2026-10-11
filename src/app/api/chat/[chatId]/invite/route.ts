import { apiError, requireCommunity, requireSameOrigin, requireUser } from "@/server/access";
import { uuid } from "@/server/validation";
import { messageService } from "@/server/data/messages";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = { chatId: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser();
    requireCommunity(actor);
    const session = { user: actor };

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended


    const userId = uuid((await request.json()).userId);

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    const { chatId: rawChatId } = await params;
    const chatId = uuid(rawChatId);

    const requester = await messageService.getChatParticipant(
      chatId,
      session.user.id
    );

    if (!requester) {
      return NextResponse.json(
        { error: "You are not a participant in this chat" },
        { status: 403 }
      );
    }

    // Check if the user is already in the chat
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

    const currentParticipantCount =
      await messageService.getChatParticipantCount(chatId);

    // If there are 2 participants and we're adding a third, convert to group chat
    if (currentParticipantCount === 2) {
      await messageService.updateChatGroupStatus(chatId, true);

      // When converting to group chat, ensure admin is added
      const adminUserId = await messageService.getFirstAdminUserId();

      if (adminUserId) {
        const isAdminInChat = await messageService.isUserInChat(
          adminUserId,
          chatId
        );
        if (!isAdminInChat) {
          await messageService.addChatParticipant(chatId, adminUserId, true);
        }
      }
    }

    // Add the user to the chat
    const participant = await messageService.addChatParticipant(
      chatId,
      userId,
      false
    );

    return NextResponse.json({ success: true, participant }, { status: 200 });
  } catch (error) { return apiError(error); }
}
