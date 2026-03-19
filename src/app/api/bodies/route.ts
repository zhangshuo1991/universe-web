import { NextResponse } from 'next/server';

import { getDefaultBodyIds, getSolarSystemCatalog } from '@/server/observation/solarSystem';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    bodies: getSolarSystemCatalog(),
    defaultBodyIds: getDefaultBodyIds()
  });
}
