/**
 * LLMプロバイダーの抽象化インターフェース
 */

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface LLMProvider {
  /**
   * テキスト生成リクエストを送信
   */
  generate(prompt: string, options?: LLMGenerateOptions): Promise<string>;

  /**
   * テキスト生成ストリームを取得（対応プロバイダーのみ）
   */
  generateStream?: (
    prompt: string,
    options?: LLMGenerateOptions
  ) => AsyncIterable<string>;

  /**
   * プロバイダーの接続状態を確認
   */
  checkHealth(): Promise<boolean>;
}
