import 'server-only';
import { supabase } from '@/server/supabase';
import { AccessError, requireChat, requireCommunity, requireWritable, type Actor } from '@/server/access';
import { integer, list, object, own, scopedKey, text, uuid } from '@/server/validation';
import { postService } from './posts';
import { messageService } from './messages';
import { userService } from './users';
import { adService } from './ads';
import { getUserProfile } from './profile-get';
import { updateUserProfile } from './profile-update';
import { deleteProfileImage, getProfileImages, reorderProfileImages, saveProfileImages } from './profile-images';

async function readablePost(actor: Actor, value: unknown) {
  const postId = uuid(value);
  const { data, error } = await supabase.from('Post').select('id, visibility').eq('id', postId).single();
  if (error || !data) throw new AccessError(404, 'Post not found');
  if (actor.status === 'SUSPENDED' && data.visibility !== 'PUBLIC') throw new AccessError(403, 'Forbidden');
  return postId;
}

async function eligibleUsers(ids: string[]) {
  const { data, error } = await supabase.from('User').select('id').in('id', ids).eq('status', 'ACTIVE');
  if (error) throw error;
  if ((data || []).length !== new Set(ids).size) throw new AccessError(400, 'Invalid participants');
}

function postImage(actor: Actor, value: unknown) {
  const url = new URL(text(value, 2048));
  const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (url.origin !== base.origin || !url.pathname.startsWith('/storage/v1/object/public/dating/')) throw new AccessError(400, 'Invalid image');
  scopedKey(decodeURIComponent(url.pathname.slice('/storage/v1/object/public/dating/'.length)), `posts/users/${actor.id}/`);
  if (url.search || url.hash) throw new AccessError(400, 'Invalid image');
  return url.href;
}

function chatMedia(actor: Actor, chatId: string, value: unknown) {
  if (value == null || value === '') return null;
  const raw = text(value, 2048);
  const url = new URL(raw, 'https://app.invalid');
  if (!raw.startsWith(`/api/chat/${chatId}/media?`) || url.origin !== 'https://app.invalid' || url.hash) throw new AccessError(400, 'Invalid media');
  scopedKey(url.searchParams.get('path'), `chats/${chatId}/users/${actor.id}/`);
  return raw;
}

