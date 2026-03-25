import type { ObservationCitation } from '@/types/observation';
import type { GeoHub, LocationNewsItem } from '@/types/explorer';
import { CURATED_RSS_SOURCES, type CuratedRssSource } from '@/server/locationIntel/rssSources';
import { inferGeoHubMatches, normalizeText } from '@/server/locationIntel/geoHub';
import { parseFeedXml, type ParsedFeedEntry } from '@/server/locationIntel/xml';

type FetchLocationNewsArgs = {
  queryTerms: string[];
  hubHints?: GeoHub[];
  maxResults?: number;
};

type FeedCacheEntry = {
  expiresAt: number;
  items: Array<ParsedFeedEntry & { source: CuratedRssSource }>;
};

const RSS_CACHE_TTL_MS = 10 * 60 * 1000;
const rssCache = new Map<string, FeedCacheEntry>();
const rssInflight = new Map<string, Promise<Array<ParsedFeedEntry & { source: CuratedRssSource }>>>();

function uniqueStrings(values: Array<string | null | undefined>) {
  return values.filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

function buildLexicon(queryTerms: string[], hubHints: GeoHub[] = []) {
  return uniqueStrings([
    ...queryTerms.map((term) => term.trim()),
    ...hubHints.flatMap((hub) => [hub.name, ...hub.aliases])
  ])
    .filter((term) => term.length >= 3)
    .slice(0, 12);
}

function normalizeArticleUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => {
      url.searchParams.delete(key);
    });
    return url.toString();
  } catch {
    return value.trim();
  }
}

function computeRecencyBoost(publishedAt: string | null | undefined) {
  if (!publishedAt) {
    return 4;
  }

  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    return 4;
  }

  const ageHours = Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
  if (ageHours <= 6) return 24;
  if (ageHours <= 24) return 18;
  if (ageHours <= 72) return 10;
  return 4;
}

function matchTerms(text: string, lexicon: string[]) {
  const haystack = normalizeText(text);
  return lexicon.filter((term) => haystack.includes(normalizeText(term)));
}

function scoreRssItem(
  item: ParsedFeedEntry,
  source: CuratedRssSource,
  lexicon: string[],
  hubHints: GeoHub[]
) {
  const searchableText = [item.title, item.summary].filter(Boolean).join(' ');
  const matchedTerms = matchTerms(searchableText, lexicon);
  const matchedHubIds = inferGeoHubMatches(searchableText, 4).map((match) => match.hubId);
  const relevantHubIds = matchedHubIds.filter((hubId) => hubHints.some((hub) => hub.id === hubId));
  const hintBoost = relevantHubIds.length > 0 ? 6 : 0;
  const score = source.priority * 6 + matchedTerms.length * 9 + relevantHubIds.length * 7 + hintBoost + computeRecencyBoost(item.publishedAt);

  return {
    matchedTerms,
    matchedHubIds: relevantHubIds,
    score
  };
}

