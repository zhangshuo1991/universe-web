import { NextResponse } from 'next/server';

import { getLayerCatalog } from '@/server/observation/catalog';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    layers: getLayerCatalog()
  });
}
