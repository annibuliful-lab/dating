'use client';

import { Anchor, Mark, Text, type TextProps } from '@mantine/core';
import Link from 'next/link';
import { getPostTextTokens, normalizeHashtag } from '@/shared/hashtags';
import type { HTMLAttributes } from 'react';

type PostContentTextProps = {
  text: string;
  highlight?: string;
  hashtagLinks?: boolean;
  highlightHashtag?: string;
  textProps?: TextProps & HTMLAttributes<HTMLElement>;
};

const TRAILING_PUNCTUATION_PATTERN = /[),.!?]+$/;

function normalizeHref(url: string) {
  return url.startsWith('www.') ? `https://${url}` : url;
}

function splitTrailingPunctuation(url: string) {
  const trailingPunctuation = url.match(TRAILING_PUNCTUATION_PATTERN);

  if (!trailingPunctuation) {
    return { cleanUrl: url, trailingText: '' };
  }

  const trailingText = trailingPunctuation[0];
  return {
    cleanUrl: url.slice(0, -trailingText.length),
    trailingText,
  };
}

function renderTextWithLinks(text: string, highlight = '', hashtagLinks = false, highlightHashtag?: string) {
  const search = highlight.trim();
  const tokens = getPostTextTokens(text);
  // Match the full text so a search phrase can span a link boundary.
  const highlights = highlightHashtag
    ? tokens.filter((token) => token.type === 'hashtag' &&
        normalizeHashtag(token.text.slice(1)) === normalizeHashtag(highlightHashtag))
    : search
    ? Array.from(
        text.matchAll(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')),
        (match) => ({ start: match.index, end: match.index + match[0].length }),
      )
    : [];

  const renderSegment = (start: number, end: number) => {
    if (highlights.length === 0) return text.slice(start, end);

    const nodes: React.ReactNode[] = [];
    let cursor = start;
    for (const highlight of highlights) {
      const matchStart = Math.max(start, highlight.start);
      const matchEnd = Math.min(end, highlight.end);
      if (matchStart >= matchEnd) continue;
      if (cursor < matchStart) nodes.push(text.slice(cursor, matchStart));
      nodes.push(
        <Mark key={matchStart}>{text.slice(matchStart, matchEnd)}</Mark>,
      );
      cursor = matchEnd;
    }
    if (cursor < end) nodes.push(text.slice(cursor, end));
    return nodes;
  };

  if (tokens.length === 0) {
    return renderSegment(0, text.length);
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  tokens.forEach((token) => {
    const matchIndex = token.start;

    if (matchIndex > lastIndex) {
      nodes.push(renderSegment(lastIndex, matchIndex));
    }

    if (token.type === 'hashtag') {
      nodes.push(hashtagLinks ? (
        <Anchor
          key={matchIndex}
          component={Link}
          href={`/feed/hashtag/${encodeURIComponent(token.text.slice(1).toLowerCase())}`}
          prefetch={false}
          c="yellow"
          underline="hover"
        >
          {renderSegment(matchIndex, token.end)}
        </Anchor>
      ) : renderSegment(matchIndex, token.end));
      lastIndex = token.end;
      return;
    }

    const rawUrl = token.text;
    const { cleanUrl, trailingText } =
      splitTrailingPunctuation(rawUrl);
    const href = normalizeHref(cleanUrl);

    nodes.push(
      <Anchor
        key={matchIndex}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        c="blue.4"
        underline="always"
      >
        {renderSegment(matchIndex, matchIndex + cleanUrl.length)}
      </Anchor>,
    );

    if (trailingText) {
      nodes.push(renderSegment(matchIndex + cleanUrl.length, matchIndex + rawUrl.length));
    }

    lastIndex = matchIndex + rawUrl.length;
  });

  if (lastIndex < text.length) {
    nodes.push(renderSegment(lastIndex, text.length));
  }

  return nodes;
}

export function PostContentText({
  text,
  highlight,
  hashtagLinks,
  highlightHashtag,
  textProps,
}: PostContentTextProps) {
  return (
    <Text
      {...textProps}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...textProps?.style,
      }}
    >
      {renderTextWithLinks(text, highlight, hashtagLinks, highlightHashtag)}
    </Text>
  );
}