async function fetchFeed(source: CuratedRssSource) {
  const cached = rssCache.get(source.id);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return cached.items;
  }

  const existing = rssInflight.get(source.id);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const response = await fetch(source.feedUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'universe-web/0.2 location-intel rss fetcher'
      },
      signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
      throw new Error(`Feed request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const items = parseFeedXml(xml).map((item) => ({ ...item, source }));
    rssCache.set(source.id, {
      expiresAt: Date.now() + RSS_CACHE_TTL_MS,
      items
    });
    return items;
  })();

  rssInflight.set(source.id, promise);
  try {
    return await promise;
  } finally {
    rssInflight.delete(source.id);
  }
}

export async function fetchAllRssFeedItems() {
  const settled = await Promise.allSettled(CURATED_RSS_SOURCES.filter((source) => source.enabledByDefault).map(fetchFeed));
  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

export async function fetchRssLocationNews({
  queryTerms,
  hubHints = [],
  maxResults = 8
}: FetchLocationNewsArgs): Promise<{
  items: LocationNewsItem[];
  citations: ObservationCitation[];
}> {
  const lexicon = buildLexicon(queryTerms, hubHints);
  const feedItems = await fetchAllRssFeedItems();
  const scoredItems = feedItems
    .map((item) => {
      const scoring = scoreRssItem(item, item.source, lexicon, hubHints);
      return {
        ...item,
        ...scoring
      };
    })
    .filter((item) => item.matchedTerms.length > 0 || item.matchedHubIds.length > 0)
    .sort((a, b) => b.score - a.score);

  const deduped = new Map<string, LocationNewsItem>();
  for (const item of scoredItems) {
    const key = normalizeArticleUrl(item.url);
    if (deduped.has(key)) {
      continue;
    }
    deduped.set(key, {
      id: item.id,
      title: item.title,
      url: key,
      source: item.source.name,
      sourceType: 'rss',
      category: item.source.category,
      publishedAt: item.publishedAt,
      matchedTerms: item.matchedTerms,
      matchedHubIds: item.matchedHubIds,
      score: item.score,
      sourceCountry: null
    });
    if (deduped.size >= maxResults) {
      break;
    }
  }

  const items = [...deduped.values()];
  return {
    items,
    citations: items.map((item) => ({
      providerId: 'rss',
      title: `${item.source}: ${item.title}`,
      url: item.url,
      retrievedAtIso: new Date().toISOString()
    }))
  };
}

export async function fetchGdeltLocationNews({
  queryTerms,
  hubHints = [],
  maxResults = 8
}: FetchLocationNewsArgs): Promise<{
  items: LocationNewsItem[];
  citations: ObservationCitation[];
}> {
  const lexicon = buildLexicon(queryTerms, hubHints);
  const query = lexicon.slice(0, 6).map((term) => `"${term}"`).join(' OR ');
  if (!query) {
    return { items: [], citations: [] };
  }

  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('maxrecords', String(Math.max(maxResults * 2, 10)));
  url.searchParams.set('format', 'json');
  url.searchParams.set('sort', 'DateDesc');

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(7000)
  });

  if (!response.ok) {
    throw new Error(`GDELT request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    articles?: Array<{
      title?: string;
      url?: string;
      domain?: string;
      sourcecountry?: string;
      seendate?: string;
    }>;
  };

  const deduped = new Map<string, LocationNewsItem>();
  for (const article of payload.articles ?? []) {
    const title = article.title?.trim();
    const articleUrl = article.url?.trim();
    if (!title || !articleUrl) {
      continue;
    }

    const matchedTerms = matchTerms(title, lexicon);
    const matchedHubIds = inferGeoHubMatches(title, 4).map((match) => match.hubId);
    const relevantHubIds = matchedHubIds.filter((hubId) => hubHints.some((hub) => hub.id === hubId));
    if (matchedTerms.length === 0 && relevantHubIds.length === 0) {
      continue;
    }
    const score = 24 + matchedTerms.length * 8 + relevantHubIds.length * 7 + computeRecencyBoost(article.seendate);
    const normalizedUrl = normalizeArticleUrl(articleUrl);
    if (deduped.has(normalizedUrl)) {
      continue;
    }

    deduped.set(normalizedUrl, {
      id: normalizedUrl,
      title,
      url: normalizedUrl,
      source: article.domain?.trim() || 'GDELT',
      sourceType: 'gdelt',
      category: 'world',
      sourceCountry: article.sourcecountry?.trim() || null,
      publishedAt: article.seendate?.trim() || null,
      matchedTerms,
      matchedHubIds: relevantHubIds,
      score
    });

    if (deduped.size >= maxResults) {
      break;
    }
  }

  const items = [...deduped.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return {
    items,
    citations: items.map((item) => ({
      providerId: 'gdelt',
      title: item.title,
      url: item.url,
      retrievedAtIso: new Date().toISOString()
    }))
  };
}
