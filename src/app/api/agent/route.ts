import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { runAgent } from '@/agent/runAgent';

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1)
    })
  ),
  context: z.object({
    simulationTimeIso: z.string().datetime(),
    inertialMode: z.boolean(),
    selectedLocation: z
      .object({
        lat: z.number(),
        lon: z.number(),
        label: z.string().optional()
      })
      .nullable()
      .optional(),
    layers: z.object({
      dayNight: z.boolean(),
      atmosphere: z.boolean(),
      cityMarkers: z.boolean(),
      moon: z.boolean(),
      satellites: z.boolean(),
      weatherClouds: z.boolean(),
      weatherTemperature: z.boolean()
    })
  })
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const payload = requestSchema.parse(await request.json());
    const result = await runAgent(payload.messages, payload.context);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown agent error';
    return NextResponse.json(
      {
        provider: 'fallback',
        actions: [],
        reply: message
      },
      { status: 400 }
    );
  }
}
