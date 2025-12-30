import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { GenerateLearningPlanWithAgentUseCase } from '@/application/usecases/mentor/GenerateLearningPlanWithAgentUseCase';
import { GenerateNextLearningPlanWithAgentUseCase } from '@/application/usecases/mentor/GenerateNextLearningPlanWithAgentUseCase';
import { GenerateSubmissionFeedbackWithAgentUseCase } from '@/application/usecases/mentor/GenerateSubmissionFeedbackWithAgentUseCase';
import { GetMentorAssessmentStatusUseCase } from '@/application/usecases/mentor/GetMentorAssessmentStatusUseCase';
import { GetCurrentMentorSprintUseCase } from '@/application/usecases/mentor/GetCurrentMentorSprintUseCase';
import { GetMentorMetadataSummaryUseCase } from '@/application/usecases/mentor/GetMentorMetadataSummaryUseCase';
import { GetMentorWorkflowStepUseCase } from '@/application/usecases/mentor/GetMentorWorkflowStepUseCase';
import { GetLatestLearningPlanUseCase } from '@/application/usecases/mentor/GetLatestLearningPlanUseCase';
import { ListLearningPlansUseCase } from '@/application/usecases/mentor/ListLearningPlansUseCase';
import { ListMentorFeedbackUseCase } from '@/application/usecases/mentor/ListMentorFeedbackUseCase';
import { UpdateMentorWorkflowStepUseCase } from '@/application/usecases/mentor/UpdateMentorWorkflowStepUseCase';
import { PromptSanitizer } from '@/infrastructure/llm/prompt-sanitizer';
import { PromptInjectionError } from '@/infrastructure/llm/prompt-injection-error';

const planSchema = z.object({
  userId: z.string().uuid(),
  presetAnswers: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .default([]),
  targetLanguage: z.string().optional(),
});

const feedbackSchema = z.object({
  userId: z.string().uuid(),
  submissionId: z.string().uuid(),
});

const nextPlanSchema = z.object({
  userId: z.string().uuid(),
});

const workflowUpdateSchema = z.object({
  userId: z.string().uuid(),
  step: z.enum(['PLAN', 'DO', 'CHECK', 'NEXT_PLAN']),
});

const workflowQuerySchema = z.object({
  userId: z.string().uuid(),
});

const summaryQuerySchema = z.object({
  userId: z.string().uuid(),
});

const sprintQuerySchema = z.object({
  userId: z.string().uuid(),
});

type MentorDeps = {
  generateLearningPlan: GenerateLearningPlanWithAgentUseCase;
  generateNextLearningPlan: GenerateNextLearningPlanWithAgentUseCase;
  generateSubmissionFeedback: GenerateSubmissionFeedbackWithAgentUseCase;
  getMentorAssessmentStatus: GetMentorAssessmentStatusUseCase;
  getCurrentMentorSprint: GetCurrentMentorSprintUseCase;
  getMentorMetadataSummary: GetMentorMetadataSummaryUseCase;
  getMentorWorkflowStep: GetMentorWorkflowStepUseCase;
  updateMentorWorkflowStep: UpdateMentorWorkflowStepUseCase;
  getLatestLearningPlan: GetLatestLearningPlanUseCase;
  listLearningPlans: ListLearningPlansUseCase;
  listMentorFeedback: ListMentorFeedbackUseCase;
};

