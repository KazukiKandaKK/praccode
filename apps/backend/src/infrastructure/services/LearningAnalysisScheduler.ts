import { ILearningAnalysisScheduler } from '../../domain/ports/ILearningAnalysisScheduler';
import { triggerLearningAnalysis } from './LearningAnalysisTrigger';

export class LearningAnalysisScheduler implements ILearningAnalysisScheduler {
  async trigger(userId: string): Promise<void> {
    await triggerLearningAnalysis(userId);
  }
}
