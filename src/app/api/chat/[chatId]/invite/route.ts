import { auth } from '@/auth';
import { supabase } from '@/client/supabase';
import { messageService } from '@/services/supabase/messages';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { chatId: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    const { chatId } = await params;

    // Verify that the requester is a participant in the chat
    const isParticipant = await messageService.isUserInChat(
      session.user.id,
      chatId
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'You are not a participant in this chat' },
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
        { error: 'User is already in this chat' },
        { status: 400 }
      );
    }

    // Get current participants count
    const currentParticipants =
      await messageService.getChatParticipants(chatId);

    // If there are 2 participants and we're adding a third, convert to group chat
    if (currentParticipants.length === 2) {
      const { error: updateError } = await supabase
        .from('Chat')
        .update({ isGroup: true })
        .eq('id', chatId);

      if (updateError) {
        console.error('Error converting chat to group:', updateError);
        // Continue anyway, as this is not critical
      }
    }

    // Add the user to the chat
    const participant = await messageService.addChatParticipant(
      chatId,
      userId,
      false
    );

    return NextResponse.json(
      { success: true, participant },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error inviting user to chat:', error);
    return NextResponse.json(
      { error: 'Failed to invite user' },
      { status: 500 }
    );
  }
}
