import type { IExerciseRepository } from '@/domain/ports/IExerciseRepository';
import type { IMentorFeedbackRepository } from '@/domain/ports/IMentorFeedbackRepository';
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

    await this.mentorFeedbackRepository.saveFeedback({
      userId: params.userId,
      submissionId: params.submissionId,
      feedback,
      modelId: this.mentorAgent.getModelId(),
      temperature: 0.1,
    });

    return feedback;
  }
}
