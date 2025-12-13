import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { executeCode } from '../runner/executor.js';
import {
  generateWritingChallenge,
  GenerateWritingChallengeInput,
} from '../llm/writing-generator.js';
import { generateCodeReview } from '../llm/code-reviewer.js';
import { checkOllamaHealth } from '../llm/ollama.js';
import { triggerLearningAnalysis } from '../lib/analysis-trigger.js';

// ========== Schemas ==========
const createChallengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  language: z.enum(['javascript', 'typescript', 'python', 'go']),
  difficulty: z.number().int().min(1).max(5),
  testCode: z.string().min(1),
  sampleCode: z.string().optional(),
});

const submitCodeSchema = z.object({
  userId: z.string().uuid(),
  challengeId: z.string().uuid(),
  language: z.enum(['javascript', 'typescript', 'python', 'go']),
  code: z.string().min(1),
});

const autoGenerateChallengeSchema = z.object({
  userId: z.string().uuid(),
  language: z.enum(['javascript', 'typescript', 'python', 'go']),
  difficulty: z.number().int().min(1).max(5),
  topic: z.string().optional(),
});

export async function writingRoutes(fastify: FastifyInstance) {
  // GET /writing/challenges - お題一覧（READY状態のもののみ）
  fastify.get('/challenges', async (request: FastifyRequest, reply: FastifyReply) => {
    const challenges = await prisma.writingChallenge.findMany({
      where: { status: 'READY' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        difficulty: true,
        status: true,
        createdAt: true,
      },
    });
    return reply.send({ challenges });
  });

  // GET /writing/challenges/:id - お題詳細
  fastify.get(
    '/challenges/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const challenge = await prisma.writingChallenge.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          language: true,
          difficulty: true,
          status: true,
          testCode: true,
          starterCode: true,
          createdAt: true,
        },
      });

      if (!challenge) {
        return reply.status(404).send({ error: 'Challenge not found' });
      }

      return reply.send(challenge);
    }
  );

  // POST /writing/challenges - お題作成（管理者用）
  fastify.post('/challenges', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createChallengeSchema.parse(request.body);

    const challenge = await prisma.writingChallenge.create({
      data: {
        title: body.title,
        description: body.description,
        language: body.language,
        difficulty: body.difficulty,
        testCode: body.testCode,
        sampleCode: body.sampleCode,
        status: 'READY',
      },
    });

    return reply.status(201).send(challenge);
  });

  // POST /writing/challenges/auto - LLMでお題を自動生成
  fastify.post('/challenges/auto', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = autoGenerateChallengeSchema.parse(request.body);

    // Ollamaの接続確認
    const ollamaHealthy = await checkOllamaHealth();
    if (!ollamaHealthy) {
      return reply.status(503).send({
        error: 'LLM service is not available',
        message: 'Ollama is not running. Please ensure Ollama is running on the host.',
      });
    }

    // GENERATING状態でレコードを作成
    const challenge = await prisma.writingChallenge.create({
      data: {
        title: '',
        description: '',
        language: body.language,
        difficulty: body.difficulty,
        testCode: '',
        status: 'GENERATING',
        createdById: body.userId,
      },
    });

    // 非同期でLLM生成を開始
    generateChallengeAsync(fastify, challenge.id, body).catch((err) => {
      fastify.log.error({ challengeId: challenge.id, err }, 'Writing challenge generation failed');
    });

    return reply.status(202).send({
      challengeId: challenge.id,
      status: 'GENERATING',
      message: 'Challenge generation started',
    });
  });

  // POST /writing/submissions - コード提出
  fastify.post('/submissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = submitCodeSchema.parse(request.body);

    // お題確認
    const challenge = await prisma.writingChallenge.findUnique({
      where: { id: body.challengeId },
    });

    if (!challenge) {
      return reply.status(404).send({ error: 'Challenge not found' });
    }

    // 提出レコード作成
    const submission = await prisma.writingSubmission.create({
      data: {
        challengeId: body.challengeId,
        userId: body.userId,
        language: body.language,
        code: body.code,
        status: 'PENDING',
      },
    });

    // 非同期で実行開始
    runCodeAsync(submission.id, body.code, challenge.testCode, body.language).catch((err) => {
      fastify.log.error({ submissionId: submission.id, err }, 'Code execution failed');
    });

    return reply.status(202).send({
      submissionId: submission.id,
      status: 'PENDING',
      message: 'Submission queued for execution',
    });
  });

  // GET /writing/submissions/:id - 提出結果取得
  fastify.get(
    '/submissions/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const submission = await prisma.writingSubmission.findUnique({
        where: { id },
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              language: true,
            },
          },
        },
      });

      if (!submission) {
        return reply.status(404).send({ error: 'Submission not found' });
      }

      return reply.send(submission);
    }
  );

  // GET /writing/submissions - ユーザーの提出履歴
  fastify.get(
    '/submissions',
    async (request: FastifyRequest<{ Querystring: { userId?: string } }>, reply: FastifyReply) => {
      const { userId } = request.query;

      if (!userId) {
        return reply.status(400).send({ error: 'userId is required' });
      }

      const submissions = await prisma.writingSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              language: true,
              difficulty: true,
            },
          },
        },
      });

      return reply.send({ submissions });
    }
  );

  // POST /writing/submissions/:id/feedback - LLMフィードバックをリクエスト
  fastify.post(
    '/submissions/:id/feedback',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // Ollamaの接続確認
      const isHealthy = await checkOllamaHealth();
      if (!isHealthy) {
        return reply.status(503).send({
          error: 'LLM service is not available. Please ensure Ollama is running.',
          hint: 'Run "ollama serve" and ensure the model is loaded.',
        });
      }

      const submission = await prisma.writingSubmission.findUnique({
        where: { id },
        include: {
          challenge: {
            select: {
              title: true,
              description: true,
              testCode: true,
            },
          },
        },
      });

      if (!submission) {
        return reply.status(404).send({ error: 'Submission not found' });
      }

      // すでに実行されている必要がある
      if (!submission.executedAt) {
        return reply.status(400).send({ error: 'Please run the code first' });
      }

      // すでに生成中の場合はそのまま返す
      if (submission.llmFeedbackStatus === 'GENERATING') {
        return reply.status(202).send({
          id: submission.id,
          status: 'GENERATING',
          message: 'Feedback generation already in progress',
        });
      }

      // ステータスを GENERATING に更新
      await prisma.writingSubmission.update({
        where: { id },
        data: { llmFeedbackStatus: 'GENERATING' },
      });

      // 非同期でフィードバック生成
      generateFeedbackAsync(fastify, submission).catch((err) => {
        fastify.log.error({ submissionId: id, err }, 'Feedback generation failed');
      });

      return reply.status(202).send({
        id: submission.id,
        status: 'GENERATING',
        message: 'Feedback generation started',
      });
    }
  );
}

