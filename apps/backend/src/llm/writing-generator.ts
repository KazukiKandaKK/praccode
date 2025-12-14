/**
 * LLMを使ったライティングお題生成ロジック
 * テンプレートベース: LLMはテストケースデータのみ生成し、コードはテンプレートから組み立てる
 */

import { z } from 'zod';
import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';

// テストケースのスキーマ
const testCaseSchema = z.object({
  input: z.string(), // 関数呼び出しの引数部分 例: "1, 2" or "'hello'"
  expected: z.string(), // 期待される戻り値 例: "3" or "'olleh'"
});

// LLMが生成するデータのスキーマ
const llmOutputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  functionName: z.string().min(1),
  parameters: z.string(), // 例: "a, b" or "text"
  parameterTypes: z.string().optional(), // TypeScript用 例: "a: number, b: number"
  returnType: z.string().optional(), // 例: "number" or "string"
  testCases: z.array(testCaseSchema).min(2),
  sampleImplementation: z.string(), // 関数本体のみ
});

type LLMOutput = z.infer<typeof llmOutputSchema>;

// 生成されるWritingChallengeの型定義
export const generatedWritingChallengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  testCode: z.string().min(1),
  starterCode: z.string().min(1),
  sampleCode: z.string().optional(),
});

export type GeneratedWritingChallenge = z.infer<typeof generatedWritingChallengeSchema>;

export interface GenerateWritingChallengeInput {
  language: 'javascript' | 'typescript' | 'python' | 'go';
  difficulty: number;
  topic?: string;
}

// ========== テンプレート ==========

function buildJavaScriptTestCode(funcName: string, testCases: LLMOutput['testCases']): string {
  const tests = testCases
    .map((tc) => `test('${funcName}(${tc.input})', ${funcName}(${tc.input}), ${tc.expected});`)
    .join('\n');

  return `const { ${funcName} } = require('./solution');

// テストヘルパー
let passed = 0, failed = 0;
function test(name, actual, expected) {
  const eq = JSON.stringify(actual) === JSON.stringify(expected);
  if (eq) {
    console.log('✓ ' + name + ': PASSED');
    passed++;
  } else {
    console.log('✗ ' + name + ': FAILED');
    console.log('  期待値:', JSON.stringify(expected));
    console.log('  実際値:', JSON.stringify(actual));
    failed++;
  }
}

// テストケース
${tests}

// 結果サマリ
console.log('');
console.log(passed + '/' + (passed + failed) + ' tests passed');
if (failed > 0) process.exit(1);`;
}

function buildJavaScriptStarterCode(funcName: string, params: string): string {
  return `// 関数を実装してください
function ${funcName}(${params}) {
  // ここに実装を書いてください
  
}

module.exports = { ${funcName} };`;
}

function buildJavaScriptSampleCode(funcName: string, params: string, impl: string): string {
  return `function ${funcName}(${params}) {
${impl
  .split('\n')
  .map((line) => '  ' + line)
  .join('\n')}
}

module.exports = { ${funcName} };`;
}

function buildTypeScriptTestCode(funcName: string, testCases: LLMOutput['testCases']): string {
  const tests = testCases
    .map((tc) => `test('${funcName}(${tc.input})', ${funcName}(${tc.input}), ${tc.expected});`)
    .join('\n');

  return `import { ${funcName} } from './solution';

// テストヘルパー
let passed = 0, failed = 0;
function test(name: string, actual: unknown, expected: unknown) {
  const eq = JSON.stringify(actual) === JSON.stringify(expected);
  if (eq) {
    console.log('✓ ' + name + ': PASSED');
    passed++;
  } else {
    console.log('✗ ' + name + ': FAILED');
    console.log('  期待値:', JSON.stringify(expected));
    console.log('  実際値:', JSON.stringify(actual));
    failed++;
  }
}

// テストケース
${tests}

// 結果サマリ
console.log('');
console.log(passed + '/' + (passed + failed) + ' tests passed');
if (failed > 0) process.exit(1);`;
}

function buildTypeScriptStarterCode(
  funcName: string,
  paramTypes: string,
  returnType: string
): string {
  return `// 関数を実装してください
export function ${funcName}(${paramTypes}): ${returnType} {
  // ここに実装を書いてください
  
}`;
}

function buildTypeScriptSampleCode(
  funcName: string,
  paramTypes: string,
  returnType: string,
  impl: string
): string {
  return `export function ${funcName}(${paramTypes}): ${returnType} {
${impl
  .split('\n')
  .map((line) => '  ' + line)
  .join('\n')}
}`;
}

function buildPythonTestCode(funcName: string, testCases: LLMOutput['testCases']): string {
  const tests = testCases
    .map((tc) => `test("${funcName}(${tc.input})", ${funcName}(${tc.input}), ${tc.expected})`)
    .join('\n');

  return `from solution import ${funcName}

# テストヘルパー
passed, failed = 0, 0
def test(name, actual, expected):
    global passed, failed
    if actual == expected:
        print(f"✓ {name}: PASSED")
        passed += 1
    else:
        print(f"✗ {name}: FAILED")
        print(f"  期待値: {repr(expected)}")
        print(f"  実際値: {repr(actual)}")
        failed += 1

# テストケース
${tests}

# 結果サマリ
print()
print(f"{passed}/{passed + failed} tests passed")
if failed > 0:
    exit(1)`;
}

function buildPythonStarterCode(funcName: string, params: string): string {
  return `# 関数を実装してください
def ${funcName}(${params}):
    # ここに実装を書いてください
    pass`;
}

function buildPythonSampleCode(funcName: string, params: string, impl: string): string {
  return `def ${funcName}(${params}):
${impl
  .split('\n')
  .map((line) => '    ' + line)
  .join('\n')}`;
}

