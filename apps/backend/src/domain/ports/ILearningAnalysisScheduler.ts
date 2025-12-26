export interface ILearningAnalysisScheduler {
  trigger(userId: string): Promise<void>;
}
