import { ILlmHealthChecker } from '../../domain/ports/ILlmHealthChecker';
import { checkLLMHealth } from '../../llm/llm-client';

export class LlmHealthChecker implements ILlmHealthChecker {
  async isHealthy(): Promise<boolean> {
    return checkLLMHealth();
  }
}
