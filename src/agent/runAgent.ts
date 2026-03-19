import OpenAI from 'openai';

import { runFallbackAgent } from '@/agent/fallback';
import { buildSystemPrompt } from '@/agent/systemPrompt';
import { getToolDefinitions, searchPlaceSchema, toAction, toolSchemas } from '@/agent/toolSchemas';
import { searchPlaces } from '@/server/geocode';
import type { AgentContext, AgentMessage, AgentResponsePayload } from '@/types/agent';

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function executeTool(
  name: keyof typeof toolSchemas,
  payload: unknown
): Promise<{ action?: AgentResponsePayload['actions'][number]; output: unknown }> {
  if (name === 'search_place') {
    const args = searchPlaceSchema.parse(payload);
    const results = await searchPlaces(args.query, { limit: args.maxResults ?? 5 });
    return {
      output: {
        ok: true,
        results
      }
    };
  }

  const action = toAction(name, payload);
  return {
    action,
    output: {
      ok: true,
      action
    }
  };
}

export async function runAgent(messages: AgentMessage[], context: AgentContext): Promise<AgentResponsePayload> {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');

  if (!latestUserMessage) {
    return {
      provider: 'fallback',
      actions: [],
      reply: '没有收到用户输入。'
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return runFallbackAgent(latestUserMessage.content, context);
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });
  const tools = getToolDefinitions();
  const actions: AgentResponsePayload['actions'] = [];
  const model = process.env.OPENAI_MODEL ?? 'gpt-5';

  let response = await client.responses.create({
    model,
    instructions: buildSystemPrompt(context),
    input: messages.map((message) => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }]
    })) as never,
    tools: tools as never
  });

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const outputItems = (response.output ?? []) as Array<{
      type: string;
      name?: keyof typeof toolSchemas;
      arguments?: string;
      call_id?: string;
    }>;
    const toolCalls = outputItems.filter((item) => item.type === 'function_call' && item.name && item.call_id);

    if (toolCalls.length === 0) {
      return {
        provider: 'openai',
        actions,
        reply: response.output_text || '已完成 viewer 更新。'
      };
    }

    const toolOutputs = await Promise.all(
      toolCalls.map(async (call) => {
        try {
          const parsedArgs = safeJsonParse(call.arguments ?? '{}');
          const result = await executeTool(call.name!, parsedArgs);
          if (result.action) {
            actions.push(result.action);
          }

          return {
            type: 'function_call_output',
            call_id: call.call_id!,
            output: JSON.stringify(result.output)
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          return {
            type: 'function_call_output',
            call_id: call.call_id!,
            output: JSON.stringify({ ok: false, error: message })
          };
        }
      })
    );

    response = await client.responses.create({
      model,
      previous_response_id: response.id,
      instructions: buildSystemPrompt(context),
      input: toolOutputs as never,
      tools: tools as never
    });
  }

  return {
    provider: 'openai',
    actions,
    reply: response.output_text || 'Reached tool-call limit for this turn.'
  };
}
