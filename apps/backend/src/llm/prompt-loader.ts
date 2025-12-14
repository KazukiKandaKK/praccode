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
 */
export function renderPrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }
  return result;
}

