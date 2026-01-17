import { PrismaExerciseRepository } from '@/infrastructure/persistence/PrismaExerciseRepository';
import { PrismaSubmissionRepository } from '@/infrastructure/persistence/PrismaSubmissionRepository';
import { PrismaMentorThreadRepository } from '@/infrastructure/persistence/PrismaMentorThreadRepository';
import { PrismaMentorFeedbackRepository } from '@/infrastructure/persistence/PrismaMentorFeedbackRepository';
import { PrismaMentorFeedbackInsightRepository } from '@/infrastructure/persistence/PrismaMentorFeedbackInsightRepository';
import { PrismaAutopilotOutboxRepository } from '@/infrastructure/persistence/PrismaAutopilotOutboxRepository';
import { PrismaAutopilotRunRepository } from '@/infrastructure/persistence/PrismaAutopilotRunRepository';
import { MentorAgent } from '@/mastra/mentorAgent';
import { AutopilotAgent } from '@/mastra/autopilotAgent';
import { PrismaMastraMemory } from '@/mastra/PrismaMastraMemory';
import type { MastraMemory } from '@mastra/core';
import { GenerateSubmissionFeedbackWithAgentUseCase } from '@/application/usecases/mentor/GenerateSubmissionFeedbackWithAgentUseCase';
import { CreateMentorThreadUseCase } from '@/application/usecases/mentor-chat/CreateMentorThreadUseCase';
import { buildAutopilotToolRegistry } from '@/mastra/tools/autopilot-tools';
import { RunAutopilotFromOutboxUseCase } from '@/application/usecases/autopilot/RunAutopilotFromOutboxUseCase';

const intervalMs = parseInt(process.env.AUTOPILOT_WORKER_INTERVAL_MS || '10000', 10);

const logger = {
  info: (...args: unknown[]) => console.info('[autopilot]', ...args),
  error: (...args: unknown[]) => console.error('[autopilot]', ...args),
};

const submissionRepository = new PrismaSubmissionRepository();
const exerciseRepository = new PrismaExerciseRepository();
const mentorThreadRepository = new PrismaMentorThreadRepository();
const mentorFeedbackRepository = new PrismaMentorFeedbackRepository();
const mentorFeedbackInsightRepository = new PrismaMentorFeedbackInsightRepository();

const mentorMemory = new PrismaMastraMemory() as unknown as MastraMemory;
const mentorAgent = new MentorAgent({ memory: mentorMemory });

const autopilotMemory = new PrismaMastraMemory() as unknown as MastraMemory;
const autopilotAgent = new AutopilotAgent({ memory: autopilotMemory });

const generateSubmissionFeedbackUseCase = new GenerateSubmissionFeedbackWithAgentUseCase(
  submissionRepository,
  exerciseRepository,
  mentorFeedbackRepository,
  mentorFeedbackInsightRepository,
  mentorAgent
);

const createMentorThreadUseCase = new CreateMentorThreadUseCase(
  mentorThreadRepository,
  exerciseRepository,
  submissionRepository
);

const toolRegistry = buildAutopilotToolRegistry({
  submissionRepository,
  mentorThreadRepository,
  generateSubmissionFeedbackUseCase,
  createMentorThreadUseCase,
});

const outboxRepository = new PrismaAutopilotOutboxRepository();
const runRepository = new PrismaAutopilotRunRepository();

const runner = new RunAutopilotFromOutboxUseCase(
  outboxRepository,
  runRepository,
  autopilotAgent,
  toolRegistry,
  logger
);

let running = false;

const tick = async () => {
  if (running) return;
  running = true;
  try {
    await runner.execute();
  } catch (error) {
    logger.error(error, 'Autopilot worker tick failed');
  } finally {
    running = false;
  }
};

logger.info(`Autopilot worker started. interval=${intervalMs}ms`);
void tick();
const timer = setInterval(() => void tick(), intervalMs);

const shutdown = () => {
  clearInterval(timer);
  logger.info('Autopilot worker stopped');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
