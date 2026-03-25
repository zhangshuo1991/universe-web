import OpenAI from 'openai';
import { z } from 'zod';

import type { LocationNewsItem, LocationSummary } from '@/types/explorer';
import type { ObservationCitation } from '@/types/observation';

const gdeltArticleSchema = z.object({
  title: z.string().optional(),
  url: z.string().url().optional(),
  domain: z.string().optional(),
  sourcecountry: z.string().optional(),
  seendate: z.string().optional()
});

const gdeltResponseSchema = z.object({
  articles: z.array(gdeltArticleSchema).optional()
});

type SearchRegionNewsArgs = {
  name: string;
  region?: string | null;
  country?: string | null;
};

export async function searchRegionNews({
  name,
  region,
  country
}: SearchRegionNewsArgs): Promise<{
  items: LocationNewsItem[];
  citations: ObservationCitation[];
}> {
  const queryTerms = [name, region, country]
    .map((item) => item?.trim())
    .filter((item, index, all): item is string => Boolean(item) && all.indexOf(item) === index)
    .slice(0, 3);

  if (queryTerms.length === 0) {
    return { items: [], citations: [] };
  }

  const query = queryTerms.map((term) => `"${term}"`).join(' OR ');
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('maxrecords', '8');
  url.searchParams.set('format', 'json');
  url.searchParams.set('sort', 'DateDesc');

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Region news request failed with status ${response.status}`);
  }

  const parsed = gdeltResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Region news response shape was invalid');
  }

  const seenUrls = new Set<string>();
  const items: LocationNewsItem[] = [];

  for (const article of parsed.data.articles ?? []) {
    const title = article.title?.trim();
    const articleUrl = article.url?.trim();

    if (!title || !articleUrl || seenUrls.has(articleUrl)) {
      continue;
    }

    seenUrls.add(articleUrl);
    items.push({
      id: articleUrl,
      title,
      url: articleUrl,
      source: article.domain?.trim() || 'GDELT',
      sourceType: 'gdelt',
      category: 'world',
      sourceCountry: article.sourcecountry?.trim() || null,
      publishedAt: article.seendate?.trim() || null,
      matchedTerms: [],
      matchedHubIds: [],
      score: 0
    });

    if (items.length >= 6) {
      break;
    }
  }

  const citations: ObservationCitation[] = items.map((item) => ({
    providerId: 'gdelt',
    title: item.title,
    url: item.url,
    retrievedAtIso: new Date().toISOString()
  }));

  return { items, citations };
}

export async function summarizeLocationNews(args: {
  locationName: string;
  country?: string | null;
  weatherSummary?: string | null;
  solarSummary?: string | null;
  newsItems: LocationNewsItem[];
}): Promise<LocationSummary> {
  const fallback = buildFallbackSummary(args);

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    });

    const newsLines = args.newsItems
      .slice(0, 6)
      .map((item, index) => `${index + 1}. ${item.title} | 来源: ${item.source}`);

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 260,
      messages: [
        {
          role: 'system',
          content:
            '你是一个地理新闻编辑。请把地点背景、当前天气/昼夜状态、相关新闻整合成简洁中文摘要。输出一段 120 字以内摘要，并给出 3 个适合继续探索的追问，使用 JSON：{"text":"...","quickPrompts":["...","...","..."]}。'
        },
        {
          role: 'user',
          content: [
            `地点: ${args.locationName}${args.country ? `, ${args.country}` : ''}`,
            args.weatherSummary ? `天气: ${args.weatherSummary}` : null,
            args.solarSummary ? `太阳状态: ${args.solarSummary}` : null,
            newsLines.length > 0 ? `新闻:\n${newsLines.join('\n')}` : '新闻: 暂无可用新闻，请根据地点背景生成导览型摘要。'
          ]
            .filter(Boolean)
            .join('\n\n')
        }
      ]
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return fallback;
    }

    const parsed = z
      .object({
        text: z.string().min(1),
        quickPrompts: z.array(z.string().min(1)).min(1).max(3)
      })
      .safeParse(JSON.parse(content));

    if (!parsed.success) {
      return fallback;
    }

    return parsed.data;
  } catch {
    return fallback;
  }
}

function buildFallbackSummary(args: {
  locationName: string;
  country?: string | null;
  weatherSummary?: string | null;
  solarSummary?: string | null;
  newsItems: LocationNewsItem[];
}): LocationSummary {
  const parts = [
    `${args.locationName}${args.country ? `位于${args.country}` : ''}，适合从地理、天气和地区新闻三个维度快速了解。`,
    args.weatherSummary ? `当前${args.weatherSummary}。` : null,
    args.solarSummary ? `${args.solarSummary}。` : null,
    args.newsItems[0] ? `最近一条相关新闻来自 ${args.newsItems[0].source}：${args.newsItems[0].title}。` : '暂未抓取到相关新闻，可继续通过轻对话做定向追问。'
  ];

  return {
    text: parts.filter(Boolean).join(' '),
    quickPrompts: [
      `概括 ${args.locationName} 当前最值得关注的新闻`,
      `比较 ${args.locationName} 和附近区域的天气与新闻差异`,
      `介绍 ${args.locationName} 的地理与城市特点`
    ]
  };
}
