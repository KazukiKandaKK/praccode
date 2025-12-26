import Fastify from 'fastify';
import cors from '@fastify/cors';
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
import { PrismaUserRepository } from './infrastructure/persistence/PrismaUserRepository.js';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher.js';
import { CryptoTokenService } from './infrastructure/security/CryptoTokenService.js';
import { MailEmailService } from './infrastructure/services/MailEmailService.js';
import { PrismaEmailVerificationTokenRepository } from './infrastructure/persistence/PrismaEmailVerificationTokenRepository.js';
import { PrismaPasswordResetTokenRepository } from './infrastructure/persistence/PrismaPasswordResetTokenRepository.js';
import { InitialAssignmentService } from './infrastructure/services/InitialAssignmentService.js';
import { LoginUseCase } from './application/usecases/LoginUseCase.js';
import { RegisterUserUseCase } from './application/usecases/RegisterUserUseCase.js';
import { VerifyEmailUseCase } from './application/usecases/VerifyEmailUseCase.js';
import { RequestPasswordResetUseCase } from './application/usecases/RequestPasswordResetUseCase.js';
import { ResetPasswordUseCase } from './application/usecases/ResetPasswordUseCase.js';
import { authRoutes } from './routes/auth.js';
import { CodeExecutorService } from './infrastructure/services/CodeExecutorService.js';
import { WritingChallengeGenerator } from './infrastructure/services/WritingChallengeGenerator.js';
import { CodeWritingFeedbackGenerator } from './infrastructure/services/CodeWritingFeedbackGenerator.js';
import { LlmHealthChecker } from './infrastructure/services/LlmHealthChecker.js';
import { LearningAnalysisScheduler } from './infrastructure/services/LearningAnalysisScheduler.js';
import { AnswerEvaluationService } from './infrastructure/services/AnswerEvaluationService.js';
import { EvaluationEventPublisher } from './infrastructure/services/EvaluationEventPublisher.js';

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
const userRepository = new PrismaUserRepository();
const passwordHasher = new BcryptPasswordHasher();
const tokenService = new CryptoTokenService();
const emailService = new MailEmailService();
const emailVerificationTokenRepository = new PrismaEmailVerificationTokenRepository();
const passwordResetTokenRepository = new PrismaPasswordResetTokenRepository();
const initialAssignmentService = new InitialAssignmentService();

const loginUseCase = new LoginUseCase(userRepository, passwordHasher);
const registerUserUseCase = new RegisterUserUseCase(
  userRepository,
  passwordHasher,
  emailVerificationTokenRepository,
  emailService,
  tokenService,
  initialAssignmentService
);
const verifyEmailUseCase = new VerifyEmailUseCase(
  emailVerificationTokenRepository,
  userRepository,
  emailService,
  tokenService
);
const requestPasswordResetUseCase = new RequestPasswordResetUseCase(
  userRepository,
  passwordResetTokenRepository,
  tokenService,
  emailService
);
const resetPasswordUseCase = new ResetPasswordUseCase(
  passwordResetTokenRepository,
  passwordHasher,
  userRepository,
  tokenService
);
const codeExecutor = new CodeExecutorService();
const writingChallengeGenerator = new WritingChallengeGenerator();
const codeFeedbackGenerator = new CodeWritingFeedbackGenerator();
const llmHealthChecker = new LlmHealthChecker();
const learningAnalysisScheduler = new LearningAnalysisScheduler();
const answerEvaluationService = new AnswerEvaluationService();
const evaluationEventPublisher = new EvaluationEventPublisher();
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
fastify.register(
  (instance) =>
    authRoutes(instance, {
      loginUseCase,
      registerUserUseCase,
      verifyEmailUseCase,
      requestPasswordResetUseCase,
      resetPasswordUseCase,
    }),
  { prefix: '/auth' }
);
fastify.register(
  (instance) => exerciseController(instance, listExercisesUseCase, getExerciseByIdUseCase),
  {
    prefix: '/exercises',
  }
);
fastify.register(
  (instance) =>
    submissionRoutes(instance, {
      evaluationService: answerEvaluationService,
      evaluationEventPublisher,
      learningAnalysisScheduler,
    }),
  { prefix: '/submissions' }
);
fastify.register((instance) => progressController(instance, getUserProgressUseCase), {
  prefix: '/me',
});
fastify.register((instance) => hintController(instance, generateHintUseCase), {
  prefix: '/hints',
});
fastify.register(userRoutes, { prefix: '/users' });
fastify.register(
  (instance) =>
    writingRoutes(instance, {
      codeExecutor,
      writingChallengeGenerator,
      codeFeedbackGenerator,
      llmHealthChecker,
      learningAnalysisScheduler,
    }),
  { prefix: '/writing' }
);
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
