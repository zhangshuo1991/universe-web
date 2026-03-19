import { z } from 'zod';

export const geocodeQuerySchema = z.string().trim().min(2).max(120);

const nominatimItemSchema = z.object({
  place_id: z.number(),
  display_name: z.string(),
  lat: z.string(),
  lon: z.string(),
  type: z.string().optional(),
  class: z.string().optional(),
  importance: z.number().optional()
});

const defaultLanguage = 'zh-CN,zh;q=0.9,en;q=0.8';
const userAgent = 'universe-web-earth-observer/0.1 (interactive geocoder)';

export type GeocodeResult = {
  id: number;
  label: string;
  lat: number;
  lon: number;
  kind: string;
  importance: number;
};

export async function searchPlaces(
  rawQuery: string,
  options?: {
    language?: string;
    limit?: number;
  }
): Promise<GeocodeResult[]> {
  const query = geocodeQuerySchema.parse(rawQuery);
  const language = options?.language ?? defaultLanguage;
  const limit = Math.min(Math.max(options?.limit ?? 5, 1), 8);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('q', query);

  const response = await fetch(url, {
    headers: {
      'Accept-Language': language,
      'User-Agent': userAgent
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`);
  }

  const payload = z.array(nominatimItemSchema).safeParse(await response.json());
  if (!payload.success) {
    throw new Error('Geocoding response shape was invalid');
  }

  return payload.data.map((item) => ({
    id: item.place_id,
    label: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
    kind: item.type ?? item.class ?? 'place',
    importance: item.importance ?? 0
  }));
}
