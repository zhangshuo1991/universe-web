import type { LocationHotspot, LocationHotspotResponse } from '@/types/explorer';
import type { ObservationCitation } from '@/types/observation';
import { getFeaturedGeoHubs, getGeoHubById, getRecommendedGeoHubs, inferGeoHubMatches } from '@/server/locationIntel/geoHub';
import { fetchAllRssFeedItems, fetchGdeltLocationNews } from '@/server/locationIntel/newsFetch';

function makeHotspot(args: {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  kind: LocationHotspot['kind'];
  priority: LocationHotspot['priority'];
  score: number;
  reason: string;
  matchedHeadline?: string | null;
}): LocationHotspot {
  return {
    ...args,
    updatedAtIso: new Date().toISOString()
  };
}

export async function buildLocationHotspots(): Promise<LocationHotspotResponse> {
  const featured = getFeaturedGeoHubs(6);
  const recommended = getRecommendedGeoHubs(6);

  const [rssResult, gdeltResult] = await Promise.allSettled([
    fetchAllRssFeedItems(),
    fetchGdeltLocationNews({
      queryTerms: featured.flatMap((hub) => [hub.name, ...hub.aliases.slice(0, 1)]).slice(0, 8),
      hubHints: featured,
      maxResults: 10
    })
  ]);

  const aggregate = new Map<
    string,
    {
      score: number;
      headline: string | null;
      citations: ObservationCitation[];
    }
  >();

  const pushMatch = (hubId: string, score: number, headline: string, citation: ObservationCitation) => {
    const existing = aggregate.get(hubId);
    if (!existing) {
      aggregate.set(hubId, {
        score,
        headline,
        citations: [citation]
      });
      return;
    }

    aggregate.set(hubId, {
      score: existing.score + score,
      headline: existing.headline ?? headline,
      citations: [...existing.citations, citation]
    });
  };

  if (rssResult.status === 'fulfilled') {
    rssResult.value.slice(0, 80).forEach((item) => {
      inferGeoHubMatches([item.title, item.summary].filter(Boolean).join(' '), 3).forEach((match) => {
        pushMatch(
          match.hubId,
          match.score + 12,
          item.title,
          {
            providerId: 'rss',
            title: `${item.source.name}: ${item.title}`,
            url: item.url,
            retrievedAtIso: new Date().toISOString()
          }
        );
      });
    });
  }

  if (gdeltResult.status === 'fulfilled') {
    gdeltResult.value.items.forEach((item) => {
      inferGeoHubMatches(item.title, 3).forEach((match) => {
        pushMatch(
          match.hubId,
          match.score + (item.score ?? 0),
          item.title,
          {
            providerId: 'gdelt',
            title: item.title,
            url: item.url,
            retrievedAtIso: new Date().toISOString()
          }
        );
      });
    });
  }

  const trendingHubs = [...aggregate.entries()]
    .map(([hubId, data]) => {
      const hub = getGeoHubById(hubId);
      if (!hub) {
        return null;
      }
      return makeHotspot({
        id: hub.id,
        name: hub.name,
        region: hub.region,
        country: hub.country,
        lat: hub.lat,
        lon: hub.lon,
        kind: hub.kind,
        priority: hub.priority,
        score: Math.min(100, Math.round(data.score / 3)),
        reason: data.headline ? `近期标题聚焦：${data.headline}` : '近一轮多源标题中出现频率较高。',
        matchedHeadline: data.headline
      });
    })
    .filter((hub): hub is LocationHotspot => hub !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const citations = [
    ...featured.map((hub) => ({
      providerId: 'geoHub' as const,
      title: `${hub.name} · Geo Hub`,
      url: `https://www.openstreetmap.org/?mlat=${hub.lat}&mlon=${hub.lon}#map=5/${hub.lat}/${hub.lon}`,
      retrievedAtIso: new Date().toISOString()
    })),
    ...[...aggregate.values()].flatMap((item) => item.citations).slice(0, 12)
  ];

  return {
    featuredHubs: featured.map((hub, index) =>
      makeHotspot({
        id: hub.id,
        name: hub.name,
        region: hub.region,
        country: hub.country,
        lat: hub.lat,
        lon: hub.lon,
        kind: hub.kind,
        priority: hub.priority,
        score: 76 - index * 4,
        reason: hub.description
      })
    ),
    trendingHubs,
    recommendedHubs: recommended.map((hub, index) =>
      makeHotspot({
        id: hub.id,
        name: hub.name,
        region: hub.region,
        country: hub.country,
        lat: hub.lat,
        lon: hub.lon,
        kind: hub.kind,
        priority: hub.priority,
        score: 68 - index * 3,
        reason: hub.description
      })
    ),
    citations,
    sourceStatus: {
      gdelt: gdeltResult.status === 'fulfilled' ? (gdeltResult.value.items.length > 0 ? 'ok' : 'empty') : 'error',
      rss: rssResult.status === 'fulfilled' ? (rssResult.value.length > 0 ? 'ok' : 'empty') : 'error',
      geoHub: 'ok'
    },
    updatedAtIso: new Date().toISOString()
  };
}
