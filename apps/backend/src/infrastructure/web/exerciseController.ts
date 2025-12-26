import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ListExercisesUseCase } from '../../application/usecases/ListExercisesUseCase';
import { GetExerciseByIdUseCase } from '../../application/usecases/GetExerciseByIdUseCase';
import { ApplicationError } from '../../application/errors/ApplicationError';

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
  getExerciseById: GetExerciseByIdUseCase
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
}
