import OpenAI from 'openai';

import type {
  GeoHub,
  GeoHubMatch,
  LocationNewsItem,
  LocationSourceStatusMap,
  LocationSummary,
  SourceBreakdownEntry,
  SourceStatus
} from '@/types/explorer';
import type { ObservationCitation } from '@/types/observation';
import { fetchGdeltLocationNews, fetchRssLocationNews } from '@/server/locationIntel/newsFetch';
import { findNearbyGeoHubs, getGeoHubById, inferGeoHubMatches } from '@/server/locationIntel/geoHub';

type BuildLocationIntelArgs = {
  lat: number;
  lon: number;
  locationName: string;
  country?: string | null;
  region?: string | null;
  weatherSummary?: string | null;
  solarSummary?: string | null;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return values.filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

function mergeGeoHubMatches(matches: GeoHubMatch[]) {
  const merged = new Map<string, GeoHubMatch>();
  for (const match of matches) {
    const existing = merged.get(match.hubId);
    if (!existing) {
      merged.set(match.hubId, {
        ...match,
        matchedTerms: [...match.matchedTerms]
      });
      continue;
    }

    merged.set(match.hubId, {
      ...existing,
      score: Math.max(existing.score, match.score),
      matchedTerms: uniqueStrings([...existing.matchedTerms, ...match.matchedTerms])
    });
  }

  return [...merged.values()].sort((a, b) => b.score - a.score);
}

function buildNearbyGeoHubMatches(hubs: GeoHub[]) {
  return hubs.map((hub, index) => ({
    hubId: hub.id,
    hubName: hub.name,
    kind: hub.kind,
    priority: hub.priority,
    score: 32 - index * 4,
    matchedTerms: ['nearby']
  }));
}

function buildSourceBreakdown(items: LocationNewsItem[]): SourceBreakdownEntry[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function computeFreshnessScore(items: LocationNewsItem[]) {
  if (items.length === 0) {
    return 0;
  }

  const scores = items.slice(0, 5).map((item) => {
    if (!item.publishedAt) {
      return 22;
    }
    const date = new Date(item.publishedAt);
    if (Number.isNaN(date.getTime())) {
      return 22;
    }
    const ageHours = Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
    if (ageHours <= 6) return 100;
    if (ageHours <= 24) return 82;
    if (ageHours <= 72) return 62;
    return 38;
  });

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function computeHotspotScore(items: LocationNewsItem[], geoHubMatches: GeoHubMatch[], sourceBreakdown: SourceBreakdownEntry[]) {
  const topNewsScore = items.slice(0, 5).reduce((sum, item) => sum + Math.min(item.score ?? 0, 70), 0);
  const diversityBoost = Math.min(24, sourceBreakdown.length * 6);
  const geoBoost = Math.min(22, geoHubMatches.length * 7);
  return Math.max(0, Math.min(100, Math.round(topNewsScore / 4 + diversityBoost + geoBoost)));
}

function buildWhyItMatters(args: {
  geoHubMatches: GeoHubMatch[];
  sourceBreakdown: SourceBreakdownEntry[];
  freshnessScore: number;
  weatherSummary?: string | null;
  solarSummary?: string | null;
}) {
  const reasons: string[] = [];

  if (args.geoHubMatches[0]) {
    reasons.push(`命中地理热点标签：${args.geoHubMatches.slice(0, 2).map((match) => match.hubName).join('、')}。`);
  }
  if (args.sourceBreakdown.length > 1) {
    reasons.push(`近况来自 ${args.sourceBreakdown.length} 个新闻源，交叉参考价值更高。`);
  }
  if (args.freshnessScore >= 80) {
    reasons.push('最近报道较新，适合继续追踪短期变化。');
  }
  if (args.weatherSummary || args.solarSummary) {
    reasons.push([args.weatherSummary, args.solarSummary].filter(Boolean).join('，') + '。');
  }

  return reasons.slice(0, 3);
}

function buildDeterministicSummary(args: {
  locationName: string;
  country?: string | null;
  region?: string | null;
  newsItems: LocationNewsItem[];
  geoHubMatches: GeoHubMatch[];
  hotspotScore: number;
  freshnessScore: number;
  weatherSummary?: string | null;
  solarSummary?: string | null;
}): LocationSummary {
  const leadingSources = uniqueStrings(args.newsItems.slice(0, 3).map((item) => item.source)).join('、');
  const headline = args.newsItems[0]?.title;
  const geoHubLine = args.geoHubMatches[0] ? `命中 ${args.geoHubMatches[0].hubName} 等地理热点。` : '当前以地点自身相关报道为主。';
  const sourceLine = leadingSources ? `主要来源包括 ${leadingSources}。` : '当前可用来源有限。';
  const headlineLine = headline ? `最新关注点是“${headline}”。` : '暂未抓到足够的新近标题，可先从基础背景切入。';

  return {
    text: [
      `${args.locationName}${args.country ? `位于${args.country}` : ''}${args.region ? `，属于${args.region}` : ''}。`,
      geoHubLine,
      headlineLine,
      `${sourceLine} 热度分 ${args.hotspotScore}，新鲜度 ${args.freshnessScore}。`,
      args.weatherSummary ? `天气方面，${args.weatherSummary}。` : null,
      args.solarSummary ? `${args.solarSummary}。` : null
    ]
      .filter(Boolean)
      .join(' '),
    whyItMatters: buildWhyItMatters({
      geoHubMatches: args.geoHubMatches,
      sourceBreakdown: buildSourceBreakdown(args.newsItems),
      freshnessScore: args.freshnessScore,
      weatherSummary: args.weatherSummary,
      solarSummary: args.solarSummary
    }),
    quickPrompts: [
      `概括 ${args.locationName} 最近最值得关注的议题`,
      `分析 ${args.locationName} 的新闻热点和地理背景`,
      `列出 ${args.locationName} 附近还值得观察的地点`
    ]
  };
}

async function polishSummaryWithOpenAI(summary: LocationSummary, items: LocationNewsItem[], locationName: string) {
  if (!process.env.OPENAI_API_KEY) {
    return summary;
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    });

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 320,
      messages: [
        {
          role: 'system',
          content:
            '你是地点情报编辑。基于已有事实稿和标题，润色为简洁中文，不新增事实。输出 JSON：{"text":"...","whyItMatters":["..."],"quickPrompts":["...","...","..."]}。'
        },
        {
          role: 'user',
          content: JSON.stringify({
            locationName,
            draft: summary,
            headlines: items.slice(0, 4).map((item) => ({
              title: item.title,
              source: item.source,
              publishedAt: item.publishedAt
            }))
          })
        }
      ]
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return summary;
    }

    const parsed = JSON.parse(content) as Partial<LocationSummary>;
    if (!parsed.text || !Array.isArray(parsed.quickPrompts)) {
      return summary;
    }

    return {
      text: parsed.text,
      whyItMatters: Array.isArray(parsed.whyItMatters) ? parsed.whyItMatters.slice(0, 3) : summary.whyItMatters,
      quickPrompts: parsed.quickPrompts.filter(Boolean).slice(0, 3)
    };
  } catch {
    return summary;
  }
}

