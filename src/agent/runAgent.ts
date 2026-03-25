import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

import { runFallbackAgent } from '@/agent/fallback';
import { buildSystemPrompt } from '@/agent/systemPrompt';
import { getToolDefinitions, searchPlaceSchema, toAction, toolSchemas } from '@/agent/toolSchemas';
import { runObservationQuery } from '@/server/observation/query';
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
): Promise<{
  action?: AgentResponsePayload['actions'][number];
  output: unknown;
  citations?: NonNullable<AgentResponsePayload['citations']>;
  artifacts?: NonNullable<AgentResponsePayload['artifacts']>;
}> {
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

  if (name === 'query_weather') {
    const args = toolSchemas.query_weather.parse(payload);
    const result = await runObservationQuery({
      kind: 'weather_current',
      location: {
        lat: args.lat,
        lon: args.lon
      }
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: 'Weather Query',
          content: JSON.stringify(result.data)
        }
      ]
    };
  }

  if (name === 'query_earthquakes') {
    const args = toolSchemas.query_earthquakes.parse(payload);
    const result = await runObservationQuery({
      kind: 'earthquakes_recent',
      maxResults: args.maxResults ?? 8
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: 'Earthquake Query',
          content: JSON.stringify(result.data)
        }
      ]
    };
  }

  if (name === 'query_moon_ephemeris') {
    const result = await runObservationQuery({
      kind: 'moon_ephemeris'
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: 'Moon Ephemeris Query',
          content: JSON.stringify(result.data)
        }
      ]
    };
  }

  if (name === 'list_bodies') {
    const result = await runObservationQuery({
      kind: 'body_catalog'
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: 'Body Catalog',
          content: JSON.stringify(result.data)
        }
      ]
    };
  }

  if (name === 'query_body_state') {
    const args = toolSchemas.query_body_state.parse(payload);
    const result = await runObservationQuery({
      kind: 'body_state',
      bodyId: args.bodyId,
      epochIso: args.epochIso
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: `Body State: ${args.bodyId}`,
          content: JSON.stringify(result.data)
        }
      ]
    };
  }

  if (name === 'query_system_snapshot') {
    const args = toolSchemas.query_system_snapshot.parse(payload);
    const result = await runObservationQuery({
      kind: 'system_snapshot',
      bodyIds: args.bodyIds,
      epochIso: args.epochIso
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: 'Solar System Snapshot',
          content: JSON.stringify(result.data)
        }
      ]
    };
  }

  if (name === 'query_space_weather') {
    const result = await runObservationQuery({
      kind: 'space_weather_current'
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: 'Space Weather',
          content: JSON.stringify(result.data)
        }
      ]
    };
  }

  if (name === 'query_small_bodies') {
    const args = toolSchemas.query_small_bodies.parse(payload);
    const result = await runObservationQuery({
      kind: 'small_body_events',
      maxResults: args.maxResults ?? 10
    });
    return {
      output: {
        ok: true,
        result
      },
      citations: result.citations,
      artifacts: [
        {
          kind: 'query_result',
          title: 'Small Body Events',
          content: JSON.stringify(result.data)
        }
      ]
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

/** Convert our tool definitions to Chat Completions format */
function getChatTools(): ChatCompletionTool[] {
  const rawTools = getToolDefinitions();
  return rawTools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
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
  const chatTools = getChatTools();
  const actions: AgentResponsePayload['actions'] = [];
  const citations: NonNullable<AgentResponsePayload['citations']> = [];
  const artifacts: NonNullable<AgentResponsePayload['artifacts']> = [];
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o';

  // Build conversation history for Chat Completions API
  const chatMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
  ];

  let response = await client.chat.completions.create({
    model,
    messages: chatMessages,
    tools: chatTools,
    tool_choice: 'auto'
  });

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const choice = response.choices[0];
    if (!choice) break;

    const message = choice.message;
    const toolCalls = message.tool_calls;

    // No tool calls — return the text response
    if (!toolCalls || toolCalls.length === 0) {
      return {
        provider: 'openai',
        actions,
        reply: message.content || '已完成分析。',
        citations,
        artifacts
      };
    }

    // Add assistant message with tool calls to history
    chatMessages.push({
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: toolCalls
    } as ChatCompletionMessageParam);

    // Execute all tool calls
    for (const call of toolCalls) {
      if (call.type !== 'function') continue;
      const toolName = call.function.name as keyof typeof toolSchemas;
      try {
        const parsedArgs = safeJsonParse(call.function.arguments ?? '{}');
        const result = await executeTool(toolName, parsedArgs);
        if (result.action) {
          actions.push(result.action);
        }
        if (result.citations?.length) {
          citations.push(...result.citations);
        }
        if (result.artifacts?.length) {
          artifacts.push(...result.artifacts);
        }

        chatMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result.output)
        });
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Tool execution failed';
        chatMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: errMessage })
        });
      }
    }

    // Continue conversation with tool results
    response = await client.chat.completions.create({
      model,
      messages: chatMessages,
      tools: chatTools,
      tool_choice: 'auto'
    });
  }

  // Reached iteration limit
  const finalContent = response.choices[0]?.message?.content;
  return {
    provider: 'openai',
    actions,
    reply: finalContent || '已完成数据查询和分析。',
    citations,
    artifacts
  };
}
