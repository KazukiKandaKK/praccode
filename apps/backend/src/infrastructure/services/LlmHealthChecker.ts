import { ILlmHealthChecker } from '../../domain/ports/ILlmHealthChecker';
import { checkOllamaHealth } from '../../llm/llm-client';

export class LlmHealthChecker implements ILlmHealthChecker {
  async isHealthy(): Promise<boolean> {
    return checkOllamaHealth();
  }
}
