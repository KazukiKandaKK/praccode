import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { generateHint } from '../llm/hint.js';

const hintRequestSchema = z.object({
  exerciseId: z.string().uuid(),
  questionIndex: z.number(),
  userId: z.string(),
});

export async function hintRoutes(fastify: FastifyInstance) {
  // POST /hints - ヒント生成
  fastify.post('/', async (request, reply) => {
    const body = hintRequestSchema.parse(request.body);
    const { exerciseId, questionIndex, userId } = body;

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        questions: {
          where: { questionIndex },
        },
      },
    });

    if (!exercise) {
      return reply.status(404).send({ error: 'Exercise not found' });
    }

    const question = exercise.questions[0];
    if (!question) {
      return reply.status(404).send({ error: 'Question not found' });
    }

    try {
      const hint = await generateHint({
        code: exercise.code,
        question: question.questionText,
        learningGoals: exercise.learningGoals as string[],
      });

      // ヒント履歴を保存
      await prisma.hint.create({
        data: {
          exerciseId,
          userId,
          questionIndex,
          hintText: hint,
        },
      });

      return reply.send({ hint });
    } catch (error) {
      fastify.log.error(error, 'Failed to generate hint');
      return reply.status(500).send({ error: 'Failed to generate hint' });
    }
  });
}
