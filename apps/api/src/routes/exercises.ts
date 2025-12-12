import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const exerciseFiltersSchema = z.object({
  language: z.string().optional(),
  difficulty: z.coerce.number().min(1).max(5).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export async function exerciseRoutes(fastify: FastifyInstance) {
  // GET /exercises - 学習一覧
  fastify.get('/', async (request, reply) => {
    const query = exerciseFiltersSchema.parse(request.query);
    const { language, difficulty, page, limit } = query;

    const where = {
      ...(language && { language }),
      ...(difficulty && { difficulty }),
    };

    const [exercises, total] = await Promise.all([
      prisma.exercise.findMany({
        where,
        select: {
          id: true,
          title: true,
          language: true,
          difficulty: true,
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
}

