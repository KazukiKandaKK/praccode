/**
 * OpenAI API プロバイダー実装
 */

import OpenAI from 'openai';
import type { LLMProvider, LLMGenerateOptions } from './llm-provider.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const baseURL = process.env.OPENAI_BASE_URL;
    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    return this.client;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const timeoutMs = options?.timeoutMs ?? 60000;

    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        },
        { timeout: timeoutMs }
      );

      const text = response.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('OpenAI API returned empty response');
      }

      return text;
    } catch (error) {
      const err = error as { message?: string; status?: number };
      if (typeof err.status === 'number') {
        throw new Error(`OpenAI API error: ${err.status} - ${err.message ?? 'unknown error'}`);
      }
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!process.env.OPENAI_API_KEY) {
      return false;
    }

    try {
      const client = this.getClient();
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
