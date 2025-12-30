import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GetDashboardStatsUseCase } from '../../application/usecases/dashboard/GetDashboardStatsUseCase.js';
import { GetDashboardActivityUseCase } from '../../application/usecases/dashboard/GetDashboardActivityUseCase.js';
import { GetLearningAnalysisUseCase } from '../../application/usecases/dashboard/GetLearningAnalysisUseCase.js';
import { GenerateRecommendationUseCase } from '../../application/usecases/dashboard/GenerateRecommendationUseCase.js';
import { PromptSanitizer } from '../llm/prompt-sanitizer.js';
import { PromptInjectionError } from '../llm/prompt-injection-error.js';

const statsQuerySchema = z.object({
  userId: z.string().uuid(),
});

const generateRecommendationSchema = z.object({
  userId: z.string().uuid(),
  language: z.string().optional(),
  type: z.enum(['reading', 'writing']).optional(),
});

export interface DashboardControllerDeps {
  getStats: GetDashboardStatsUseCase;
  getActivity: GetDashboardActivityUseCase;
  getLearningAnalysis: GetLearningAnalysisUseCase;
  generateRecommendation: GenerateRecommendationUseCase;
}

export const dashboardController = (fastify: FastifyInstance, deps: DashboardControllerDeps) => {
  fastify.get('/dashboard/stats', async (request, reply) => {
    const { userId } = statsQuerySchema.parse(request.query);
    const result = await deps.getStats.execute(userId);
    return reply.send(result);
  });

  fastify.get('/dashboard/activity', async (request, reply) => {
    const { userId } = statsQuerySchema.parse(request.query);
    const result = await deps.getActivity.execute(userId);
    return reply.send(result);
  });

  fastify.get('/dashboard/analysis', async (request, reply) => {
    const { userId } = statsQuerySchema.parse(request.query);
    const result = await deps.getLearningAnalysis.execute({ userId, force: false });
    return reply.send(result);
  });

  fastify.post<{ Body: { userId: string } }>('/dashboard/analyze', async (request, reply) => {
    const { userId } = request.body;
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }
    const result = await deps.getLearningAnalysis.execute({ userId, force: true });
    return reply.send(result);
  });

  fastify.post('/dashboard/generate-recommendation', async (request, reply) => {
    try {
      const body = generateRecommendationSchema.parse(request.body);
      if (body.language) {
        PromptSanitizer.sanitize(body.language, 'language');
      }
      const result = await deps.generateRecommendation.execute({
        userId: body.userId,
        language: body.language,
        type: body.type ?? 'writing',
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
      throw error;
    }
  });
};
