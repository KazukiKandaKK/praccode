import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { hintRoutes } from './hints';
import { prisma } from '../lib/prisma';
import * as hintGenerator from '../llm/hint';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    exercise: {
      findUnique: vi.fn(),
    },
    hint: {
      create: vi.fn(),
    },
  },
}));

// Mock LLM hint generator
vi.mock('../llm/hint', () => ({
  generateHint: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
  exercise: { findUnique: ReturnType<typeof vi.fn> };
  hint: { create: ReturnType<typeof vi.fn> };
};

const mockGenerateHint = hintGenerator.generateHint as ReturnType<typeof vi.fn>;

describe('hintRoutes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
    app.register(hintRoutes, { prefix: '/hints' });
    vi.clearAllMocks();
  });

  describe('POST /hints', () => {
    const validRequestBody = {
      exerciseId: 'd2d3b878-348c-4f70-9a57-7988351f5c69',
      questionIndex: 0,
      userId: 'user-123',
    };

    const mockExercise = {
      id: validRequestBody.exerciseId,
      code: 'console.log("hello");',
      learningGoals: ['Understand basic output'],
      questions: [
        {
          questionIndex: 0,
          questionText: 'What does this code do?',
        },
      ],
    };

    it('正常系: 有効なリクエストでヒントが生成され、200を返す', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(mockExercise);
      mockPrisma.hint.create.mockResolvedValue({});
      mockGenerateHint.mockResolvedValue('This is a test hint.');

      const response = await app.inject({
        method: 'POST',
        url: '/hints',
        payload: validRequestBody,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ hint: 'This is a test hint.' });

      // Prismaの呼び出しを検証
      expect(mockPrisma.exercise.findUnique).toHaveBeenCalledWith({
        where: { id: validRequestBody.exerciseId },
        include: { questions: { where: { questionIndex: validRequestBody.questionIndex } } },
      });
      
      // generateHintの呼び出しを検証
      expect(mockGenerateHint).toHaveBeenCalledWith({
        code: mockExercise.code,
        question: mockExercise.questions[0].questionText,
        learningGoals: mockExercise.learningGoals,
      });

      // ヒント履歴の保存を検証
      expect(mockPrisma.hint.create).toHaveBeenCalledWith({
        data: {
          exerciseId: validRequestBody.exerciseId,
          userId: validRequestBody.userId,
          questionIndex: validRequestBody.questionIndex,
          hintText: 'This is a test hint.',
        },
      });
    });

    it('異常系: Exerciseが見つからない場合、404を返す', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/hints',
        payload: validRequestBody,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Exercise not found' });
      expect(mockGenerateHint).not.toHaveBeenCalled();
      expect(mockPrisma.hint.create).not.toHaveBeenCalled();
    });

    it('異常系: Questionが見つからない場合、404を返す', async () => {
      const exerciseWithoutQuestion = { ...mockExercise, questions: [] };
      mockPrisma.exercise.findUnique.mockResolvedValue(exerciseWithoutQuestion);

      const response = await app.inject({
        method: 'POST',
        url: '/hints',
        payload: validRequestBody,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Question not found' });
      expect(mockGenerateHint).not.toHaveBeenCalled();
      expect(mockPrisma.hint.create).not.toHaveBeenCalled();
    });

    it('異常系: LLMでのヒント生成に失敗した場合、500を返す', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(mockExercise);
      mockGenerateHint.mockRejectedValue(new Error('LLM failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/hints',
        payload: validRequestBody,
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Failed to generate hint' });
      expect(mockPrisma.hint.create).not.toHaveBeenCalled();
    });

    describe('入力値バリデーション', () => {
      it.each([
        ['exerciseId', { ...validRequestBody, exerciseId: 'invalid-uuid' }],
        ['questionIndex', { ...validRequestBody, questionIndex: 'not-a-number' }],
        ['userId', { ...validRequestBody, userId: undefined }],
        ['missing field', { exerciseId: 'd2d3b878-348c-4f70-9a57-7988351f5c69' }],
      ])('不正な入力値(%s)の場合、400エラーを返す', async (caseName, payload) => {
        const response = await app.inject({
          method: 'POST',
          url: '/hints',
          payload,
        });

        expect(response.statusCode).toBe(400);
        const parsedBody = JSON.parse(response.payload);
        expect(parsedBody.error).toBe('Invalid request body');
        expect(parsedBody.details).toBeDefined();
      });
    });
  });
});
