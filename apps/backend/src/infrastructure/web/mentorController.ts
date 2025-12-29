import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { GenerateLearningPlanWithAgentUseCase } from '@/application/usecases/mentor/GenerateLearningPlanWithAgentUseCase';
import { GenerateSubmissionFeedbackWithAgentUseCase } from '@/application/usecases/mentor/GenerateSubmissionFeedbackWithAgentUseCase';
import { GetLatestLearningPlanUseCase } from '@/application/usecases/mentor/GetLatestLearningPlanUseCase';
import { ListLearningPlansUseCase } from '@/application/usecases/mentor/ListLearningPlansUseCase';
import { ListMentorFeedbackUseCase } from '@/application/usecases/mentor/ListMentorFeedbackUseCase';

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

type MentorDeps = {
  generateLearningPlan: GenerateLearningPlanWithAgentUseCase;
  generateSubmissionFeedback: GenerateSubmissionFeedbackWithAgentUseCase;
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
        if (error instanceof Error && error.message === 'User not found') {
          return reply.status(404).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate learning plan' });
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
