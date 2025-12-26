import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GetUserProgressUseCase } from '../../../application/usecases/GetUserProgressUseCase';
import { z } from 'zod';

const progressQuerySchema = z.object({
    userId: z.string().uuid(),
});

export function progressController(fastify: FastifyInstance, useCase: GetUserProgressUseCase) {
    fastify.get('/progress', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { userId } = progressQuerySchema.parse(request.query);
            const progress = await useCase.execute(userId);
            return reply.send(progress);
        } catch(error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Invalid userId format' });
            }
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to get user progress' });
        }
    });
}
