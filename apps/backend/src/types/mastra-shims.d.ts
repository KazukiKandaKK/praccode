declare module '@ai-sdk/provider' {
  export interface LanguageModelV1CallOptions {
    prompt: unknown;
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
    responseFormat?: { type?: string };
    mode?: { type?: string };
  }

  export interface LanguageModelV1StreamPart {
    type: string;
    textDelta?: string;
    finishReason?: string;
    [key: string]: unknown;
  }

  export interface LanguageModelV1 {
    specificationVersion: string;
    provider: string;
    modelId: string;
    defaultObjectGenerationMode?: string;
    doGenerate(options: LanguageModelV1CallOptions): Promise<{
      text?: string;
      finishReason: LanguageModelV1FinishReason;
      usage?: unknown;
      rawCall?: unknown;
      rawResponse?: unknown;
      response?: unknown;
      request?: unknown;
      warnings?: unknown[];
    }>;
    doStream(options: LanguageModelV1CallOptions): Promise<{
      stream: ReadableStream<LanguageModelV1StreamPart>;
    }>;
  }

  export type LanguageModelV1FinishReason = string;
}

declare module '@mastra/core' {
  export interface MastraMemory {
    [key: string]: unknown;
  }

  export interface MastraLanguageModel {
    [key: string]: unknown;
  }
}
