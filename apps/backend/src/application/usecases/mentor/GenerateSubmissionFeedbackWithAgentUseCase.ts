import type { IExerciseRepository } from '@/domain/ports/IExerciseRepository';
import type { IMentorFeedbackRepository } from '@/domain/ports/IMentorFeedbackRepository';
import type { IMentorFeedbackInsightRepository } from '@/domain/ports/IMentorFeedbackInsightRepository';
import type { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import type { MentorFeedback } from '@/mastra/mentorAgent';
import { MentorAgent } from '@/mastra/mentorAgent';
import { buildProgressSnapshot } from './buildProgressSnapshot.js';

type Params = {
  submissionId: string;
  userId: string;
};

export class GenerateSubmissionFeedbackWithAgentUseCase {
  constructor(
    private readonly submissionRepository: ISubmissionRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly mentorFeedbackRepository: IMentorFeedbackRepository,
    private readonly mentorFeedbackInsightRepository: IMentorFeedbackInsightRepository,
    private readonly mentorAgent: MentorAgent
  ) {}

  async execute(params: Params): Promise<MentorFeedback> {
    const submission = await this.submissionRepository.findById(params.submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }
    if (submission.userId !== params.userId) {
      throw new Error('Unauthorized');
    }

    const progress = await buildProgressSnapshot(
      this.submissionRepository,
      this.exerciseRepository,
      params.userId
    );

    const feedback = await this.mentorAgent.generateSubmissionFeedback({
      submission,
      progress,
      threadId: `feedback-${params.submissionId}`,
    });

    const saved = await this.mentorFeedbackRepository.saveFeedback({
      userId: params.userId,
      submissionId: params.submissionId,
      feedback,
      modelId: this.mentorAgent.getModelId(),
      temperature: 0.1,
    });

    await this.mentorFeedbackInsightRepository.saveInsights({
      userId: params.userId,
      mentorFeedbackId: saved.id,
      strengths: feedback.strengths,
      improvements: feedback.improvements,
    });

    return feedback;
  }
}
