import FeedContent from '@/components/feed/FeedContent';
import { normalizeHashtag } from '@/shared/hashtags';
import { notFound } from 'next/navigation';

export default async function HashtagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  let hashtag: string | null;
  try {
    hashtag = normalizeHashtag(decodeURIComponent(tag));
  } catch {
    notFound();
  }
  if (!hashtag) notFound();

  return <FeedContent key={hashtag} hashtag={hashtag} />;
}
