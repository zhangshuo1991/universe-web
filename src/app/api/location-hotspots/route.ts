import { NextResponse } from 'next/server';

import { buildLocationHotspots } from '@/server/locationIntel/hotspots';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const hotspots = await buildLocationHotspots();
    return NextResponse.json(hotspots);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Location hotspots failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
