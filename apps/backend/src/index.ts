import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { submissionRoutes } from './routes/submissions.js';
import { userRoutes } from './routes/users.js';
import { writingRoutes } from './routes/writing.js';
import dashboardRoutes from './routes/dashboard.js';
import { hintController } from './infrastructure/web/hintController.js';
import { GenerateHintUseCase } from './application/usecases/GenerateHintUseCase.js';
import { PrismaExerciseRepository } from './infrastructure/persistence/PrismaExerciseRepository.js';
import { PrismaHintRepository } from './infrastructure/persistence/PrismaHintRepository.js';
import { LLMHintGenerator } from './infrastructure/llm/LLMHintGenerator.js';
import { ListExercisesUseCase } from './application/usecases/ListExercisesUseCase.js';
import { GetExerciseByIdUseCase } from './application/usecases/GetExerciseByIdUseCase.js';
import { exerciseController } from './infrastructure/web/exerciseController.js';
import { PrismaSubmissionRepository } from './infrastructure/persistence/PrismaSubmissionRepository.js';
import { GetUserProgressUseCase } from './application/usecases/GetUserProgressUseCase.js';
import { progressController } from './infrastructure/web/progressController.js';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});

const exerciseRepository = new PrismaExerciseRepository();
const hintRepository = new PrismaHintRepository();
const submissionRepository = new PrismaSubmissionRepository();
const hintGenerator = new LLMHintGenerator();
const generateHintUseCase = new GenerateHintUseCase(
  exerciseRepository,
  hintRepository,
  hintGenerator
);
const listExercisesUseCase = new ListExercisesUseCase(exerciseRepository);
const getExerciseByIdUseCase = new GetExerciseByIdUseCase(exerciseRepository);
const getUserProgressUseCase = new GetUserProgressUseCase(submissionRepository, exerciseRepository);
// --- End of Dependency Injection ---

// ルート登録
fastify.register(authRoutes, { prefix: '/auth' });
fastify.register(
  (instance) => exerciseController(instance, listExercisesUseCase, getExerciseByIdUseCase),
  {
    prefix: '/exercises',
  }
);
fastify.register(submissionRoutes, { prefix: '/submissions' });
fastify.register((instance) => progressController(instance, getUserProgressUseCase), {
  prefix: '/me',
});
fastify.register((instance) => hintController(instance, generateHintUseCase), {
  prefix: '/hints',
});
fastify.register(userRoutes, { prefix: '/users' });
fastify.register(writingRoutes, { prefix: '/writing' });
fastify.register(dashboardRoutes);

// エラーハンドリング
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
    });
  }

  return reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
  });
});

// サーバー起動
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.info(`Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
