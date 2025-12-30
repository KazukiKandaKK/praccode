import { ICodeExecutor, CodeExecutionInput, CodeExecutionResult } from '../../domain/ports/ICodeExecutor';
import { executeCode } from '../runner/executor';

export class CodeExecutorService implements ICodeExecutor {
  async execute(input: CodeExecutionInput): Promise<CodeExecutionResult> {
    const result = await executeCode(input.userCode, input.testCode, input.language);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      passed: result.exitCode === 0,
    };
  }
}
