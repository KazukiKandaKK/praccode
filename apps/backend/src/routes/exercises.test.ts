import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { exerciseRoutes } from './exercises';
import { prisma } from '../lib/prisma';
import * as llmClient from '../llm/llm-client';
import * as generator from '../llm/generator';

// A helper to wait for the next event loop tick
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    exercise: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    submission: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    exerciseReferenceAnswer: {
      createMany: vi.fn(),
    },
  },
}));

// Mock llm-client and generator
vi.mock('../llm/llm-client', () => ({
  checkOllamaHealth: vi.fn(),
}));
vi.mock('../llm/generator', () => ({
  generateExercise: vi.fn(),
}));

const mockPrisma = prisma as any;
const mockLlmClient = llmClient as any;
const mockGenerator = generator as any;

describe('exerciseRoutes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
    app.setErrorHandler((error, request, reply) => {
      if (error.validation) {
        reply.status(400).send({ error: 'Invalid input', details: error.validation });
      } else {
        console.error(error);
        reply.status(500).send({ error: 'Internal Server Error' });
      }
    });
    app.register(exerciseRoutes, { prefix: '/exercises' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  //--- GET /exercises ---
  describe('GET /exercises', () => {
    it('正常系: フィルターなしで演習リストを返す', async () => {
      const mockExercises = [{ id: 'ex-1', title: 'Test Exercise' }];
      mockPrisma.exercise.findMany.mockResolvedValue(mockExercises);
      mockPrisma.exercise.count.mockResolvedValue(1);

      const response = await app.inject({
        method: 'GET',
        url: '/exercises?userId=d2d3b878-348c-4f70-9a57-7988351f5c69',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.exercises).toEqual(mockExercises);
      expect(body.pagination.total).toBe(1);
    });
  });

  //--- GET /exercises/:id ---
  describe('GET /exercises/:id', () => {
    const exerciseId = 'ex-1';
    const userId = 'user-1';
    const mockExercise = { id: exerciseId, title: 'Test', assignedToId: userId, questions: [] };

    it('正常系: 演習詳細を返す', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(mockExercise);
      const response = await app.inject({
        method: 'GET',
        url: `/exercises/${exerciseId}?userId=${userId}`,
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockExercise);
    });
  });

  //--- POST /exercises/:id/submissions ---
  describe('POST /exercises/:id/submissions', () => {
    it('正常系: 新しいサブミッションを作成し201を返す', async () => {
      const exerciseId = 'ex-1';
      const userId = 'user-1';
      const mockExercise = { id: exerciseId, questions: [{ questionIndex: 0 }, { questionIndex: 1 }] };
      const mockSubmission = { id: 'sub-1', status: 'DRAFT', answers: [] };
      mockPrisma.exercise.findUnique.mockResolvedValue(mockExercise);
      mockPrisma.submission.create.mockResolvedValue(mockSubmission);

      const response = await app.inject({
        method: 'POST',
        url: `/exercises/${exerciseId}/submissions`,
        payload: { userId },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(mockSubmission);
    });
  });

  //--- POST /exercises/generate (Async) ---
  describe('POST /exercises/generate', () => {
    const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
    const generatePayload = { language: 'go', difficulty: 4, genre: 'concurrency', userId };

    it('正常系: 202を返し、バックグラウンドで演習を生成する', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: userId });
        mockLlmClient.checkOllamaHealth.mockResolvedValue(true);
        mockPrisma.exercise.create.mockResolvedValue({ id: 'gen-ex-1', status: 'GENERATING' });
        mockGenerator.generateExercise.mockResolvedValue({ title: 'Generated Title', code: '...', learningGoals: [], questions: [{questionText: 'q1', idealAnswerPoints: []}] });
  
        const response = await app.inject({
          method: 'POST',
          url: '/exercises/generate',
          payload: generatePayload,
        });
  
        // 1. Immediate response is 202
        expect(response.statusCode).toBe(202);
        expect(JSON.parse(response.payload)).toEqual({ id: 'gen-ex-1', status: 'GENERATING' });
        
        // 2. Placeholder exercise is created
        expect(mockPrisma.exercise.create).toHaveBeenCalledWith({
          data: {
              title: '生成中...',
              language: generatePayload.language,
              difficulty: generatePayload.difficulty,
              genre: generatePayload.genre,
              status: 'GENERATING',
              sourceType: 'generated',
              code: '',
              learningGoals: [],
              createdById: userId,
              assignedToId: userId,
          },
        });
  
        // 3. Wait for the background task to complete by polling a mock
        await new Promise<void>(resolve => {
            const interval = setInterval(() => {
                if (mockPrisma.exercise.update.mock.calls.length > 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 10); // Check every 10ms
        });
  
        // 4. Check that the background tasks were called correctly
        expect(mockGenerator.generateExercise).toHaveBeenCalled();
        expect(mockPrisma.exercise.update).toHaveBeenCalledWith({
            where: { id: 'gen-ex-1' },
            data: {
                title: 'Generated Title',
                code: '...',
                learningGoals: [],
                status: 'READY',
            },
        });
        expect(mockPrisma.exerciseReferenceAnswer.createMany).toHaveBeenCalled();
      });

    it('異常系: LLMサービスが利用不可の場合503を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId });
      mockLlmClient.checkOllamaHealth.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/exercises/generate',
        payload: generatePayload,
      });

      expect(response.statusCode).toBe(503);
    });
  });

  //--- GET /exercises/generate/health ---
  describe('GET /exercises/generate/health', () => {
    it('正常系: LLMサービスが健康な場合okを返す', async () => {
      mockLlmClient.checkOllamaHealth.mockResolvedValue(true);
      const response = await app.inject({ method: 'GET', url: '/exercises/generate/health' });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ status: 'ok', message: 'Ollama is running' });
    });
  });
});
