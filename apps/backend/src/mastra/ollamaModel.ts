/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { randomUUID } from 'crypto';
import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider';
import { ReadableStream } from 'node:stream/web';
import { generateWithOllama } from '../infrastructure/llm/llm-client';

const FALLBACK_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120_000);
/**
 * Minimal Ollama adapter that satisfies the AI SDK LanguageModelV1 interface
 * so Mastra Agents can run against the existing Ollama provider.
 */
export class MastraOllamaModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly provider = 'ollama';
  readonly modelId = FALLBACK_MODEL;
  readonly defaultObjectGenerationMode = 'json';

  async doGenerate(options: LanguageModelV1CallOptions) {
    const promptText = this.buildPrompt(options.prompt);
    const now = new Date();
    const wantsJson =
      options.responseFormat?.type === 'json' || options.mode?.type === 'object-json';

    const text = await generateWithOllama(promptText, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: wantsJson,
      timeoutMs: OLLAMA_TIMEOUT_MS,
    });

    return {
      text,
      finishReason: 'stop' as LanguageModelV1FinishReason,
      usage: {
        promptTokens: 0,
        completionTokens: text?.length ?? 0,
      },
      rawCall: {
        rawPrompt: options.prompt,
        rawSettings: {
          model: this.modelId,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          stopSequences: options.stopSequences,
        },
      },
      rawResponse: {
        headers: {},
      },
      response: {
        id: randomUUID(),
        timestamp: now,
        modelId: this.modelId,
      },
      request: {
        body: undefined,
      },
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV1CallOptions) {
    const result = await this.doGenerate(options);

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      start(controller) {
        if (result.text) {
          controller.enqueue({
            type: 'text-delta',
            textDelta: result.text,
          });
        }
        controller.enqueue({
          type: 'finish',
          finishReason: result.finishReason,
          usage: result.usage,
        });
        controller.close();
      },
    });

    return {
      stream,
      rawCall: result.rawCall,
      rawResponse: result.rawResponse,
      request: result.request,
    };
  }

  private buildPrompt(prompt: LanguageModelV1CallOptions['prompt']): string {
    return prompt
      .map((message) => {
        if (message.role === 'system') {
          return `Instruction:\n${message.content}`;
        }

        if (message.role === 'user') {
          const textParts = message.content
            .filter((part) => part.type === 'text')
            .map((part) => ('text' in part ? part.text : ''))
            .join('\n');
          return [
            'Input:',
            '---USER_INPUT_START---',
            textParts,
            '---USER_INPUT_END---',
          ].join('\n');
        }

        if (message.role === 'assistant') {
          const textParts = message.content
            .filter((part) => part.type === 'text')
            .map((part) => ('text' in part ? part.text : ''))
            .join('\n');
          return `Assistant notes:\n${textParts}`;
        }

        return `Tool data:\n${JSON.stringify(message.content)}`;
      })
      .join('\n\n');
  }
}
