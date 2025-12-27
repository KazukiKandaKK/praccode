import { ILearningAnalyzer, LearningAnalysisResult, ReadingAnalysisItem, WritingAnalysisItem } from '../../domain/ports/ILearningAnalyzer';
import { analyzeLearningProgress } from '../../llm/learning-analyzer';

export class LlmLearningAnalyzer implements ILearningAnalyzer {
  async analyze(
    reading: ReadingAnalysisItem[],
    writing: WritingAnalysisItem[]
  ): Promise<LearningAnalysisResult> {
    return analyzeLearningProgress(
      reading.map((item) => ({ ...item, feedback: item.feedback ?? null })),
      writing.map((item) => ({ ...item, feedback: item.feedback ?? null }))
    );
  }
}
