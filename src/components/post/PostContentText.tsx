'use client';

import { Anchor, Text, type TextProps } from '@mantine/core';
import type { HTMLAttributes } from 'react';

type PostContentTextProps = {
  text: string;
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

function renderTextWithLinks(text: string) {
  const matches = Array.from(text.matchAll(URL_PATTERN));

  if (matches.length === 0) {
    return text;
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const rawUrl = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
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
        {cleanUrl}
      </Anchor>,
    );

    if (trailingText) {
      nodes.push(trailingText);
    }

    lastIndex = matchIndex + rawUrl.length;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function PostContentText({
  text,
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
      {renderTextWithLinks(text)}
    </Text>
  );
}