// 非同期でLLMお題生成
async function generateChallengeAsync(
  fastify: FastifyInstance,
  challengeId: string,
  input: GenerateWritingChallengeInput
) {
  try {
    fastify.log.info({ challengeId, input }, 'Starting writing challenge generation');

    // LLMで生成
    const generated = await generateWritingChallenge(input);

    // 生成結果で更新
    await prisma.writingChallenge.update({
      where: { id: challengeId },
      data: {
        title: generated.title,
        description: generated.description,
        difficulty: generated.difficulty,
        testCode: generated.testCode,
        starterCode: generated.starterCode,
        sampleCode: generated.sampleCode,
        status: 'READY',
      },
    });

    fastify.log.info(
      { challengeId, title: generated.title },
      'Writing challenge generation completed'
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    fastify.log.error({ challengeId, err: errorMessage }, 'Writing challenge generation failed');

    await prisma.writingChallenge.update({
      where: { id: challengeId },
      data: { status: 'FAILED' },
    });
  }
}

// 非同期コード実行
async function runCodeAsync(
  submissionId: string,
  userCode: string,
  testCode: string,
  language: string
) {
  try {
    // RUNNINGに更新
    await prisma.writingSubmission.update({
      where: { id: submissionId },
      data: { status: 'RUNNING' },
    });

    // 実行
    const result = await executeCode(userCode, testCode, language);

    // 結果更新
    const updatedSubmission = await prisma.writingSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'COMPLETED',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        passed: result.exitCode === 0,
        executedAt: new Date(),
      },
    });

    // 学習分析をトリガー
    triggerLearningAnalysis(updatedSubmission.userId).catch((err) => {
      console.error('Failed to trigger learning analysis:', err);
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await prisma.writingSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'ERROR',
        stderr: errorMessage,
        passed: false,
        executedAt: new Date(),
      },
    });
  }
}

// 非同期でLLMフィードバック生成
async function generateFeedbackAsync(
  fastify: FastifyInstance,
  submission: {
    id: string;
    language: string;
    code: string;
    stdout: string | null;
    stderr: string | null;
    passed: boolean | null;
    challenge: {
      title: string;
      description: string;
      testCode: string;
    };
  }
) {
  try {
    fastify.log.info({ submissionId: submission.id }, 'Starting feedback generation');

    const testOutput = [submission.stdout, submission.stderr].filter(Boolean).join('\n\n');

    const feedback = await generateCodeReview({
      language: submission.language,
      challengeTitle: submission.challenge.title,
      challengeDescription: submission.challenge.description,
      userCode: submission.code,
      testCode: submission.challenge.testCode,
      testOutput,
      passed: submission.passed || false,
    });

    await prisma.writingSubmission.update({
      where: { id: submission.id },
      data: {
        llmFeedback: feedback,
        llmFeedbackStatus: 'COMPLETED',
        llmFeedbackAt: new Date(),
      },
    });

    fastify.log.info({ submissionId: submission.id }, 'Feedback generation completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : '';

    fastify.log.error(
      {
        submissionId: submission.id,
        error: errorMessage,
        stack: errorStack,
        ollamaHost: process.env.OLLAMA_HOST || 'http://host.docker.internal:11434',
        language: submission.language,
        codeLength: submission.code?.length || 0,
      },
      'Feedback generation failed'
    );

    await prisma.writingSubmission.update({
      where: { id: submission.id },
      data: { llmFeedbackStatus: 'FAILED' },
    });
  }
}