export function mentorController(fastify: FastifyInstance, deps: MentorDeps) {
  fastify.post(
    '/mentor/learning-plan',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = planSchema.parse(request.body);
        body.presetAnswers.forEach((preset, index) => {
          PromptSanitizer.sanitize(preset.question, `presetAnswers[${index}].question`);
          PromptSanitizer.sanitize(preset.answer, `presetAnswers[${index}].answer`);
        });
        if (body.targetLanguage) {
          PromptSanitizer.sanitize(body.targetLanguage, 'targetLanguage');
        }
        const plan = await deps.generateLearningPlan.execute({
          userId: body.userId,
          presetAnswers: body.presetAnswers,
          targetLanguage: body.targetLanguage,
        });
        return reply.send(plan);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        if (error instanceof PromptInjectionError) {
          return reply.status(400).send({
            error: 'Invalid input',
            message: '入力に禁止表現が含まれています',
            field: error.fieldName,
            reasons: error.detectedPatterns,
          });
        }
        if (error instanceof Error && error.message === 'User not found') {
          return reply.status(404).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate learning plan' });
      }
    }
  );

  fastify.post(
    '/mentor/learning-plan/next',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = nextPlanSchema.parse(request.body);
        const plan = await deps.generateNextLearningPlan.execute({
          userId: body.userId,
        });
        return reply.send(plan);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        if (
          error instanceof Error &&
          ['User not found', 'Learning plan not found', 'Mentor feedback not found'].includes(
            error.message
          )
        ) {
          return reply.status(404).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate next learning plan' });
      }
    }
  );

  fastify.get(
    '/mentor/assessment',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = z.object({ userId: z.string().uuid() }).parse(request.query);
        const status = await deps.getMentorAssessmentStatus.execute(query.userId);
        return reply.send(status);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch mentor assessment' });
      }
    }
  );

  fastify.get(
    '/mentor/workflow',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = workflowQuerySchema.parse(request.query);
        const state = await deps.getMentorWorkflowStep.execute(query.userId);
        if (!state) {
          return reply.status(404).send({ error: 'No workflow state found' });
        }
        return reply.send({
          userId: state.userId,
          step: state.step,
          updatedAt: state.updatedAt,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch workflow state' });
      }
    }
  );

  fastify.post(
    '/mentor/workflow',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = workflowUpdateSchema.parse(request.body);
        const state = await deps.updateMentorWorkflowStep.execute({
          userId: body.userId,
          step: body.step,
        });
        return reply.send({
          userId: state.userId,
          step: state.step,
          updatedAt: state.updatedAt,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to update workflow state' });
      }
    }
  );

  fastify.get(
    '/mentor/learning-plan/latest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = z.object({ userId: z.string().uuid() }).parse(request.query);
        const latest = await deps.getLatestLearningPlan.execute(query.userId);
        if (!latest) {
          return reply.status(404).send({ error: 'No learning plan found' });
        }
        return reply.send(latest);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch learning plan' });
      }
    }
  );

  fastify.get(
    '/mentor/learning-plan/history',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = z
          .object({
            userId: z.string().uuid(),
            limit: z.coerce.number().min(1).max(100).optional(),
          })
          .parse(request.query);
        const plans = await deps.listLearningPlans.execute(query.userId, query.limit ?? 20);
        return reply.send(plans);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch learning plan history' });
      }
    }
  );

  fastify.post(
    '/mentor/feedback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = feedbackSchema.parse(request.body);
        const feedback = await deps.generateSubmissionFeedback.execute({
          userId: body.userId,
          submissionId: body.submissionId,
        });
        return reply.send(feedback);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        if (error instanceof Error && error.message === 'Unauthorized') {
          return reply.status(403).send({ error: 'Unauthorized' });
        }
        if (error instanceof Error && error.message === 'Submission not found') {
          return reply.status(404).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate feedback' });
      }
    }
  );

  fastify.get(
    '/mentor/sprint/current',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = sprintQuerySchema.parse(request.query);
        const sprint = await deps.getCurrentMentorSprint.execute(query.userId);
        if (!sprint) {
          return reply.status(404).send({ error: 'No active sprint found' });
        }
        return reply.send({
          id: sprint.id,
          userId: sprint.userId,
          learningPlanId: sprint.learningPlanId,
          sequence: sprint.sequence,
          goal: sprint.goal,
          focusAreas: sprint.focusAreas,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          status: sprint.status,
          updatedAt: sprint.updatedAt,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch sprint' });
      }
    }
  );

  fastify.get(
    '/mentor/summary',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = summaryQuerySchema.parse(request.query);
        const summary = await deps.getMentorMetadataSummary.execute(query.userId);
        return reply.send(summary);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch mentor summary' });
      }
    }
  );

  fastify.get(
    '/mentor/feedback/history',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = z
          .object({
            userId: z.string().uuid(),
            limit: z.coerce.number().min(1).max(100).optional(),
          })
          .parse(request.query);
        const list = await deps.listMentorFeedback.execute(query.userId, query.limit ?? 20);
        return reply.send(list);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch mentor feedback history' });
      }
    }
  );
}
