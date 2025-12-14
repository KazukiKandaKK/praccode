/**
 * プロンプトインジェクション検出時のカスタムエラー
 */

export class PromptInjectionError extends Error {
  constructor(
    message: string,
    public readonly detectedPatterns: string[],
    public readonly fieldName?: string
  ) {
    super(message);
    this.name = 'PromptInjectionError';
  }
}

