export interface CodeExecutionInput {
  userCode: string;
  testCode: string;
  language: string;
}

export interface CodeExecutionResult {
  stdout: string | null;
  stderr: string | null;
  exitCode: number;
  passed: boolean;
}

export interface ICodeExecutor {
  execute(input: CodeExecutionInput): Promise<CodeExecutionResult>;
}
