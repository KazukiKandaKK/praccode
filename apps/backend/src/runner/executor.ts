import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const TIMEOUT_MS = 30000; // 30秒
const MAX_OUTPUT_SIZE = 1024 * 100; // 100KB

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// 言語ごとの設定
const LANGUAGE_CONFIG: Record<string, {
  image: string;
  extension: string;
  testExtension: string;
  command: (userFile: string, testFile: string) => string[];
}> = {
  javascript: {
    image: 'node:20-alpine',
    extension: '.js',
    testExtension: '.test.js',
    command: (userFile, testFile) => ['sh', '-c', `node ${testFile}`],
  },
  typescript: {
    image: 'node:20-alpine',
    extension: '.ts',
    testExtension: '.test.ts',
    command: (userFile, testFile) => ['sh', '-c', `npx tsx ${testFile}`],
  },
  python: {
    image: 'python:3.12-alpine',
    extension: '.py',
    testExtension: '_test.py',
    command: (userFile, testFile) => ['python', testFile],
  },
  go: {
    image: 'golang:1.22-alpine',
    extension: '.go',
    testExtension: '_test.go',
    command: (userFile, testFile) => ['go', 'test', '-v', '.'],
  },
};

export async function executeCode(
  userCode: string,
  testCode: string,
  language: string
): Promise<ExecutionResult> {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const workDir = join('/tmp', 'praccode-runner', randomUUID());

  try {
    await mkdir(workDir, { recursive: true });

    // ファイル作成
    const userFile = `solution${config.extension}`;
    const testFile = `solution${config.testExtension}`;

    await writeFile(join(workDir, userFile), userCode);
    await writeFile(join(workDir, testFile), testCode);

    // Go用のgo.mod
    if (language === 'go') {
      await writeFile(join(workDir, 'go.mod'), 'module solution\n\ngo 1.22\n');
    }

    // Docker実行
    const result = await runDocker(workDir, config.image, config.command(userFile, testFile));
    return result;
  } finally {
    // クリーンアップ
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runDocker(
  workDir: string,
  image: string,
  command: string[]
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const dockerArgs = [
      'run',
      '--rm',
      '--network', 'none',           // ネットワーク無効
      '--memory', '128m',            // メモリ制限
      '--cpus', '0.5',               // CPU制限
      '--pids-limit', '64',          // プロセス数制限
      '--read-only',                 // 読み取り専用
      '--tmpfs', '/tmp:size=64m',    // 一時ファイル用
      '-v', `${workDir}:/app:ro`,    // 作業ディレクトリをマウント（読み取り専用）
      '-w', '/app',
      image,
      ...command,
    ];

    const proc = spawn('docker', dockerArgs);

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, TIMEOUT_MS);

    proc.stdout.on('data', (data: Buffer) => {
      if (stdout.length < MAX_OUTPUT_SIZE) {
        stdout += data.toString();
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      if (stderr.length < MAX_OUTPUT_SIZE) {
        stderr += data.toString();
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);

      if (killed) {
        resolve({
          stdout: stdout.slice(0, MAX_OUTPUT_SIZE),
          stderr: 'Execution timed out (30s limit)',
          exitCode: 124,
        });
      } else {
        resolve({
          stdout: stdout.slice(0, MAX_OUTPUT_SIZE),
          stderr: stderr.slice(0, MAX_OUTPUT_SIZE),
          exitCode: code ?? 1,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        stdout: '',
        stderr: `Failed to start container: ${err.message}`,
        exitCode: 1,
      });
    });
  });
}

