import { NextRequest, NextResponse } from 'next/server';

import { searchPlaces } from '@/server/geocode';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
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
