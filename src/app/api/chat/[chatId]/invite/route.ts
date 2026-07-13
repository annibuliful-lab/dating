import { auth } from "@/auth";
import { messageService } from "@/services/supabase/messages";
import { requireNotSuspended } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = { chatId: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended
    const suspendedCheck = await requireNotSuspended();
    if (suspendedCheck) return suspendedCheck;

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    const { chatId } = await params;

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
  } catch (error) {
    console.error("Error inviting user to chat:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
