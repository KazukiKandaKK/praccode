import { z } from 'zod';
import type { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import type { IMentorThreadRepository } from '@/domain/ports/IMentorThreadRepository';
import { GenerateSubmissionFeedbackWithAgentUseCase } from '@/application/usecases/mentor/GenerateSubmissionFeedbackWithAgentUseCase';
import { CreateMentorThreadUseCase } from '@/application/usecases/mentor-chat/CreateMentorThreadUseCase';
import { PromptSanitizer } from '@/infrastructure/llm/prompt-sanitizer';

export type AutopilotToolContext = {
  userId: string;
  runId?: string;
};

export type AutopilotToolDefinition<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  handler: (ctx: AutopilotToolContext, args: z.infer<TInput>) => Promise<z.infer<TOutput>>;
  requiresUserId?: boolean;
};

export class AutopilotToolRegistry {
  private readonly tools = new Map<string, AutopilotToolDefinition<z.ZodTypeAny, z.ZodTypeAny>>();

  register<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
    tool: AutopilotToolDefinition<TInput, TOutput>
  ) {
    this.tools.set(tool.name, tool);
  }

  list() {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  get(name: string) {
    return this.tools.get(name);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: AutopilotToolContext
  ): Promise<Record<string, unknown>> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const mergedArgs = tool.requiresUserId === false ? args : { userId: ctx.userId, ...args };
    const parsedArgs = tool.inputSchema.parse(mergedArgs);
    const result = await tool.handler(ctx, parsedArgs as any);
    return tool.outputSchema.parse(result) as Record<string, unknown>;
  }
}

export function buildAutopilotToolRegistry(deps: {
  submissionRepository: ISubmissionRepository;
  mentorThreadRepository: IMentorThreadRepository;
  generateSubmissionFeedbackUseCase: GenerateSubmissionFeedbackWithAgentUseCase;
  createMentorThreadUseCase: CreateMentorThreadUseCase;
}) {
  const registry = new AutopilotToolRegistry();

  registry.register({
    name: 'getSubmissionContext',
    description: 'Fetch submission and exercise context for the current user.',
    inputSchema: z.object({ userId: z.string().uuid(), submissionId: z.string().uuid() }),
    outputSchema: z.object({
      submissionId: z.string(),
      exerciseId: z.string(),
      exerciseTitle: z.string(),
      questions: z.array(
        z.object({
          questionIndex: z.number(),
          questionText: z.string(),
          idealAnswerPoints: z.array(z.string()),
        })
      ),
      answers: z.array(
        z.object({
          questionIndex: z.number(),
          answerText: z.string().nullable(),
          score: z.number().nullable(),
          level: z.string().nullable(),
        })
      ),
    }),
    handler: async (_ctx, args) => {
      const submission = await deps.submissionRepository.findById(args.submissionId);
      if (!submission || submission.userId !== args.userId) {
        throw new Error('Submission not found');
      }
      return {
        submissionId: submission.id,
        exerciseId: submission.exercise.id,
        exerciseTitle: submission.exercise.title,
        questions: submission.exercise.questions.map((q) => ({
          questionIndex: q.questionIndex,
          questionText: q.questionText,
          idealAnswerPoints: q.idealAnswerPoints,
        })),
        answers: submission.answers.map((answer) => ({
          questionIndex: answer.questionIndex,
          answerText: answer.answerText,
          score: answer.score,
          level: answer.level,
        })),
      };
    },
  });

  registry.register({
    name: 'generateSubmissionFeedback',
    description: 'Generate mentor feedback for a submission using the agent.',
    inputSchema: z.object({ userId: z.string().uuid(), submissionId: z.string().uuid() }),
    outputSchema: z.object({ summary: z.string() }),
    handler: async (_ctx, args) => {
      const feedback = await deps.generateSubmissionFeedbackUseCase.execute({
        userId: args.userId,
        submissionId: args.submissionId,
      });
      const summary = feedback.overall || '提出フィードバックを生成しました。';
      return { summary };
    },
  });

  registry.register({
    name: 'ensureMentorThreadForSubmission',
    description: 'Ensure mentor thread exists for a submission.',
    inputSchema: z.object({ userId: z.string().uuid(), submissionId: z.string().uuid() }),
    outputSchema: z.object({ threadId: z.string() }),
    handler: async (_ctx, args) => {
      const thread = await deps.createMentorThreadUseCase.execute({
        userId: args.userId,
        submissionId: args.submissionId,
      });
      return { threadId: thread.id };
    },
  });

  registry.register({
    name: 'postMentorMessage',
    description: 'Post an assistant message into a mentor thread.',
    inputSchema: z.object({
      userId: z.string().uuid(),
      threadId: z.string().uuid(),
      content: z.string().min(1),
    }),
    outputSchema: z.object({ messageId: z.string() }),
    handler: async (_ctx, args) => {
      const thread = await deps.mentorThreadRepository.getThreadByIdForUser(
        args.threadId,
        args.userId
      );
      if (!thread) {
        throw new Error('Thread not found');
      }

      const sanitized = PromptSanitizer.sanitizeTemplate(args.content, 'autopilot_message');
      const message = await deps.mentorThreadRepository.addMessage({
        threadId: thread.id,
        role: 'assistant',
        content: sanitized,
        metadata: { source: 'autopilot' },
      });
      return { messageId: message.id };
    },
  });

  return registry;
}
