type ParsedFeedEntry = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
};

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, token: string) => {
    const lower = token.toLowerCase();
    if (lower.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    }
    if (lower.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    }
    return ENTITY_MAP[lower] ?? _;
  });
}

function stripMarkup(value: string) {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function extractTag(block: string, tagNames: string[]) {
  for (const tag of tagNames) {
    const pattern = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i');
    const match = block.match(pattern);
    if (match?.[1]) {
      return stripMarkup(match[1]);
    }
  }
  return null;
}

function extractLink(block: string) {
  const hrefMatch = block.match(/<(?:\w+:)?link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefMatch?.[1]) {
    return decodeEntities(hrefMatch[1].trim());
  }

  const bodyMatch = block.match(/<(?:\w+:)?link\b[^>]*>([\s\S]*?)<\/(?:\w+:)?link>/i);
  if (bodyMatch?.[1]) {
    return stripMarkup(bodyMatch[1]);
  }

  return null;
}

export function parseFeedXml(xml: string): ParsedFeedEntry[] {
  const blocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi), ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(
    (match) => match[0]
  );

  return blocks
    .map((block, index) => {
      const title = extractTag(block, ['title']);
      const url = extractLink(block);
      const summary = extractTag(block, ['description', 'summary', 'content', 'content:encoded']);
      const publishedAt = extractTag(block, ['pubDate', 'published', 'updated']);
      const id = extractTag(block, ['guid', 'id']) ?? url ?? title ?? `feed-item-${index}`;

      if (!title || !url) {
        return null;
      }

      return {
        id,
        title,
        url,
        summary,
        publishedAt
      };
    })
    .filter((item): item is ParsedFeedEntry => item !== null);
}

export type { ParsedFeedEntry };

