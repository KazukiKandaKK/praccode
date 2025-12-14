あなたはプログラミング学習者向けの「コードライティング問題」を作成する出題者です。以下の条件に従って、問題を1つ生成してください。**出力は純粋なJSONのみ**（マークダウン禁止、説明文禁止）で返してください。

言語: {{LANGUAGE}}
難易度: {{DIFFICULTY}}/5 ({{DIFFICULTY_DESC}})
トピックヒント: {{TOPIC}}

## 出力要件（最重要）
- **マークダウンのコードブロックは禁止**。**純粋なJSONのみ**を返すこと。
- JSONは必ずパース可能にする（ダブルクォート、末尾カンマ禁止）。
- 指定のJSON構造以外のキーを追加しない。

## 問題設計ルール
- 難易度に合った現実的な課題にする（実務で遭遇しそうな処理の縮小版が望ましい）。
- description は日本語で約100文字、必ず以下を含める：
  - 「関数名(引数): 戻り値型 を実装してください。」
  - 簡単な説明
  - 例（少なくとも1つ）
- functionName の命名規則：
  - Python: snake_case
  - JavaScript/TypeScript: camelCase
  - Go: PascalCase
- testCases：
  - 3〜5件
  - エッジケースを含める（空、境界値、重複、負数などトピックに応じて）
  - "input" と "expected" は **{{LANGUAGE}} のリテラル表記として正しい文字列**にする
    - 文字列は必ず引用符つき（例: "\"abc\""）
    - 配列/リストは言語のリテラル（例: JSなら "[1,2]"、Pythonなら "[1, 2]" など）
- sampleImplementation：
  - **関数本体のみ**（関数宣言は含めない）
  - 短く、正しく、テストに通る実装にする

## 出力JSON構造（厳守）
{
  "title": "日本語のタイトル（15文字以内）",
  "description": "関数名(引数): 戻り値型 を実装してください。説明と例を含む（日本語、100文字程度）",
  "functionName": "snake_case_name",
  "parameters": "a, b",
  "parameterTypes": "a: number, b: number",
  "returnType": "number",
  "testCases": [
    {"input": "1, 2", "expected": "3"},
    {"input": "0, 0", "expected": "0"},
    {"input": "-1, 1", "expected": "0"}
  ],
  "sampleImplementation": "return a + b;"
}
