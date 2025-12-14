/**
 * プロンプトファイルを読み込むユーティリティ
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * プロンプトファイルを読み込む
 */
export function loadPrompt(filename: string): string {
  const promptPath = join(__dirname, 'prompts', filename);
  return readFileSync(promptPath, 'utf-8');
}

/**
 * プロンプトテンプレートに変数を埋め込む
 * ユーザー入力部分を明確にセパレータで囲む
 */
export function renderPrompt(template: string, variables: Record<string, string>): string {
  let result = template;

  // ユーザー入力として扱うフィールド（セパレータで囲む）
  const userInputFields = [
    'USER_ANSWER',
    'USER_CODE',
    'CODE',
    'QUESTION',
    'CHALLENGE_TITLE',
    'CHALLENGE_DESCRIPTION',
    'TEST_OUTPUT',
    'TOPIC',
  ];

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

    if (userInputFields.includes(key)) {
      // ユーザー入力はセパレータで囲む
      const wrappedValue = `---USER_INPUT_START---\n${value}\n---USER_INPUT_END---`;
      result = result.replace(regex, wrappedValue);
    } else {
      // その他の変数はそのまま埋め込む
      result = result.replace(regex, value);
    }
  }

  return result;
}
