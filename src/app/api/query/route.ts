import { NextRequest, NextResponse } from 'next/server';

import { runObservationQuery } from '@/server/observation/query';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const result = await runObservationQuery(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Observation query failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
