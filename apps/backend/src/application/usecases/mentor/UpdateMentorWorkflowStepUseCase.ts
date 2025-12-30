import type {
  IMentorWorkflowRepository,
  MentorWorkflowStep,
} from '@/domain/ports/IMentorWorkflowRepository';

type Params = {
  userId: string;
  step: MentorWorkflowStep;
};

export class UpdateMentorWorkflowStepUseCase {
  constructor(private readonly mentorWorkflowRepository: IMentorWorkflowRepository) {}

  async execute(params: Params) {
    if (!params.userId) {
      throw new Error('userId is required');
    }
    return this.mentorWorkflowRepository.upsertStep(params.userId, params.step);
  }
}
