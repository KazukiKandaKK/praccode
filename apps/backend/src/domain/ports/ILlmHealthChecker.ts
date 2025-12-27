export interface ILlmHealthChecker {
  isHealthy(): Promise<boolean>;
}
