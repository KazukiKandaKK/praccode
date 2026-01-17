/**
 * Google Gemini API プロバイダー実装
 */

import type { LLMProvider, LLMGenerateOptions } from './llm-provider.js';
import { parseRetryAfter } from './retry-handler.js';
import { PromptSanitizer } from './prompt-sanitizer.js';
import { promises as fs } from 'fs';
import { createSign } from 'crypto';

type GeminiGenerateRequest = {
  contents: {
    role: 'user' | 'model';
    parts: {
      text: string;
    }[];
  }[];
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
  };
};

export class GeminiProvider implements LLMProvider {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    const mode = (process.env.GEMINI_AUTH_MODE || 'api_key').toLowerCase();
    const authMode =
      mode === 'vertex' || mode === 'api_key' || mode === 'auto' ? mode : 'api_key';
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

    // プロンプト全体をサニタイズ（既に構造化されている前提）
    // ただし、セパレータ部分は除外してサニタイズ
    const sanitizedPrompt = this.sanitizeStructuredPrompt(prompt);

    const requestBody: GeminiGenerateRequest = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: sanitizedPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
        ...(options?.jsonMode && { responseMimeType: 'application/json' }),
      },
    };

    // タイムアウト設定（デフォルト60秒）
    const timeoutMs = options?.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { url, headers } = await this.buildRequestContext(authMode, model);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        // 429エラーの場合、Retry-Afterヘッダーを含めてエラーをスロー
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterMs = parseRetryAfter(retryAfter);
          const retryInfo = retryAfterMs ? ` (Retry after ${retryAfterMs}ms)` : '';
          throw new Error(`Gemini API rate limit (429)${retryInfo}: ${errorText}`);
        }

        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      // streamGenerateContentはストリーミングレスポンスを返す可能性がある
      // レスポンステキストを取得して処理
      const responseText = await response.text();

      const allTexts: string[] = [];
      let hasCandidates = false;

      // Handle both streaming and non-streaming responses
      try {
        const lines = responseText
          .trim()
          .split('\n')
          .filter((line) => line.startsWith('[') || line.startsWith('{'));

        for (const line of lines) {
          // Sometimes the stream response is wrapped in an array, sometimes not.
          const items = JSON.parse(line);
          const responses = Array.isArray(items) ? items : [items];

          for (const data of responses) {
            if (data.error) {
              throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
            }
            if (data.candidates && data.candidates.length > 0) {
              hasCandidates = true;
              const texts = data.candidates
                .map((candidate: any) => candidate.content?.parts?.[0]?.text)
                .filter((text: any): text is string => Boolean(text));
              allTexts.push(...texts);
            }
          }
        }
      } catch (parseError) {
        // If parsing lines fails, try to parse the whole thing as one JSON object
        try {
          const data = JSON.parse(responseText);
          if (data.error) {
            throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
          }
          if (data.candidates && data.candidates.length > 0) {
            hasCandidates = true;
            const texts = data.candidates
              .map((candidate: any) => candidate.content?.parts?.[0]?.text)
              .filter((text: any): text is string => Boolean(text));
            allTexts.push(...texts);
          }
        } catch (fallbackError) {
          const originalMessage =
            parseError instanceof Error ? parseError.message : String(parseError);
          const fallbackMessage =
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(
            `Failed to parse Gemini API response: ${responseText.substring(
              0,
              200
            )} (primary: ${originalMessage}; fallback: ${fallbackMessage})`
          );
        }
      }

      if (!hasCandidates) {
        throw new Error('Gemini API returned no candidates');
      }

      if (allTexts.length === 0) {
        throw new Error('Gemini API returned empty response');
      }

      return allTexts.join('');
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Gemini request timed out after ${timeoutMs / 1000} seconds`);
      }
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    const mode = (process.env.GEMINI_AUTH_MODE || 'api_key').toLowerCase();
    const authMode =
      mode === 'vertex' || mode === 'api_key' || mode === 'auto' ? mode : 'api_key';
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

    try {
      const { url, headers } = await this.buildHealthcheckContext(authMode, model);
      if (!url) {
        return false;
      }
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async buildRequestContext(
    mode: 'vertex' | 'api_key' | 'auto',
    model: string
  ): Promise<{ url: string; headers: Record<string, string> }> {
    if (mode === 'api_key' || (mode === 'auto' && process.env.GEMINI_API_KEY)) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }
      const apiUrl = process.env.GEMINI_API_URL || 'https://aiplatform.googleapis.com/v1';
      return {
        url: `${apiUrl}/publishers/google/models/${model}:streamGenerateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        headers: {},
      };
    }

    const project =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.VERTEX_PROJECT;
    const location =
      process.env.GOOGLE_CLOUD_LOCATION ||
      process.env.GCP_LOCATION ||
      process.env.VERTEX_LOCATION ||
      'us-central1';
    if (!project) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is not set');
    }

    const baseUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}`;
    const token = await this.getAccessToken();
    return {
      url: `${baseUrl}/publishers/google/models/${model}:streamGenerateContent`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  private async buildHealthcheckContext(
    mode: 'vertex' | 'api_key' | 'auto',
    model: string
  ): Promise<{ url: string; headers: Record<string, string> }> {
    if (mode === 'api_key' || (mode === 'auto' && process.env.GEMINI_API_KEY)) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return { url: '', headers: {} };
      }
      const apiUrl = process.env.GEMINI_API_URL || 'https://aiplatform.googleapis.com/v1';
      return {
        url: `${apiUrl}/publishers/google/models/${model}?key=${encodeURIComponent(apiKey)}`,
        headers: {},
      };
    }

    const project =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.VERTEX_PROJECT;
    const location =
      process.env.GOOGLE_CLOUD_LOCATION ||
      process.env.GCP_LOCATION ||
      process.env.VERTEX_LOCATION ||
      'us-central1';
    if (!project) {
      return { url: '', headers: {} };
    }

    const baseUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}`;
    const token = await this.getAccessToken();
    return {
      url: `${baseUrl}/publishers/google/models/${model}`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value;
    }

    const credentialsPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CREDENTIALS_FILE;
    if (!credentialsPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    }

    const raw = await fs.readFile(credentialsPath, 'utf-8');
    const credentials = JSON.parse(raw) as {
      client_email: string;
      private_key: string;
    };

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid service account credentials file');
    }

    const tokenUri = 'https://oauth2.googleapis.com/token';
    const iat = Math.floor(now / 1000);
    const exp = iat + 3600;

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: credentials.client_email,
      sub: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: tokenUri,
      iat,
      exp,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign('RSA-SHA256');
    signer.update(unsignedToken);
    signer.end();

    const signature = signer.sign(credentials.private_key);
    const jwt = `${unsignedToken}.${this.base64UrlEncode(signature)}`;

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI auth error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    const expiresAt = now + (data.expires_in ?? 3600) * 1000;
    this.cachedToken = { value: data.access_token, expiresAt };
    return data.access_token;
  }

  private base64UrlEncode(input: string | Buffer): string {
    const buffer = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * 構造化されたプロンプトをサニタイズ
   * セパレータで囲まれたユーザー入力部分のみをサニタイズ
   */
  private sanitizeStructuredPrompt(prompt: string): string {
    const separatorStart = '---USER_INPUT_START---';
    const separatorEnd = '---USER_INPUT_END---';

    // セパレータがない場合は全体をサニタイズ
    if (!prompt.includes(separatorStart)) {
      return PromptSanitizer.sanitizeTemplate(prompt, 'prompt');
    }

    // セパレータで分割して、ユーザー入力部分のみサニタイズ
    const parts: string[] = [];
    const remaining = prompt;
    let startIndex = 0;

    while (true) {
      const startPos = remaining.indexOf(separatorStart, startIndex);
      if (startPos === -1) {
        // 残りの部分を追加
        if (startIndex < remaining.length) {
          parts.push(remaining.substring(startIndex));
        }
        break;
      }

      // セパレータ前の部分を追加
      parts.push(remaining.substring(startIndex, startPos + separatorStart.length));

      const endPos = remaining.indexOf(separatorEnd, startPos + separatorStart.length);
      if (endPos === -1) {
        // 終了セパレータが見つからない場合は残りをそのまま追加
        parts.push(remaining.substring(startPos + separatorStart.length));
        break;
      }

      // ユーザー入力部分をサニタイズ
      const userInput = remaining.substring(startPos + separatorStart.length, endPos);
      const sanitizedInput = PromptSanitizer.sanitize(userInput.trim(), 'user_input');
      parts.push(`\n${sanitizedInput}\n`);

      // 終了セパレータを追加
      parts.push(separatorEnd);

      startIndex = endPos + separatorEnd.length;
    }

    return parts.join('');
  }
}
