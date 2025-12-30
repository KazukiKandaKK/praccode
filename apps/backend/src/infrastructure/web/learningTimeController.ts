import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GetDailyLearningTimeUseCase } from '../../application/usecases/learning-time/GetDailyLearningTimeUseCase.js';
import { LogLearningTimeUseCase } from '../../application/usecases/learning-time/LogLearningTimeUseCase.js';

const logSchema = z.object({
  userId: z.string().uuid(),
  durationSec: z.number().int().nonnegative(),
  source: z.string().min(1).max(64),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});

const dailyQuerySchema = z.object({
  userId: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(60).optional(),
});

export interface LearningTimeControllerDeps {
  logLearningTime: LogLearningTimeUseCase;
  getDailyLearningTime: GetDailyLearningTimeUseCase;
}

export const learningTimeController = (
  fastify: FastifyInstance,
  deps: LearningTimeControllerDeps
) => {
  fastify.post('/learning-time', async (request, reply) => {
    const body = logSchema.parse(request.body);
    await deps.logLearningTime.execute({
      userId: body.userId,
      durationSec: body.durationSec,
      source: body.source,
      startedAt: body.startedAt,
      endedAt: body.endedAt,
    });
    return reply.status(201).send({ ok: true });
  });

  fastify.get('/learning-time/daily', async (request, reply) => {
    const { userId, days } = dailyQuerySchema.parse(request.query);
    const result = await deps.getDailyLearningTime.execute({ userId, days });
    return reply.send(
      result.map((entry) => ({
        date: entry.date.toISOString(),
        durationSec: entry.durationSec,
      }))
    );
  });
};
