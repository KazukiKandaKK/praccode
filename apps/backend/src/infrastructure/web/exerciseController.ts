import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ListExercisesUseCase } from '../../application/usecases/ListExercisesUseCase';
import { GetExerciseByIdUseCase } from '../../application/usecases/GetExerciseByIdUseCase';
import { ApplicationError } from '../../application/errors/ApplicationError';
import { IExerciseGenerationEventPublisher } from '../../domain/ports/IExerciseGenerationEventPublisher';

const listQuerySchema = z.object({
  userId: z.string().uuid(),
  language: z.string().optional(),
  difficulty: z.coerce.number().min(1).max(5).optional(),
  genre: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

const byIdQuerySchema = z.object({
  userId: z.string().uuid(),
});

export function exerciseController(
  fastify: FastifyInstance,
  listExercises: ListExercisesUseCase,
  getExerciseById: GetExerciseByIdUseCase,
  exerciseEventPublisher: IExerciseGenerationEventPublisher
) {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listQuerySchema.parse(request.query);
      const result = await listExercises.execute(query);
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply
          .status(400)
          .send({ error: 'Invalid query parameters', details: error.format() });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  fastify.get(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { userId } = byIdQuerySchema.parse(request.query);

        const exercise = await getExerciseById.execute({ exerciseId: id, userId });

        return reply.send(exercise);
      } catch (error) {
        if (error instanceof ApplicationError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        if (error instanceof z.ZodError) {
          return reply
            .status(400)
            .send({ error: 'Invalid query parameters', details: error.format() });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'An unexpected error occurred' });
      }
    }
  );

  // GET /exercises/:id/events - SSEストリーム（生成完了通知）
  fastify.get(
    '/:id/events',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { userId } = byIdQuerySchema.parse(request.query);

        const exercise = await getExerciseById.execute({ exerciseId: id, userId });

        if (exercise.status === 'READY' || exercise.status === 'FAILED') {
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          const status = exercise.status;
          const eventType = status === 'READY' ? 'ready' : 'failed';
          reply.raw.write(
            `event: ${eventType}\ndata: ${JSON.stringify({
              exerciseId: id,
              status,
              title: exercise.title,
            })}\n\n`
          );
          reply.raw.end();
          return;
        }

        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        reply.raw.write(': connected\n\n');

        const cleanup = exerciseEventPublisher.onExerciseEvent(id, (event) => {
          const status = event.type === 'ready' ? 'READY' : 'FAILED';
          reply.raw.write(
            `event: ${event.type}\ndata: ${JSON.stringify({
              exerciseId: event.exerciseId,
              status,
              title: event.title,
            })}\n\n`
          );
          setTimeout(() => {
            reply.raw.end();
          }, 100);
        });

        request.raw.on('close', () => {
          cleanup();
          fastify.log.info(`SSE connection closed for exercise ${id}`);
        });

        const timeout = setTimeout(
          () => {
            reply.raw.write(
              `event: timeout\ndata: ${JSON.stringify({
                message: 'Connection timeout',
              })}\n\n`
            );
            reply.raw.end();
            cleanup();
          },
          5 * 60 * 1000
        );

        request.raw.on('close', () => {
          clearTimeout(timeout);
        });
      } catch (error) {
        if (error instanceof ApplicationError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        if (error instanceof z.ZodError) {
          return reply
            .status(400)
            .send({ error: 'Invalid query parameters', details: error.format() });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'An unexpected error occurred' });
      }
    }
  );
}
