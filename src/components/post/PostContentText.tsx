'use client';

import { Anchor, Mark, Text, type TextProps } from '@mantine/core';
import type { HTMLAttributes } from 'react';

type PostContentTextProps = {
  text: string;
  highlight?: string;
  textProps?: TextProps & HTMLAttributes<HTMLElement>;
};

const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
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

function renderTextWithLinks(text: string, highlight = '') {
  const search = highlight.trim();
  // Match the full text so a search phrase can span a link boundary.
  const highlights = search
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

  const matches = Array.from(text.matchAll(URL_PATTERN));

  if (matches.length === 0) {
    return renderSegment(0, text.length);
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const rawUrl = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      nodes.push(renderSegment(lastIndex, matchIndex));
    }

    const { cleanUrl, trailingText } =
      splitTrailingPunctuation(rawUrl);
    const href = normalizeHref(cleanUrl);

    nodes.push(
      <Anchor
        key={`${cleanUrl}-${matchIndex}-${index}`}
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
      {renderTextWithLinks(text, highlight)}
    </Text>
  );
}
