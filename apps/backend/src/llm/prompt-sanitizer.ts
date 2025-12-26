/**
 * プロンプトサニタイザー - プロンプトインジェクション対策
 */

import { PromptInjectionError } from './prompt-injection-error.js';

// 最大入力長（デフォルト: 100,000文字）
const MAX_INPUT_LENGTH = parseInt(process.env.LLM_MAX_INPUT_LENGTH || '100000', 10);

// base64検出の最小長（これより短い場合は検出しない）
const BASE64_MIN_LENGTH = 20;

/**
 * インジェクション検出パターン（大文字小文字を区別しない）
 */
const INJECTION_PATTERNS = [
  // 英語パターン
  /\bignore\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\bforget\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\bdisregard\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\boverride\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\buser\s*:/i,
  /\b(you|your)\s+(are|is|must|should|will)\s+(now|a|an)\s+/i,
  /\b(new|different)\s+(instructions?|prompts?|rules?|system)\b/i,
  // 日本語パターン
  /前の指示を無視/i,
  /以前の指示を無視/i,
  /システム\s*:/i,
  /アシスタント\s*:/i,
  /ユーザー\s*:/i,
  /指示を無視/i,
  /プロンプトを無視/i,
  /ルールを無視/i,
];

/**
 * プロンプトサニタイザー
 */
export class PromptSanitizer {
  /**
   * 入力文字列をサニタイズ
   * @param input 入力文字列
   * @param fieldName フィールド名（エラーメッセージ用）
   * @param options オプション
   * @returns サニタイズ済み文字列
   * @throws PromptInjectionError インジェクションが検出された場合
   */
  static sanitize(
    input: string,
    fieldName: string = 'input',
    options: {
      maxLength?: number;
      allowBase64?: boolean; // コード部分など、base64検出を緩和する場合
    } = {}
  ): string {
    // 入力長の検証
    const maxLength = options.maxLength ?? MAX_INPUT_LENGTH;
    this.validateLength(input, maxLength, fieldName);

    // base64検出
    if (!options.allowBase64 && this.detectBase64(input)) {
      throw new PromptInjectionError(
        `Invalid input detected in ${fieldName}`,
        ['base64 encoding detected'],
        fieldName
      );
    }

    // インジェクション検出
    const detectedPatterns = this.detectInjectionAttempts(input);
    if (detectedPatterns.length > 0) {
      throw new PromptInjectionError(
        `Invalid input detected in ${fieldName}`,
        detectedPatterns,
        fieldName
      );
    }

    // 制御文字の検証
    this.validateControlCharacters(input, fieldName);

    return input;
  }

  /**
   * base64エンコードされた文字列を検出
   */
  static detectBase64(input: string): boolean {
    // 短すぎる場合は検出しない
    if (input.length < BASE64_MIN_LENGTH) {
      return false;
    }

    // base64文字列の特徴をチェック
    // - 英数字と+/=のみで構成
    // - 長さが4の倍数（パディングを除く）
    // - 末尾に=または==が付く可能性

    const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

    // 連続するbase64文字列を検出（空白や改行で区切られた部分も含む）
    const parts = input.split(/\s+/);

    for (const part of parts) {
      // パディングを除いた長さをチェック
      const withoutPadding = part.replace(/=+$/, '');

      // 一定の長さ以上で、base64パターンに一致する場合
      if (withoutPadding.length >= BASE64_MIN_LENGTH && base64Pattern.test(part)) {
        // 実際にbase64としてデコード可能か確認
        try {
          const decoded = Buffer.from(part, 'base64').toString('utf-8');
          // デコード結果が可読テキストでない場合（バイナリデータなど）はbase64と判断
          if (decoded.length > 0 && !/^[\x20-\x7E\s]*$/.test(decoded)) {
            return true;
          }
        } catch {
          // デコードに失敗した場合はbase64ではない
        }
      }
    }

    return false;
  }

  /**
   * インジェクション試行を検出
   * @returns 検出されたパターンのリスト
   */
  static detectInjectionAttempts(input: string): string[] {
    const detected: string[] = [];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        const match = input.match(pattern);
        if (match) {
          detected.push(`Pattern detected: ${match[0].substring(0, 50)}`);
        }
      }
    }

    return detected;
  }

  /**
   * 入力長を検証
   */
  static validateLength(input: string, maxLength: number, fieldName: string): void {
    if (input.length > maxLength) {
      throw new PromptInjectionError(
        `Input too long in ${fieldName} (max: ${maxLength} characters)`,
        [`Length: ${input.length} characters`],
        fieldName
      );
    }
  }

  /**
   * 制御文字を検証
   */
  static validateControlCharacters(input: string, fieldName: string): void {
    // 許可されない制御文字を検出（改行、タブ、復帰は許可）
    // eslint-disable-next-line no-control-regex
    const invalidControlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;

    if (invalidControlChars.test(input)) {
      throw new PromptInjectionError(
        `Invalid control characters detected in ${fieldName}`,
        ['Control characters detected'],
        fieldName
      );
    }
  }

  /**
   * 複数のフィールドを一括でサニタイズ
   */
  static sanitizeMultiple(
    inputs: Record<string, string>,
    options: {
      maxLength?: number;
      allowBase64?: boolean;
    } = {}
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [fieldName, value] of Object.entries(inputs)) {
      sanitized[fieldName] = this.sanitize(value, fieldName, options);
    }

    return sanitized;
  }
}
