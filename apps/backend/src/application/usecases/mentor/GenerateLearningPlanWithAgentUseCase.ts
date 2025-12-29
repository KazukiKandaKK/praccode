import type { IExerciseRepository } from '@/domain/ports/IExerciseRepository';
import type { ILearningPlanRepository } from '@/domain/ports/ILearningPlanRepository';
import type { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import type { IUserAccountRepository } from '@/domain/ports/IUserAccountRepository';
import type { LearningPlan, PresetAnswer } from '@/mastra/mentorAgent';
import { MentorAgent } from '@/mastra/mentorAgent';
import { buildProgressSnapshot } from './buildProgressSnapshot.js';

type Params = {
  userId: string;
  presetAnswers: PresetAnswer[];
  targetLanguage?: string;
};

export class GenerateLearningPlanWithAgentUseCase {
  constructor(
    private readonly userAccountRepository: IUserAccountRepository,
    private readonly submissionRepository: ISubmissionRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly learningPlanRepository: ILearningPlanRepository,
    private readonly mentorAgent: MentorAgent
  ) {}

  async execute(params: Params): Promise<LearningPlan> {
    const profile = await this.userAccountRepository.getProfile(params.userId);
    if (!profile) {
      throw new Error('User not found');
    }

    const progress = await buildProgressSnapshot(
      this.submissionRepository,
      this.exerciseRepository,
      params.userId
    );

    const plan = await this.mentorAgent.generateLearningPlan({
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
      },
      progress,
      presetAnswers: params.presetAnswers,
      targetLanguage: params.targetLanguage,
      threadId: `plan-${params.userId}`,
    });

    await this.learningPlanRepository.savePlan({
      userId: params.userId,
      plan,
      presetAnswers: params.presetAnswers,
      targetLanguage: params.targetLanguage,
      modelId: this.mentorAgent.getModelId(),
      temperature: 0.2,
    });

    return plan;
  }
}