function toStatus(items: LocationNewsItem[], errored: boolean): SourceStatus {
  if (errored) return 'error';
  return items.length > 0 ? 'ok' : 'empty';
}

export async function buildLocationIntel(args: BuildLocationIntelArgs): Promise<{
  newsItems: LocationNewsItem[];
  geoHubMatches: GeoHubMatch[];
  sourceBreakdown: SourceBreakdownEntry[];
  hotspotScore: number;
  freshnessScore: number;
  sourceStatus: LocationSourceStatusMap;
  summary: LocationSummary;
  citations: ObservationCitation[];
}> {
  const nearbyHubs = findNearbyGeoHubs(args.lat, args.lon, 700, 3);
  const inferredNameMatches = inferGeoHubMatches([args.locationName, args.region, args.country].filter(Boolean).join(' '), 4);
  const baseGeoHubMatches = mergeGeoHubMatches([...inferredNameMatches, ...buildNearbyGeoHubMatches(nearbyHubs)]);
  const hubHints = uniqueStrings(baseGeoHubMatches.map((match) => getGeoHubById(match.hubId)?.id))
    .map((id) => getGeoHubById(id))
    .filter((hub): hub is GeoHub => hub !== null);
  const queryTerms = uniqueStrings([
    args.locationName,
    args.region,
    args.country,
    ...hubHints.map((hub) => hub.name),
    ...hubHints.flatMap((hub) => hub.aliases.slice(0, 2)),
    ...hubHints.flatMap((hub) => hub.keywords.slice(0, 2))
  ]).slice(0, 10);

  const [gdeltResult, rssResult] = await Promise.allSettled([
    fetchGdeltLocationNews({ queryTerms, hubHints, maxResults: 6 }),
    fetchRssLocationNews({ queryTerms, hubHints, maxResults: 8 })
  ]);

  const gdeltItems = gdeltResult.status === 'fulfilled' ? gdeltResult.value.items : [];
  const rssItems = rssResult.status === 'fulfilled' ? rssResult.value.items : [];
  const citations = [
    ...(gdeltResult.status === 'fulfilled' ? gdeltResult.value.citations : []),
    ...(rssResult.status === 'fulfilled' ? rssResult.value.citations : [])
  ];

  const mergedNews = [...gdeltItems, ...rssItems]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 8);

  const articleGeoHubMatches = mergeGeoHubMatches(
    mergedNews.flatMap((item) =>
      (item.matchedHubIds ?? []).map((hubId) => ({
        hubId,
        hubName: getGeoHubById(hubId)?.name ?? hubId,
        kind: getGeoHubById(hubId)?.kind ?? 'strategic',
        priority: getGeoHubById(hubId)?.priority ?? 'watch',
        score: item.score ?? 0,
        matchedTerms: item.matchedTerms ?? []
      }))
    )
  );
  const geoHubMatches = mergeGeoHubMatches([...baseGeoHubMatches, ...articleGeoHubMatches]).slice(0, 5);
  const sourceBreakdown = buildSourceBreakdown(mergedNews);
  const freshnessScore = computeFreshnessScore(mergedNews);
  const hotspotScore = computeHotspotScore(mergedNews, geoHubMatches, sourceBreakdown);
  const summary = await polishSummaryWithOpenAI(
    buildDeterministicSummary({
      locationName: args.locationName,
      country: args.country,
      region: args.region,
      newsItems: mergedNews,
      geoHubMatches,
      hotspotScore,
      freshnessScore,
      weatherSummary: args.weatherSummary,
      solarSummary: args.solarSummary
    }),
    mergedNews,
    args.locationName
  );

  return {
    newsItems: mergedNews,
    geoHubMatches,
    sourceBreakdown,
    hotspotScore,
    freshnessScore,
    sourceStatus: {
      gdelt: toStatus(gdeltItems, gdeltResult.status === 'rejected'),
      rss: toStatus(rssItems, rssResult.status === 'rejected'),
      geoHub: geoHubMatches.length > 0 ? 'ok' : 'empty',
      weather: args.weatherSummary ? 'ok' : 'empty'
    },
    summary,
    citations
  };
}
