import { NextResponse } from 'next/server';

import { getProviderCatalog } from '@/server/observation/catalog';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    providers: getProviderCatalog()
  });
}
