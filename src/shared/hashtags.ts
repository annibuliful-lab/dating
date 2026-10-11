const HASHTAG_BODY = '[\\p{L}\\p{N}_][\\p{L}\\p{M}\\p{N}_]*';
const VALID_HASHTAG = new RegExp(`^${HASHTAG_BODY}$`, 'u');
const POST_TOKEN_PATTERN = new RegExp(
  `https?:\\/\\/[^\\s]+|www\\.[^\\s]+|(?<![\\p{L}\\p{M}\\p{N}_#])#${HASHTAG_BODY}`,
  'giu',
);

export function normalizeHashtag(tag: string) {
  return VALID_HASHTAG.test(tag) ? tag.toLowerCase() : null;
}

export function getPostTextTokens(text: string) {
  return Array.from(text.matchAll(POST_TOKEN_PATTERN), (match) => ({
    type: match[0].startsWith('#') ? 'hashtag' as const : 'url' as const,
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}
