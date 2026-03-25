import { NextRequest, NextResponse } from 'next/server';

import { searchPlaces, reverseGeocode } from '@/server/geocode';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');
  const query = request.nextUrl.searchParams.get('q') ?? '';

  // Reverse geocode: ?lat=xx&lon=xx
  if (lat && lon) {
    try {
      const result = await reverseGeocode(
        Number(lat),
        Number(lon),
        request.headers.get('accept-language') ?? undefined
      );
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ displayName: null, name: null }, { status: 200 });
    }
  }

  // Forward geocode: ?q=xxx
  if (query.trim().length < 2) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  try {
    const results = await searchPlaces(query, {
      language: request.headers.get('accept-language') ?? undefined,
      limit: 5
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