export async function dispatch(actor: Actor, domain: string, action: string, args: unknown[]) {
  const [a, b, c] = args;
  if (domain === 'profile') {
    switch (action) {
      case 'getUserProfile': {
        const id = uuid(a);
        if (id !== actor.id) requireCommunity(actor);
        return getUserProfile(id, id === actor.id);
      }
      case 'getProfileImages': {
        const id = uuid(a);
        if (id !== actor.id) requireCommunity(actor);
        return getProfileImages(id);
      }
      case 'updateUserProfile':
        requireWritable(actor);
        return updateUserProfile(own(actor.id, a), object(b));
      case 'saveProfileImages':
        requireWritable(actor);
        return saveProfileImages(own(actor.id, a), b);
      case 'reorderProfileImages':
        requireWritable(actor);
        return reorderProfileImages(own(actor.id, a), b);
      case 'deleteProfileImage':
        requireWritable(actor);
        return deleteProfileImage(actor.id, uuid(a));
      case 'addProfileImage': {
        requireWritable(actor); own(actor.id, a);
        const existing = await getProfileImages(actor.id);
        if (existing.length >= 5) throw new AccessError(400, 'Too many images');
        const key = scopedKey(b, `users/${actor.id}/profile-images/`);
        await saveProfileImages(actor.id, [...existing, { imageKey: key, order: integer(c, existing.length, 4) }]);
        return (await getProfileImages(actor.id)).find(image => image.imageKey === key);
      }
    }
  }
  if (domain === 'posts') {
    requireCommunity(actor, action === 'getPublicPosts');
    switch (action) {
      case 'getPublicPosts': {
        const options = c == null ? {} : object(c);
        if (actor.status === 'SUSPENDED' && options.hashtag !== undefined) throw new AccessError(403, 'Forbidden');
        return postService.getPublicPosts(Math.max(1, integer(a, 20, 100)), integer(b, 0, 100000), {
          force: options.force === true,
          search: options.search === undefined ? undefined : text(options.search, 200, true),
          hashtag: options.hashtag === undefined ? undefined : text(options.hashtag, 200),
        });
      }
      case 'getPostsByUser': return postService.getPostsByUser(uuid(a), Math.max(1, integer(b, 20, 100)));
      case 'getPostById': return postService.getPostById(await readablePost(actor, a));
      case 'getSavedPosts': return postService.getSavedPosts(own(actor.id, a));
      case 'getUserPostInteractions': return postService.getUserPostInteractions(own(actor.id, a), list(b, uuid));
      case 'getUserPostLike': return postService.getUserPostLike(own(actor.id, a), await readablePost(actor, b));
      case 'getUserPostSave': return postService.getUserPostSave(own(actor.id, a), await readablePost(actor, b));
      case 'deletePost': {
        const postId = uuid(a);
        const { data, error } = await supabase.from('Post').select('authorId').eq('id', postId).maybeSingle();
        if (error) throw error;
        if (!data) throw new AccessError(404, 'Post not found');
        own(actor.id, data.authorId);
        return postService.deletePost(postId, actor.id);
      }
      case 'createPost': {
        const input = object(a); own(actor.id, input.authorId);
        const content = text(object(input.content).text, 10000, true);
        const images = input.imageUrl == null ? null : list(input.imageUrl, item => postImage(actor, item), 5);
        if (!content.trim() && !images?.length) throw new AccessError(400, 'Empty post');
        if (!['PUBLIC', 'MEMBERS_ONLY'].includes(String(input.visibility))) throw new AccessError(400, 'Invalid visibility');
        return postService.createPost({ id: input.id ? uuid(input.id) : crypto.randomUUID(), authorId: actor.id,
          content: { text: content }, imageUrl: images, visibility: input.visibility as 'PUBLIC' | 'MEMBERS_ONLY', updatedAt: new Date().toISOString() });
      }
      case 'likePost': return postService.likePost(own(actor.id, a), await readablePost(actor, b));
      case 'unlikePost': return postService.unlikePost(own(actor.id, a), await readablePost(actor, b));
      case 'savePost': return postService.savePost(own(actor.id, a), await readablePost(actor, b));
      case 'unsavePost': return postService.unsavePost(own(actor.id, a), await readablePost(actor, b));
    }
  }
  if (domain === 'ads' && action === 'getActiveAds') {
    requireCommunity(actor, true);
    return adService.getActiveAds();
  }
  if (domain === 'users') {
    requireCommunity(actor);
    switch (action) {
      case 'getUsersByIds': return userService.getUsersByIds(list(a, uuid));
      case 'getActiveUsers': return userService.getActiveUsers();
      case 'getUserById': return userService.getUserById(uuid(a));
      case 'getUserProfile': return userService.getUserProfile(uuid(a));
      case 'searchUsers': return userService.searchUsers(text(a, 100, true));
      case 'getUsersByAgeRange': return userService.getUsersByAgeRange(integer(a, 18, 120), integer(b, 120, 120));
      case 'getUsersWithPostCounts': return userService.getUsersWithPostCounts();
    }
  }
  if (domain === 'messages') {
    requireCommunity(actor);
    switch (action) {
      case 'getUserChats': return messageService.getUserChats(own(actor.id, a), { force: true });
      case 'getUnreadCount': return messageService.getUnreadCount(own(actor.id, a));
      case 'getOrCreateDirectChat': {
        own(actor.id, a); const target = uuid(b);
        if (target === actor.id) throw new AccessError(400, 'Invalid participant');
        await eligibleUsers([target]);
        return messageService.getOrCreateDirectChat(actor.id, target);
      }
      case 'createGroupChat': {
        own(actor.id, a); const ids = [...new Set(list(c, uuid, 50))].filter(id => id !== actor.id);
        await eligibleUsers(ids);
        return messageService.createGroupChat(actor.id, text(b, 100), ids);
      }
      case 'getMessageUpdates': {
        const startedAt = new Date().toISOString();
        const id = uuid(a); await requireChat(actor, id);
        let query = supabase.from('Message').select('*, User!Message_senderId_fkey(id, fullName, username, profileImageKey, isVerified, role)').eq('chatId', id);
        if (b != null) {
          const cursor = object(b);
          const date = text(cursor.createdAt, 40);
          if (!/^\d{4}-\d{2}-\d{2}T[0-9:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !Number.isFinite(Date.parse(date))) throw new AccessError(400, 'Invalid cursor');
          query = query.or(`createdAt.gt.${date},and(createdAt.eq.${date},id.gt.${uuid(cursor.id)})`);
          const { data, error } = await query.order('createdAt').order('id').limit(100);
          if (error) throw error;
          return { messages: data || [], cursor: data?.length ? { createdAt: data.at(-1)!.createdAt, id: data.at(-1)!.id } : cursor, hasMore: data?.length === 100 };
        }
        const { data, error } = await query.order('createdAt', { ascending: false }).order('id', { ascending: false }).limit(1);
        if (error) throw error;
        return { messages: data || [], cursor: data?.length ? { createdAt: data[0].createdAt, id: data[0].id } : { createdAt: startedAt, id: '00000000-0000-0000-0000-000000000000' }, hasMore: false };
      }
      case 'getChatMessages': {
        const chatId = uuid(a); await requireChat(actor, chatId);
        const startedAt = new Date().toISOString();
        const messages = await messageService.getChatMessages(chatId, Math.max(1, integer(b, 50, 100)), integer(c, 0, 100000));
        return { messages, cursor: messages[0] ? { createdAt: messages[0].createdAt, id: messages[0].id } : { createdAt: startedAt, id: '00000000-0000-0000-0000-000000000000' } };
      }
      case 'getOlderMessages': {
        const chatId = uuid(a); await requireChat(actor, chatId);
        return messageService.getOlderMessages(chatId, uuid(b), Math.max(1, integer(c, 20, 100)));
      }
      case 'getChatSummary': {
        const chatId = uuid(a); own(actor.id, b); await requireChat(actor, chatId);
        return messageService.getChatSummary(chatId, actor.id, { force: true });
      }
      case 'getChatInfo': { const id = uuid(a); await requireChat(actor, id); return messageService.getChatInfo(id); }
      case 'getChatParticipants': { const id = uuid(a); await requireChat(actor, id); return messageService.getChatParticipants(id); }
      case 'getChatParticipant': { const id = uuid(a); await requireChat(actor, id); return messageService.getChatParticipant(id, uuid(b)); }
      case 'getChatParticipantCount': { const id = uuid(a); await requireChat(actor, id); return messageService.getChatParticipantCount(id); }
      case 'isUserInChat': { const id = uuid(b); await requireChat(actor, id); return messageService.isUserInChat(uuid(a), id); }
      case 'markMessagesAsRead': { const id = uuid(a); own(actor.id, b); await requireChat(actor, id); return messageService.markMessagesAsRead(id, actor.id); }
      case 'sendMessage': {
        const input = object(a); const id = uuid(input.chatId); own(actor.id, input.senderId); await requireChat(actor, id);
        const content = text(input.text ?? '', 10000, true);
        const imageUrl = chatMedia(actor, id, input.imageUrl);
        const videoUrl = chatMedia(actor, id, input.videoUrl);
        if (!content.trim() && !imageUrl && !videoUrl) throw new AccessError(400, 'Empty message');
        return messageService.sendMessage({ id: uuid(input.id), chatId: id, senderId: actor.id, text: content, imageUrl, videoUrl });
      }
      case 'getMessage':
      case 'editMessage':
      case 'deleteMessage': {
        const id = uuid(a);
        const { data, error } = await supabase.from('Message').select('chatId, senderId').eq('id', id).single();
        if (error || !data) throw new AccessError(404, 'Message not found');
        await requireChat(actor, data.chatId);
        if (action === 'getMessage') return messageService.getMessage(id);
        if (data.senderId !== actor.id) throw new AccessError(403, 'Forbidden');
        return action === 'deleteMessage' ? messageService.deleteMessage(id) : messageService.editMessage(id, text(b));
      }
      case 'getTyping': {
        const id = uuid(a); await requireChat(actor, id);
        const { data, error } = await supabase.from('ChatParticipant').select('userId, User!ChatParticipant_userId_fkey(username)').eq('chatId', id).gt('typingUntil', new Date().toISOString());
        if (error) throw error;
        return (data || []).map(row => ({ userId: row.userId, userName: (row.User as unknown as { username: string })?.username || '', isTyping: true }));
      }
      case 'sendTypingIndicator': {
        const id = uuid(a); own(actor.id, b); await requireChat(actor, id);
        if (typeof args[3] !== 'boolean') throw new AccessError(400, 'Invalid typing state');
        const { error } = await supabase.from('ChatParticipant').update({ typingUntil: args[3] ? new Date(Date.now() + 5000).toISOString() : null }).eq('chatId', id).eq('userId', actor.id);
        if (error) throw error;
        return;
      }
    }
  }
  throw new AccessError(404, 'Unknown operation');
}
