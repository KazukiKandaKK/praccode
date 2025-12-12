/**
 * Ollama API クライアント
 * ローカルで動作するOllamaに接続してLLM機能を提供
 */

// Docker内からホストのOllamaに接続
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://host.docker.internal:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

/**
 * Ollamaにテキスト生成リクエストを送信
 */
export async function generateWithOllama(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const requestBody: OllamaGenerateRequest = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    ...(options?.jsonMode && { format: 'json' }),
    options: {
      temperature: options?.temperature ?? 0.7,
      num_predict: options?.maxTokens ?? 4096,
    },
  };

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  return data.response;
}

/**
 * Ollamaの接続状態を確認
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 利用可能なモデル一覧を取得
 */
export async function listOllamaModels(): Promise<string[]> {
  const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.status}`);
  }

  const data = (await response.json()) as { models: Array<{ name: string }> };
  return data.models.map((m) => m.name);
}

