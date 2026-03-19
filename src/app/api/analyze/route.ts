import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { runAgent } from '@/agent/runAgent';
import { getProviderCatalog } from '@/server/observation/catalog';
import type { AgentContext } from '@/types/agent';

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
    selectedBodyId: z.string().nullable().optional(),
    activePreset: z.enum(['inner', 'outer', 'full', 'earthMoon']).nullable().optional(),
    interfaceMode: z.enum(['explore', 'analysis']).nullable().optional(),
    layers: z.record(z.boolean())
  })
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const payload = requestSchema.parse(await request.json());
    const result = await runAgent(payload.messages, payload.context as AgentContext);
    const providerSnapshot = await getProviderCatalog();
    return NextResponse.json({
      ...result,
      providerSnapshot
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analyze error';
    const providerSnapshot = await getProviderCatalog();
    return NextResponse.json(
      {
        provider: 'fallback',
        actions: [],
        citations: [],
        artifacts: [],
        reply: message,
        providerSnapshot
      },
      { status: 400 }
    );
  }
}
