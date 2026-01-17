import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApplicationError } from '@/application/errors/ApplicationError';
import { CreateAgentRunUseCase } from '@/application/usecases/agent-os/CreateAgentRunUseCase';
import { GetAgentRunUseCase } from '@/application/usecases/agent-os/GetAgentRunUseCase';
import { ContinueAgentRunUseCase } from '@/application/usecases/agent-os/ContinueAgentRunUseCase';
import { ConfirmAgentToolInvocationUseCase } from '@/application/usecases/agent-os/ConfirmAgentToolInvocationUseCase';
import { PromptSanitizer } from '@/infrastructure/llm/prompt-sanitizer';
import { PromptInjectionError } from '@/infrastructure/llm/prompt-injection-error';

const createRunSchema = z.object({
  mode: z.enum(['mentor', 'coach', 'deep_research', 'code_assist', 'generic']),
  goal: z.string().min(1).max(2000),
  inputJson: z.record(z.unknown()).optional(),
});

const confirmSchema = z.object({
  invocationId: z.string().uuid(),
  decision: z.enum(['allow', 'deny']),
});

const runIdParamsSchema = z.object({
  id: z.string().uuid(),
});

type AgentOSDeps = {
  createRun: CreateAgentRunUseCase;
  getRun: GetAgentRunUseCase;
  continueRun: ContinueAgentRunUseCase;
  confirmInvocation: ConfirmAgentToolInvocationUseCase;
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

export function agentOSController(fastify: FastifyInstance, deps: AgentOSDeps) {
  fastify.post('/agent/runs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const body = createRunSchema.parse(request.body ?? {});
      PromptSanitizer.sanitize(body.goal, 'goal');
      const result = await deps.createRun.execute({
        userId,
        mode: body.mode,
        goal: body.goal,
        inputJson: body.inputJson,
      });
      return reply.send(result);
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
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to create agent run' });
    }
  });

  fastify.get('/agent/runs/:id', async (request, reply) => {
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
      return reply.status(500).send({ error: 'Failed to fetch agent run' });
    }
  });

  fastify.post('/agent/runs/:id/continue', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const params = runIdParamsSchema.parse(request.params);
      const result = await deps.continueRun.execute({ runId: params.id, userId });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to continue agent run' });
    }
  });

  fastify.post('/agent/runs/:id/confirm', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const params = runIdParamsSchema.parse(request.params);
      const body = confirmSchema.parse(request.body ?? {});
      const result = await deps.confirmInvocation.execute({
        runId: params.id,
        userId,
        invocationId: body.invocationId,
        decision: body.decision,
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to confirm invocation' });
    }
  });
}
