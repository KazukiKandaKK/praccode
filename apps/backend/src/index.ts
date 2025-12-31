import Fastify from 'fastify';
import cors from '@fastify/cors';
import { writingRoutes } from './infrastructure/web/writingRoutes.js';
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
import { authRoutes } from './infrastructure/web/authRoutes.js';
import { CodeExecutorService } from './infrastructure/services/CodeExecutorService.js';
import { WritingChallengeGenerator } from './infrastructure/services/WritingChallengeGenerator.js';
import { CodeWritingFeedbackGenerator } from './infrastructure/services/CodeWritingFeedbackGenerator.js';
import { LlmHealthChecker } from './infrastructure/services/LlmHealthChecker.js';
import { LearningAnalysisScheduler } from './infrastructure/services/LearningAnalysisScheduler.js';
import { AnswerEvaluationService } from './infrastructure/services/AnswerEvaluationService.js';
import { EvaluationEventPublisher } from './infrastructure/services/EvaluationEventPublisher.js';
import { PrismaWritingChallengeRepository } from './infrastructure/persistence/PrismaWritingChallengeRepository.js';
import { PrismaWritingSubmissionRepository } from './infrastructure/persistence/PrismaWritingSubmissionRepository.js';
import { ListWritingChallengesUseCase } from './application/usecases/writing/ListWritingChallengesUseCase.js';
import { GetWritingChallengeUseCase } from './application/usecases/writing/GetWritingChallengeUseCase.js';
import { AutoGenerateWritingChallengeUseCase } from './application/usecases/writing/AutoGenerateWritingChallengeUseCase.js';
import { CreateWritingChallengeUseCase } from './application/usecases/writing/CreateWritingChallengeUseCase.js';
import { SubmitWritingCodeUseCase } from './application/usecases/writing/SubmitWritingCodeUseCase.js';
import { ListWritingSubmissionsUseCase } from './application/usecases/writing/ListWritingSubmissionsUseCase.js';
import { GetWritingSubmissionUseCase } from './application/usecases/writing/GetWritingSubmissionUseCase.js';
import { RequestWritingFeedbackUseCase } from './application/usecases/writing/RequestWritingFeedbackUseCase.js';
import { ListSubmissionsUseCase } from './application/usecases/submissions/ListSubmissionsUseCase.js';
import { GetSubmissionUseCase } from './application/usecases/submissions/GetSubmissionUseCase.js';
import { UpdateSubmissionAnswersUseCase } from './application/usecases/submissions/UpdateSubmissionAnswersUseCase.js';
import { EvaluateSubmissionUseCase } from './application/usecases/submissions/EvaluateSubmissionUseCase.js';
import { submissionController } from './infrastructure/web/submissionController.js';
import { PrismaUserAccountRepository } from './infrastructure/persistence/PrismaUserAccountRepository.js';
import { PrismaEmailChangeTokenRepository } from './infrastructure/persistence/PrismaEmailChangeTokenRepository.js';
import { GetUserProfileUseCase } from './application/usecases/users/GetUserProfileUseCase.js';
import { UpdateUserProfileUseCase } from './application/usecases/users/UpdateUserProfileUseCase.js';
import { RequestEmailChangeUseCase } from './application/usecases/users/RequestEmailChangeUseCase.js';
import { ConfirmEmailChangeUseCase } from './application/usecases/users/ConfirmEmailChangeUseCase.js';
import { ChangePasswordUseCase } from './application/usecases/users/ChangePasswordUseCase.js';
import { userController } from './infrastructure/web/userController.js';
import { PrismaDashboardRepository } from './infrastructure/persistence/PrismaDashboardRepository.js';
import { GetDashboardStatsUseCase } from './application/usecases/dashboard/GetDashboardStatsUseCase.js';
import { GetDashboardActivityUseCase } from './application/usecases/dashboard/GetDashboardActivityUseCase.js';
import { GetLearningAnalysisUseCase } from './application/usecases/dashboard/GetLearningAnalysisUseCase.js';
import { GenerateRecommendationUseCase } from './application/usecases/dashboard/GenerateRecommendationUseCase.js';
import { dashboardController } from './infrastructure/web/dashboardController.js';
import { ExerciseGeneratorService } from './infrastructure/services/ExerciseGeneratorService.js';
import { LlmLearningAnalyzer } from './infrastructure/services/LlmLearningAnalyzer.js';
import { MentorAgent } from './mastra/mentorAgent.js';
import { GenerateLearningPlanWithAgentUseCase } from './application/usecases/mentor/GenerateLearningPlanWithAgentUseCase.js';
import { GenerateNextLearningPlanWithAgentUseCase } from './application/usecases/mentor/GenerateNextLearningPlanWithAgentUseCase.js';
import { GenerateSubmissionFeedbackWithAgentUseCase } from './application/usecases/mentor/GenerateSubmissionFeedbackWithAgentUseCase.js';
import { GetMentorAssessmentStatusUseCase } from './application/usecases/mentor/GetMentorAssessmentStatusUseCase.js';
import { GetCurrentMentorSprintUseCase } from './application/usecases/mentor/GetCurrentMentorSprintUseCase.js';
import { GetMentorWorkflowStepUseCase } from './application/usecases/mentor/GetMentorWorkflowStepUseCase.js';
import { GetMentorMetadataSummaryUseCase } from './application/usecases/mentor/GetMentorMetadataSummaryUseCase.js';
import { mentorController } from './infrastructure/web/mentorController.js';
import { PrismaLearningPlanRepository } from './infrastructure/persistence/PrismaLearningPlanRepository.js';
import { GetLatestLearningPlanUseCase } from './application/usecases/mentor/GetLatestLearningPlanUseCase.js';
import { PrismaMastraMemory } from './mastra/PrismaMastraMemory.js';
import { PrismaMentorFeedbackRepository } from './infrastructure/persistence/PrismaMentorFeedbackRepository.js';
import { PrismaMentorFeedbackInsightRepository } from './infrastructure/persistence/PrismaMentorFeedbackInsightRepository.js';
import { PrismaMentorSprintRepository } from './infrastructure/persistence/PrismaMentorSprintRepository.js';
import { PrismaMentorAssessmentRepository } from './infrastructure/persistence/PrismaMentorAssessmentRepository.js';
import { PrismaMentorWorkflowRepository } from './infrastructure/persistence/PrismaMentorWorkflowRepository.js';
import { ListLearningPlansUseCase } from './application/usecases/mentor/ListLearningPlansUseCase.js';
import { ListMentorFeedbackUseCase } from './application/usecases/mentor/ListMentorFeedbackUseCase.js';
import { UpdateMentorWorkflowStepUseCase } from './application/usecases/mentor/UpdateMentorWorkflowStepUseCase.js';
import { PrismaEvaluationMetricRepository } from './infrastructure/persistence/PrismaEvaluationMetricRepository.js';
import { PrismaLearningTimeRepository } from './infrastructure/persistence/PrismaLearningTimeRepository.js';
import { LogLearningTimeUseCase } from './application/usecases/learning-time/LogLearningTimeUseCase.js';
import { GetDailyLearningTimeUseCase } from './application/usecases/learning-time/GetDailyLearningTimeUseCase.js';
import { learningTimeController } from './infrastructure/web/learningTimeController.js';
import type { MastraMemory } from '@mastra/core';

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
const exerciseGeneratorService = new ExerciseGeneratorService();
const codeFeedbackGenerator = new CodeWritingFeedbackGenerator();
const llmHealthChecker = new LlmHealthChecker();
const learningAnalysisScheduler = new LearningAnalysisScheduler();
const answerEvaluationService = new AnswerEvaluationService();
const evaluationEventPublisher = new EvaluationEventPublisher();
const writingChallengeRepository = new PrismaWritingChallengeRepository();
const writingSubmissionRepository = new PrismaWritingSubmissionRepository();
const userAccountRepository = new PrismaUserAccountRepository();
const emailChangeTokenRepository = new PrismaEmailChangeTokenRepository();
const dashboardRepository = new PrismaDashboardRepository();
const learningAnalyzer = new LlmLearningAnalyzer();
const mentorMemory = new PrismaMastraMemory() as unknown as MastraMemory;
const mentorAgent = new MentorAgent({ memory: mentorMemory });
const learningPlanRepository = new PrismaLearningPlanRepository();
const mentorFeedbackRepository = new PrismaMentorFeedbackRepository();
const mentorFeedbackInsightRepository = new PrismaMentorFeedbackInsightRepository();
const mentorSprintRepository = new PrismaMentorSprintRepository();
const mentorAssessmentRepository = new PrismaMentorAssessmentRepository();
const mentorWorkflowRepository = new PrismaMentorWorkflowRepository();
const evaluationMetricRepository = new PrismaEvaluationMetricRepository();
const learningTimeRepository = new PrismaLearningTimeRepository();
const listWritingChallengesUseCase = new ListWritingChallengesUseCase(writingChallengeRepository);
const getWritingChallengeUseCase = new GetWritingChallengeUseCase(writingChallengeRepository);
const autoGenerateWritingChallengeUseCase = new AutoGenerateWritingChallengeUseCase(
  writingChallengeRepository,
  writingChallengeGenerator,
  llmHealthChecker
);
const createWritingChallengeUseCase = new CreateWritingChallengeUseCase(writingChallengeRepository);
const submitWritingCodeUseCase = new SubmitWritingCodeUseCase(
  writingChallengeRepository,
  writingSubmissionRepository,
  codeExecutor,
  learningAnalysisScheduler,
  evaluationMetricRepository
);
const listWritingSubmissionsUseCase = new ListWritingSubmissionsUseCase(writingSubmissionRepository);
const getWritingSubmissionUseCase = new GetWritingSubmissionUseCase(writingSubmissionRepository);
const requestWritingFeedbackUseCase = new RequestWritingFeedbackUseCase(
  writingSubmissionRepository,
  codeFeedbackGenerator,
  llmHealthChecker
);
const listSubmissionsUseCase = new ListSubmissionsUseCase(submissionRepository);
const getSubmissionUseCase = new GetSubmissionUseCase(submissionRepository);
const updateSubmissionAnswersUseCase = new UpdateSubmissionAnswersUseCase(submissionRepository);
const evaluateSubmissionUseCase = new EvaluateSubmissionUseCase(
  submissionRepository,
  answerEvaluationService,
  evaluationEventPublisher,
  learningAnalysisScheduler,
  evaluationMetricRepository,
  fastify.log
);
const getUserProfileUseCase = new GetUserProfileUseCase(userAccountRepository);
const updateUserProfileUseCase = new UpdateUserProfileUseCase(userAccountRepository);
const requestEmailChangeUseCase = new RequestEmailChangeUseCase(
  userAccountRepository,
  emailChangeTokenRepository,
  emailService
);
const confirmEmailChangeUseCase = new ConfirmEmailChangeUseCase(
  userAccountRepository,
  emailChangeTokenRepository
);
const changePasswordUseCase = new ChangePasswordUseCase(userAccountRepository, passwordHasher);
const getDashboardStatsUseCase = new GetDashboardStatsUseCase(
  dashboardRepository,
  learningTimeRepository
);
const getDashboardActivityUseCase = new GetDashboardActivityUseCase(dashboardRepository);
const getLearningAnalysisUseCase = new GetLearningAnalysisUseCase(
  dashboardRepository,
  learningAnalyzer
);
const generateRecommendationUseCase = new GenerateRecommendationUseCase(
  dashboardRepository,
  getLearningAnalysisUseCase,
  exerciseGeneratorService,
  writingChallengeGenerator,
  fastify.log
);
const generateLearningPlanWithAgentUseCase = new GenerateLearningPlanWithAgentUseCase(
  userAccountRepository,
  submissionRepository,
  exerciseRepository,
  learningPlanRepository,
  mentorSprintRepository,
  mentorAgent
);
const generateNextLearningPlanWithAgentUseCase = new GenerateNextLearningPlanWithAgentUseCase(
  userAccountRepository,
  submissionRepository,
  exerciseRepository,
  learningPlanRepository,
  mentorFeedbackRepository,
  mentorSprintRepository,
  mentorAgent
);
const generateSubmissionFeedbackWithAgentUseCase = new GenerateSubmissionFeedbackWithAgentUseCase(
  submissionRepository,
  exerciseRepository,
  mentorFeedbackRepository,
  mentorFeedbackInsightRepository,
  mentorAgent
);
const getLatestLearningPlanUseCase = new GetLatestLearningPlanUseCase(learningPlanRepository);
const listLearningPlansUseCase = new ListLearningPlansUseCase(learningPlanRepository);
const listMentorFeedbackUseCase = new ListMentorFeedbackUseCase(mentorFeedbackRepository);
const getMentorAssessmentStatusUseCase = new GetMentorAssessmentStatusUseCase(
  mentorAssessmentRepository
);
const getCurrentMentorSprintUseCase = new GetCurrentMentorSprintUseCase(mentorSprintRepository);
const getMentorWorkflowStepUseCase = new GetMentorWorkflowStepUseCase(
  mentorWorkflowRepository
);
const updateMentorWorkflowStepUseCase = new UpdateMentorWorkflowStepUseCase(
  mentorWorkflowRepository
);
const getMentorMetadataSummaryUseCase = new GetMentorMetadataSummaryUseCase(
  evaluationMetricRepository,
  mentorFeedbackInsightRepository
);
const generateHintUseCase = new GenerateHintUseCase(
  exerciseRepository,
  hintRepository,
  hintGenerator
);
const logLearningTimeUseCase = new LogLearningTimeUseCase(learningTimeRepository);
const getDailyLearningTimeUseCase = new GetDailyLearningTimeUseCase(learningTimeRepository);
const listExercisesUseCase = new ListExercisesUseCase(exerciseRepository);
const getExerciseByIdUseCase = new GetExerciseByIdUseCase(exerciseRepository);
const getUserProgressUseCase = new GetUserProgressUseCase(submissionRepository, exerciseRepository);
// --- End of Dependency Injection ---

