import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GenerateHintUseCase } from '../../application/usecases/GenerateHintUseCase';
import { z } from 'zod';
import { ApplicationError } from '../../application/errors/ApplicationError';

const hintRequestSchema = z.object({
    exerciseId: z.string().uuid(),
    questionIndex: z.number(),
    userId: z.string(),
  });

export function hintController(fastify: FastifyInstance, useCase: GenerateHintUseCase) {
    fastify.post('/hints', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = hintRequestSchema.parse(request.body);
            
            const hint = await useCase.execute({
                exerciseId: body.exerciseId,
                questionIndex: body.questionIndex,
                userId: body.userId,
            });

            return reply.send({ hint });

        } catch (error) {
            if (error instanceof ApplicationError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Invalid request body', details: error.format() });
            }
            fastify.log.error(error, 'Failed to generate hint');
            return reply.status(500).send({ error: 'Failed to generate hint' });
        }
    });
}
