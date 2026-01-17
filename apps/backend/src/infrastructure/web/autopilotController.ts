import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApplicationError } from '@/application/errors/ApplicationError';
import { EnqueueAutopilotTriggerUseCase } from '@/application/usecases/autopilot/EnqueueAutopilotTriggerUseCase';
import { ListAutopilotRunsUseCase } from '@/application/usecases/autopilot/ListAutopilotRunsUseCase';
import { GetAutopilotRunUseCase } from '@/application/usecases/autopilot/GetAutopilotRunUseCase';

const triggerSchema = z.object({
  triggerType: z.literal('submission_evaluated'),
  submissionId: z.string().uuid(),
});

const runIdParamsSchema = z.object({
  id: z.string().uuid(),
});

type AutopilotDeps = {
  enqueueTrigger: EnqueueAutopilotTriggerUseCase;
  listRuns: ListAutopilotRunsUseCase;
  getRun: GetAutopilotRunUseCase;
};

const getUserId = (request: FastifyRequest): string | null => {
  const header = request.headers['x-user-id'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  try {
    return z.string().uuid().parse(raw);
  } catch {
    return null;
  }
};

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const userId = getUserId(request);
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }
  return userId;
};

export function autopilotController(fastify: FastifyInstance, deps: AutopilotDeps) {
  fastify.post('/autopilot/trigger', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const body = triggerSchema.parse(request.body ?? {});
      const result = await deps.enqueueTrigger.execute({
        userId,
        triggerType: body.triggerType,
        submissionId: body.submissionId,
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to enqueue autopilot trigger' });
    }
  });

  fastify.get('/autopilot/runs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const result = await deps.listRuns.execute({ userId });
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to list autopilot runs' });
    }
  });

  fastify.get('/autopilot/runs/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const params = runIdParamsSchema.parse(request.params);
      const result = await deps.getRun.execute({ runId: params.id, userId });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch autopilot run' });
    }
  });
}
