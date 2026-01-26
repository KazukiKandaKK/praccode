import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApplicationError } from '@/application/errors/ApplicationError';
import { CreateMentorThreadUseCase } from '@/application/usecases/mentor-chat/CreateMentorThreadUseCase';
import { GetMentorThreadUseCase } from '@/application/usecases/mentor-chat/GetMentorThreadUseCase';
import { PostMentorMessageUseCase } from '@/application/usecases/mentor-chat/PostMentorMessageUseCase';
import { PostMentorMessageStreamUseCase } from '@/application/usecases/mentor-chat/PostMentorMessageStreamUseCase';
import { PromptSanitizer } from '@/infrastructure/llm/prompt-sanitizer';
import { PromptInjectionError } from '@/infrastructure/llm/prompt-injection-error';

const createThreadSchema = z.object({
  exerciseId: z.string().uuid().optional(),
  submissionId: z.string().uuid().optional(),
});

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const threadIdParamsSchema = z.object({
  id: z.string().uuid(),
});

type MentorChatDeps = {
  createThread: CreateMentorThreadUseCase;
  getThread: GetMentorThreadUseCase;
  postMessage: PostMentorMessageUseCase;
  postMessageStream: PostMentorMessageStreamUseCase;
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

export function mentorChatController(fastify: FastifyInstance, deps: MentorChatDeps) {
  fastify.post('/mentor/threads', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const body = createThreadSchema.parse(request.body ?? {});
      const thread = await deps.createThread.execute({
        userId,
        exerciseId: body.exerciseId,
        submissionId: body.submissionId,
      });
      return reply.send({ threadId: thread.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to create mentor thread' });
    }
  });

  fastify.get('/mentor/threads/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const params = threadIdParamsSchema.parse(request.params);
      const result = await deps.getThread.execute({ threadId: params.id, userId });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch mentor thread' });
    }
  });

  fastify.post('/mentor/threads/:id/messages', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const params = threadIdParamsSchema.parse(request.params);
      const body = messageSchema.parse(request.body ?? {});
      PromptSanitizer.sanitize(body.content, 'content');

      const result = await deps.postMessage.execute({
        threadId: params.id,
        userId,
        content: body.content,
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
      if (error instanceof ApplicationError) {
        if (error.statusCode === 503) {
          return reply.status(503).send({
            error: 'Mentor response failed',
            message: 'メンターの応答生成に失敗しました。しばらくしてから再度お試しください。',
          });
        }
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(503).send({
        error: 'Mentor response failed',
        message: 'メンターの応答生成に失敗しました。しばらくしてから再度お試しください。',
      });
    }
  });

  fastify.post('/mentor/threads/:id/messages/stream', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const params = threadIdParamsSchema.parse(request.params);
      const body = messageSchema.parse(request.body ?? {});
      PromptSanitizer.sanitize(body.content, 'content');

      const result = await deps.postMessageStream.execute({
        threadId: params.id,
        userId,
        content: body.content,
      });

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      reply.raw.write(': connected\n\n');
      reply.raw.write(`event: start\ndata: ${JSON.stringify({ userMessage: result.userMessage })}\n\n`);

      let isClosed = false;
      request.raw.on('close', () => {
        isClosed = true;
      });

      for await (const chunk of result.stream) {
        if (isClosed) break;
        reply.raw.write(`event: delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
      }

      const completion = await result.completion;
      if (isClosed) return;

      if (completion.error) {
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({
            message: 'メンターの応答生成に失敗しました。しばらくしてから再度お試しください。',
            assistantMessage: completion.assistantMessage,
          })}\n\n`
        );
        reply.raw.end();
        return;
      }

      reply.raw.write(
        `event: done\ndata: ${JSON.stringify({
          assistantMessage: completion.assistantMessage,
        })}\n\n`
      );
      reply.raw.end();
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
      if (error instanceof ApplicationError) {
        if (error.statusCode === 503) {
          return reply.status(503).send({
            error: 'Mentor response failed',
            message: 'メンターの応答生成に失敗しました。しばらくしてから再度お試しください。',
          });
        }
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(503).send({
        error: 'Mentor response failed',
        message: 'メンターの応答生成に失敗しました。しばらくしてから再度お試しください。',
      });
    }
  });
}
