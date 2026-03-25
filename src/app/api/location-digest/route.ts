import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { buildLocationDigest } from '@/server/locationDigest';

const requestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  landmarkId: z.string().optional().nullable(),
  placeName: z.string().optional().nullable()
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const payload = requestSchema.parse(await request.json());
    const digest = await buildLocationDigest(payload);
    return NextResponse.json(digest);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Location digest failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