// ルート登録（順番は依存なしだが、awaitで初期化完了を明示）
await fastify.register(
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
await fastify.register(
  async (instance) => {
    exerciseController(instance, listExercisesUseCase, getExerciseByIdUseCase);
  },
  { prefix: '/exercises' }
);
await fastify.register(
  async (instance) => {
    submissionController(instance, {
      listSubmissions: listSubmissionsUseCase,
      getSubmission: getSubmissionUseCase,
      updateSubmissionAnswers: updateSubmissionAnswersUseCase,
      evaluateSubmission: evaluateSubmissionUseCase,
      eventPublisher: evaluationEventPublisher,
    });
  },
  { prefix: '/submissions' }
);
await fastify.register(
  async (instance) => {
    progressController(instance, getUserProgressUseCase);
  },
  { prefix: '/me' }
);
await fastify.register(
  async (instance) => {
    hintController(instance, generateHintUseCase);
  },
  { prefix: '/hints' }
);
await fastify.register(
  async (instance) => {
    userController(instance, {
      getProfile: getUserProfileUseCase,
      updateProfile: updateUserProfileUseCase,
      requestEmailChange: requestEmailChangeUseCase,
      confirmEmailChange: confirmEmailChangeUseCase,
      changePassword: changePasswordUseCase,
    });
  },
  { prefix: '/users' }
);
await fastify.register(
  async (instance) => {
    writingRoutes(instance, {
      listChallenges: listWritingChallengesUseCase,
      getChallenge: getWritingChallengeUseCase,
      autoGenerateChallenge: autoGenerateWritingChallengeUseCase,
      createChallenge: createWritingChallengeUseCase,
      submitCode: submitWritingCodeUseCase,
      listSubmissions: listWritingSubmissionsUseCase,
      getSubmission: getWritingSubmissionUseCase,
      requestFeedback: requestWritingFeedbackUseCase,
    });
  },
  { prefix: '/writing' }
);
await fastify.register(
  async (instance) => {
    learningTimeController(instance, {
      logLearningTime: logLearningTimeUseCase,
      getDailyLearningTime: getDailyLearningTimeUseCase,
    });
  }
);
await fastify.register(
  async (instance) => {
    dashboardController(instance, {
      getStats: getDashboardStatsUseCase,
      getActivity: getDashboardActivityUseCase,
      getLearningAnalysis: getLearningAnalysisUseCase,
      generateRecommendation: generateRecommendationUseCase,
    });
  }
);
await fastify.register(
  async (instance) => {
    mentorController(instance, {
      generateLearningPlan: generateLearningPlanWithAgentUseCase,
      generateNextLearningPlan: generateNextLearningPlanWithAgentUseCase,
      generateSubmissionFeedback: generateSubmissionFeedbackWithAgentUseCase,
      getMentorAssessmentStatus: getMentorAssessmentStatusUseCase,
      getCurrentMentorSprint: getCurrentMentorSprintUseCase,
      getMentorMetadataSummary: getMentorMetadataSummaryUseCase,
      getMentorWorkflowStep: getMentorWorkflowStepUseCase,
      updateMentorWorkflowStep: updateMentorWorkflowStepUseCase,
      getLatestLearningPlan: getLatestLearningPlanUseCase,
      listLearningPlans: listLearningPlansUseCase,
      listMentorFeedback: listMentorFeedbackUseCase,
    });
  }
);

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
    // Bind to IPv6 any to allow ::1/localhost (covers IPv4 on most platforms)
    const host = process.env.HOST || '::';

    await fastify.listen({ port, host });
    console.info(`Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
