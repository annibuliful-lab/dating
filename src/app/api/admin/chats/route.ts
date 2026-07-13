import { supabase } from '@/client/supabase';
import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/chats
 * Get chats (both direct and group chats) for admin management with pagination
 * Query params: limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck) return adminCheck;

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20'),
      100,
    );
    const offset = Math.max(
      parseInt(searchParams.get('offset') || '0'),
      0,
    );

    const { data: chats, error } = await supabase
      .from('Chat')
      .select(
        `
        *,
        User!Chat_createdById_fkey (
          id,
          fullName,
          username,
          profileImageKey
        ),
        ChatParticipant!ChatParticipant_chatId_fkey (
          id,
          userId,
          isAdmin,
          User!ChatParticipant_userId_fkey (
            id,
            fullName,
            username,
            profileImageKey,
            status,
            role
          )
        )
      `,
      )
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching group chats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch group chats' },
        { status: 500 },
      );
    }

    const chatIds = (chats || []).map((chat) => chat.id);
    const latestMessagesByChat = new Map<string, unknown>();

    if (chatIds.length > 0) {
      const { data: latestMessages, error: latestMessagesError } =
        await supabase
          .from('Message')
          .select(
            `
            *,
            User!Message_senderId_fkey (
              id,
              fullName,
              username,
              profileImageKey,
              role
            )
          `,
          )
          .in('chatId', chatIds)
          .order('createdAt', { ascending: false });

      if (latestMessagesError) {
        console.error(
          'Error fetching latest messages:',
          latestMessagesError,
        );
        return NextResponse.json(
          { error: 'Failed to fetch latest messages' },
          { status: 500 },
        );
      }

      (latestMessages || []).forEach((message) => {
        if (!latestMessagesByChat.has(message.chatId)) {
          latestMessagesByChat.set(message.chatId, message);
        }
      });
    }

    const chatsWithLatestMessage = (chats || []).map((chat) => ({
      ...chat,
      latestMessage: latestMessagesByChat.get(chat.id) || null,
    }));

    return NextResponse.json(chatsWithLatestMessage);
  } catch (error) {
    console.error('Error in GET /api/admin/chats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
