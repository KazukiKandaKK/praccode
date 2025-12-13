/**
 * 既存のWritingChallengeのテストコードを新形式に変換
 * assert文 → 期待値vs実際値を表示する形式
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Python用の変換
function convertPythonTest(testCode: string): string {
  // すでに新形式なら変換しない
  if (testCode.includes('def test(name') || testCode.includes('テストヘルパー')) {
    return testCode;
  }

  // assert文のパターンを検出
  const lines = testCode.split('\n');
  const imports: string[] = [];
  const assertions: Array<{ line: string; func: string; args: string; expected: string }> = [];

  for (const line of lines) {
    if (line.trim().startsWith('from ') || line.trim().startsWith('import ')) {
      imports.push(line);
    }
    
    // assert func(...) == expected のパターン
    const match = line.match(/assert\s+(\w+)\((.*?)\)\s*==\s*(.+)/);
    if (match) {
      const [, func, args, expected] = match;
      assertions.push({ line, func, args: args.trim(), expected: expected.trim() });
    }
  }

  if (assertions.length === 0) {
    return testCode; // 変換できない場合はそのまま
  }

  // 新形式のテストコードを生成
  const funcName = assertions[0].func;
  let newCode = imports.join('\n') + '\n\n';
  
  newCode += `# テストヘルパー
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
`;

  for (const assertion of assertions) {
    const testName = `${assertion.func}(${assertion.args})`;
    newCode += `test("${testName}", ${assertion.func}(${assertion.args}), ${assertion.expected})\n`;
  }

  newCode += `
# 結果サマリ
print()
print(f"{passed}/{passed + failed} tests passed")
if failed > 0:
    exit(1)`;

  return newCode;
}

// JavaScript用の変換
function convertJavaScriptTest(testCode: string): string {
  // すでに新形式なら変換しない
  if (testCode.includes('function test(name') || testCode.includes('テストヘルパー')) {
    return testCode;
  }

  const lines = testCode.split('\n');
  const requires: string[] = [];
  const assertions: Array<{ func: string; args: string; expected: string }> = [];

  for (const line of lines) {
    if (line.trim().startsWith('const ') && line.includes('require')) {
      requires.push(line);
    }
    
    // assert.strictEqual(func(...), expected) または assert.deepStrictEqual
    const match = line.match(/assert\.(?:strict|deepStrict)Equal\((\w+)\((.*?)\),\s*(.+?)\);?/);
    if (match) {
      const [, func, args, expected] = match;
      assertions.push({ func, args: args.trim(), expected: expected.trim() });
    }
  }

  if (assertions.length === 0) {
    return testCode;
  }

  let newCode = requires.join('\n') + '\n\n';
  
  newCode += `// テストヘルパー
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
`;

  for (const assertion of assertions) {
    const testName = `${assertion.func}(${assertion.args})`;
    newCode += `test('${testName}', ${assertion.func}(${assertion.args}), ${assertion.expected});\n`;
  }

  newCode += `
// 結果サマリ
console.log('');
console.log(passed + '/' + (passed + failed) + ' tests passed');
if (failed > 0) process.exit(1);`;

  return newCode;
}

// TypeScript用の変換
function convertTypeScriptTest(testCode: string): string {
  // すでに新形式なら変換しない
  if (testCode.includes('function test(name') || testCode.includes('テストヘルパー')) {
    return testCode;
  }

  const lines = testCode.split('\n');
  const imports: string[] = [];
  const assertions: Array<{ func: string; args: string; expected: string }> = [];

  for (const line of lines) {
    if (line.trim().startsWith('import ')) {
      imports.push(line);
    }
    
    const match = line.match(/assert\.strictEqual\((\w+)\((.*?)\),\s*(.+?)\);?/);
    if (match) {
      const [, func, args, expected] = match;
      assertions.push({ func, args: args.trim(), expected: expected.trim() });
    }
  }

  if (assertions.length === 0) {
    return testCode;
  }

  // import assert from 'assert' を除去
  const filteredImports = imports.filter(imp => !imp.includes("from 'assert'"));
  let newCode = filteredImports.join('\n') + '\n\n';
  
  newCode += `// テストヘルパー
let passed = 0, failed = 0;
function test(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
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
`;

  for (const assertion of assertions) {
    const testName = `${assertion.func}(${assertion.args})`;
    newCode += `test('${testName}', ${assertion.func}(${assertion.args}), ${assertion.expected});\n`;
  }

  newCode += `
// 結果サマリ
console.log('');
console.log(passed + '/' + (passed + failed) + ' tests passed');
if (failed > 0) process.exit(1);`;

  return newCode;
}

async function main() {
  console.log('Starting test format migration...\n');

  const challenges = await prisma.writingChallenge.findMany({
    where: {
      status: 'READY',
    },
  });

  let converted = 0;
  let skipped = 0;

  for (const challenge of challenges) {
    let newTestCode = challenge.testCode;

    if (challenge.language === 'python') {
      newTestCode = convertPythonTest(challenge.testCode);
    } else if (challenge.language === 'javascript') {
      newTestCode = convertJavaScriptTest(challenge.testCode);
    } else if (challenge.language === 'typescript') {
      newTestCode = convertTypeScriptTest(challenge.testCode);
    } else if (challenge.language === 'go') {
      // Goは既に良い形式なのでスキップ
      skipped++;
      continue;
    }

    if (newTestCode !== challenge.testCode) {
      await prisma.writingChallenge.update({
        where: { id: challenge.id },
        data: { testCode: newTestCode },
      });
      console.log(`✓ Converted: ${challenge.title} (${challenge.language})`);
      converted++;
    } else {
      console.log(`- Skipped: ${challenge.title} (${challenge.language}) - already in new format`);
      skipped++;
    }
  }

  console.log(`\n✓ Migration complete!`);
  console.log(`  Converted: ${converted}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total: ${challenges.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

