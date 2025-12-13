import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { generateExercise } from '../llm/generator.js';
import { checkOllamaHealth } from '../llm/ollama.js';

const exerciseFiltersSchema = z.object({
  language: z.string().optional(),
  difficulty: z.coerce.number().min(1).max(5).optional(),
  genre: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export async function exerciseRoutes(fastify: FastifyInstance) {
  // GET /exercises - 学習一覧
  fastify.get('/', async (request, reply) => {
    const query = exerciseFiltersSchema.parse(request.query);
    const { language, difficulty, genre, page, limit } = query;

    const where = {
      ...(language && { language }),
      ...(difficulty && { difficulty }),
      ...(genre && { genre }),
      status: 'READY', // 生成完了した問題のみ表示
    };

    const [exercises, total] = await Promise.all([
      prisma.exercise.findMany({
        where,
        select: {
          id: true,
          title: true,
          language: true,
          difficulty: true,
          genre: true,
          status: true,
          learningGoals: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.exercise.count({ where }),
    ]);

    return reply.send({
      exercises,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // GET /exercises/:id - 学習詳細
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const exercise = await prisma.exercise.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { questionIndex: 'asc' },
          select: {
            id: true,
            questionIndex: true,
            questionText: true,
          },
        },
      },
    });

    if (!exercise) {
      return reply.status(404).send({ error: 'Exercise not found' });
    }

    return reply.send(exercise);
  });

  // POST /exercises/:id/submissions - 新規サブミッション作成
  fastify.post('/:id/submissions', async (request, reply) => {
    const { id: exerciseId } = request.params as { id: string };
    const { userId } = request.body as { userId: string };

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { questions: true },
    });

    if (!exercise) {
      return reply.status(404).send({ error: 'Exercise not found' });
    }

    const submission = await prisma.submission.create({
      data: {
        exerciseId,
        userId,
        status: 'DRAFT',
        answers: {
          create: exercise.questions.map((q) => ({
            questionIndex: q.questionIndex,
            answerText: '',
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    return reply.status(201).send(submission);
  });

  // POST /exercises/generate - LLMで問題を生成（非同期）
  const generateExerciseSchema = z.object({
    language: z.string().min(1),
    difficulty: z.coerce.number().min(1).max(5),
    genre: z.string().min(1),
    userId: z.string().uuid(),
  });

  fastify.post('/generate', async (request, reply) => {
    // リクエストのバリデーション
    const body = generateExerciseSchema.parse(request.body);
    const { language, difficulty, genre, userId } = body;

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Ollamaの接続確認
    const isHealthy = await checkOllamaHealth();
    if (!isHealthy) {
      return reply.status(503).send({
        error: 'LLM service is not available. Please ensure Ollama is running.',
      });
    }

    // プレースホルダーのExerciseを作成（GENERATING状態）
    const exercise = await prisma.exercise.create({
      data: {
        title: '生成中...',
        language,
        difficulty,
        genre,
        status: 'GENERATING',
        sourceType: 'generated',
        code: '',
        learningGoals: [],
        createdById: userId,
      },
    });

    // 即座に202を返却
    reply.status(202).send({
      id: exercise.id,
      status: 'GENERATING',
    });

    // バックグラウンドでLLM生成を実行
    setImmediate(async () => {
      try {
        fastify.log.info(`Starting exercise generation for ${exercise.id}`);

        // LLMで問題を生成
        const generated = await generateExercise({ language, difficulty, genre });

        // 生成結果でExerciseを更新
        await prisma.exercise.update({
          where: { id: exercise.id },
          data: {
            title: generated.title,
            code: generated.code,
            learningGoals: generated.learningGoals,
            status: 'READY',
          },
        });

        // 設問を作成
        await prisma.exerciseReferenceAnswer.createMany({
          data: generated.questions.map((q, index) => ({
            exerciseId: exercise.id,
            questionIndex: index,
            questionText: q.questionText,
            idealAnswerPoints: q.idealAnswerPoints,
          })),
        });

        fastify.log.info(`Exercise ${exercise.id} generated successfully`);
      } catch (error) {
        fastify.log.error(error, `Failed to generate exercise ${exercise.id}`);

        // 失敗時はステータスをFAILEDに更新
        await prisma.exercise.update({
          where: { id: exercise.id },
          data: { status: 'FAILED', title: '生成に失敗しました' },
        });
      }
    });
  });

  // GET /exercises/generate/health - LLM接続状態確認
  fastify.get('/generate/health', async (request, reply) => {
    const isHealthy = await checkOllamaHealth();
    return reply.send({
      status: isHealthy ? 'ok' : 'unavailable',
      message: isHealthy ? 'Ollama is running' : 'Ollama is not available',
    });
  });
}
