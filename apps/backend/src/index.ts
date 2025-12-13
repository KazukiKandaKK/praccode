import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { exerciseRoutes } from './routes/exercises.js';
import { submissionRoutes } from './routes/submissions.js';
import { progressRoutes } from './routes/progress.js';
import { hintRoutes } from './routes/hints.js';
import { userRoutes } from './routes/users.js';
import { writingRoutes } from './routes/writing.js';
import dashboardRoutes from './routes/dashboard.js';

const fastify = Fastify({
  logger: true,
});

// CORS設定
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});

// ヘルスチェック
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// ルート登録
fastify.register(authRoutes, { prefix: '/auth' });
fastify.register(exerciseRoutes, { prefix: '/exercises' });
fastify.register(submissionRoutes, { prefix: '/submissions' });
fastify.register(progressRoutes, { prefix: '/me' });
fastify.register(hintRoutes, { prefix: '/hints' });
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
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