function buildGoTestCode(funcName: string, testCases: LLMOutput['testCases']): string {
  const testStructs = testCases
    .map(
      (tc) => `\t\t{"${funcName}(${tc.input.replace(/"/g, '\\"')})", ${tc.input}, ${tc.expected}},`
    )
    .join('\n');

  return `package solution

import (
\t"fmt"
\t"testing"
)

func Test${funcName}(t *testing.T) {
\ttests := []struct {
\t\tname string
\t\tinput interface{}
\t\twant interface{}
\t}{
${testStructs}
\t}
\tpassed := 0
\tfor _, tt := range tests {
\t\tgot := ${funcName}(tt.input)
\t\tif got == tt.want {
\t\t\tfmt.Printf("✓ %s: PASSED\\n", tt.name)
\t\t\tpassed++
\t\t} else {
\t\t\tfmt.Printf("✗ %s: FAILED\\n", tt.name)
\t\t\tfmt.Printf("  期待値: %v\\n", tt.want)
\t\t\tfmt.Printf("  実際値: %v\\n", got)
\t\t\tt.Fail()
\t\t}
\t}
\tfmt.Printf("\\n%d/%d tests passed\\n", passed, len(tests))
}`;
}

function buildGoStarterCode(funcName: string, paramTypes: string, returnType: string): string {
  return `package solution

// 関数を実装してください
func ${funcName}(${paramTypes}) ${returnType} {
\t// ここに実装を書いてください
\treturn ${returnType === 'int' ? '0' : returnType === 'string' ? '""' : returnType === 'bool' ? 'false' : 'nil'}
}`;
}

function buildGoSampleCode(
  funcName: string,
  paramTypes: string,
  returnType: string,
  impl: string
): string {
  return `package solution

func ${funcName}(${paramTypes}) ${returnType} {
${impl
  .split('\n')
  .map((line) => '\t' + line)
  .join('\n')}
}`;
}

// ========== コード生成 ==========

function buildChallengeCode(
  language: string,
  llmOutput: LLMOutput
): {
  testCode: string;
  starterCode: string;
  sampleCode: string;
} {
  const { functionName, parameters, parameterTypes, returnType, testCases, sampleImplementation } =
    llmOutput;

  switch (language) {
    case 'javascript':
      return {
        testCode: buildJavaScriptTestCode(functionName, testCases),
        starterCode: buildJavaScriptStarterCode(functionName, parameters),
        sampleCode: buildJavaScriptSampleCode(functionName, parameters, sampleImplementation),
      };
    case 'typescript':
      return {
        testCode: buildTypeScriptTestCode(functionName, testCases),
        starterCode: buildTypeScriptStarterCode(
          functionName,
          parameterTypes || parameters,
          returnType || 'unknown'
        ),
        sampleCode: buildTypeScriptSampleCode(
          functionName,
          parameterTypes || parameters,
          returnType || 'unknown',
          sampleImplementation
        ),
      };
    case 'python':
      return {
        testCode: buildPythonTestCode(functionName, testCases),
        starterCode: buildPythonStarterCode(functionName, parameters),
        sampleCode: buildPythonSampleCode(functionName, parameters, sampleImplementation),
      };
    case 'go':
      return {
        testCode: buildGoTestCode(functionName, testCases),
        starterCode: buildGoStarterCode(
          functionName,
          parameterTypes || 'input interface{}',
          returnType || 'interface{}'
        ),
        sampleCode: buildGoSampleCode(
          functionName,
          parameterTypes || 'input interface{}',
          returnType || 'interface{}',
          sampleImplementation
        ),
      };
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

// ========== プロンプト ==========

const difficultyDescriptions: Record<number, string> = {
  1: '入門: 基本的な演算、条件分岐、ループ',
  2: '初級: 配列操作、文字列処理',
  3: '中級: アルゴリズム、再帰',
  4: '上級: 複雑なデータ構造',
  5: 'エキスパート: 高度なアルゴリズム',
};

const topicExamples = [
  '配列の操作（フィルタ、マップ、集計）',
  '文字列処理（反転、検索、変換）',
  '数学的計算（素数、階乗、フィボナッチ）',
  'データ変換（オブジェクト操作）',
];

function buildPrompt(input: GenerateWritingChallengeInput): string {
  const diffDesc = difficultyDescriptions[input.difficulty] || '中級';
  const topic = input.topic || topicExamples[Math.floor(Math.random() * topicExamples.length)];

  const template = loadPrompt('writing-generator-prompt.md');
  
  return renderPrompt(template, {
    LANGUAGE: input.language,
    DIFFICULTY: input.difficulty.toString(),
    DIFFICULTY_DESC: diffDesc,
    TOPIC: topic,
  });
}

// ========== メイン関数 ==========

export async function generateWritingChallenge(
  input: GenerateWritingChallengeInput
): Promise<GeneratedWritingChallenge> {
  const prompt = buildPrompt(input);

  const response = await generateWithOllama(prompt, {
    temperature: 0.7,
    maxTokens: 2048,
    jsonMode: true,
  });

  // JSONをパース
  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch {
    // マークダウンブロックを除去して再試行
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // 部分的なJSONを試す
      const objMatch = response.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = JSON.parse(objMatch[0]);
      } else {
        throw new Error(`Failed to parse LLM response: ${response.substring(0, 300)}`);
      }
    }
  }

  // バリデーション
  const llmOutput = llmOutputSchema.parse(parsed);

  // テンプレートからコードを生成
  const { testCode, starterCode, sampleCode } = buildChallengeCode(input.language, llmOutput);

  return {
    title: llmOutput.title,
    description: llmOutput.description,
    difficulty: input.difficulty,
    testCode,
    starterCode,
    sampleCode,
  };
}
