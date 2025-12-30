import type { IExerciseRepository } from '@/domain/ports/IExerciseRepository';
import type { ILearningPlanRepository } from '@/domain/ports/ILearningPlanRepository';
import type { IMentorFeedbackRepository } from '@/domain/ports/IMentorFeedbackRepository';
import type { IMentorSprintRepository } from '@/domain/ports/IMentorSprintRepository';
import type { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import type { IUserAccountRepository } from '@/domain/ports/IUserAccountRepository';
import type { LearningPlan } from '@/mastra/mentorAgent';
import { MentorAgent } from '@/mastra/mentorAgent';
import { buildProgressSnapshot } from './buildProgressSnapshot.js';

type Params = {
  userId: string;
};

export class GenerateNextLearningPlanWithAgentUseCase {
  constructor(
    private readonly userAccountRepository: IUserAccountRepository,
    private readonly submissionRepository: ISubmissionRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly learningPlanRepository: ILearningPlanRepository,
    private readonly mentorFeedbackRepository: IMentorFeedbackRepository,
    private readonly mentorSprintRepository: IMentorSprintRepository,
    private readonly mentorAgent: MentorAgent
  ) {}

  async execute(params: Params): Promise<LearningPlan> {
    const profile = await this.userAccountRepository.getProfile(params.userId);
    if (!profile) {
      throw new Error('User not found');
    }

    const [latestPlan, feedbackList] = await Promise.all([
      this.learningPlanRepository.getLatestByUser(params.userId),
      this.mentorFeedbackRepository.listByUser(params.userId, 1),
    ]);

    if (!latestPlan) {
      throw new Error('Learning plan not found');
    }

    const latestFeedback = feedbackList[0];
    if (!latestFeedback) {
      throw new Error('Mentor feedback not found');
    }

    const progress = await buildProgressSnapshot(
      this.submissionRepository,
      this.exerciseRepository,
      params.userId
    );

    const plan = await this.mentorAgent.generateNextLearningPlan({
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
      },
      progress,
      presetAnswers: latestPlan.presetAnswers,
      targetLanguage: latestPlan.targetLanguage ?? undefined,
      previousPlan: latestPlan.plan,
      latestFeedback: latestFeedback.feedback,
      threadId: `plan-next-${params.userId}`,
    });

    const saved = await this.learningPlanRepository.savePlan({
      userId: params.userId,
      plan,
      presetAnswers: latestPlan.presetAnswers,
      targetLanguage: latestPlan.targetLanguage ?? undefined,
      modelId: this.mentorAgent.getModelId(),
      temperature: 0.2,
    });

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.mentorSprintRepository.startSprint({
      userId: params.userId,
      learningPlanId: saved.id,
      goal: plan.summary,
      focusAreas: plan.focusAreas,
      startDate,
      endDate,
    });

    return plan;
  }
}
