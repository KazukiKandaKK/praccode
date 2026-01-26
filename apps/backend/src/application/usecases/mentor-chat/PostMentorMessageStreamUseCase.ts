import { ApplicationError } from '@/application/errors/ApplicationError';
import type { IMentorChatGenerator } from '@/domain/ports/IMentorChatGenerator';
import type {
  IMentorThreadRepository,
  MentorMessageRecord,
} from '@/domain/ports/IMentorThreadRepository';
import type { IExerciseRepository } from '@/domain/ports/IExerciseRepository';
import type { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import { buildProgressSnapshot } from '@/application/usecases/mentor/buildProgressSnapshot';

// TODO: Consider moving this to env and truncating long messages if needed.
const HISTORY_LIMIT = 40;
const ASSISTANT_FAILURE_MESSAGE = '生成に失敗しました。もう一度送信してください。';

type StreamResult = {
  userMessage: MentorMessageRecord;
  stream: AsyncIterable<string>;
  completion: Promise<{
    assistantMessage: MentorMessageRecord;
    error?: Error;
  }>;
};

export class PostMentorMessageStreamUseCase {
  constructor(
    private readonly threadRepository: IMentorThreadRepository,
    private readonly submissionRepository: ISubmissionRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly chatGenerator: IMentorChatGenerator
  ) {}

  async execute(params: {
    threadId: string;
    userId: string;
    content: string;
  }): Promise<StreamResult> {
    const thread = await this.threadRepository.getThreadByIdForUser(
      params.threadId,
      params.userId
    );
    if (!thread) {
      throw new ApplicationError('Thread not found', 404);
    }

    const history = await this.threadRepository.listMessages(thread.id, HISTORY_LIMIT);

    const userMessage = await this.threadRepository.addMessage({
      threadId: thread.id,
      role: 'user',
      content: params.content,
    });

    const [exercise, submission, progress] = await Promise.all([
      thread.exerciseId ? this.exerciseRepository.findById(thread.exerciseId) : Promise.resolve(null),
      thread.submissionId
        ? this.submissionRepository.findById(thread.submissionId)
        : Promise.resolve(null),
      buildProgressSnapshot(this.submissionRepository, this.exerciseRepository, params.userId),
    ]);

    if (thread.exerciseId && !exercise) {
      throw new ApplicationError('Exercise not found', 404);
    }

    if (thread.submissionId) {
      if (!submission) {
        throw new ApplicationError('Submission not found', 404);
      }
      if (submission.userId !== params.userId) {
        throw new ApplicationError('Thread not found', 404);
      }
    }

    const context = {
      exercise: exercise
        ? {
            id: exercise.id,
            code: exercise.code,
            learningGoals: exercise.learningGoals,
            questions: exercise.questions,
          }
        : undefined,
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            answers: submission.answers.map((answer) => ({
              questionIndex: answer.questionIndex,
              answerText: answer.answerText,
              score: answer.score,
              level: answer.level,
            })),
            exercise: {
              id: submission.exercise.id,
              title: submission.exercise.title,
              code: submission.exercise.code,
              questions: submission.exercise.questions.map((q) => ({
                questionIndex: q.questionIndex,
                questionText: q.questionText,
                idealAnswerPoints: q.idealAnswerPoints,
              })),
            },
          }
        : undefined,
      progress,
      history: history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      userMessage: params.content,
    };

    const generator = this.chatGenerator.generateStream
      ? this.chatGenerator.generateStream(context)
      : (async function* () {
          const response = await this.chatGenerator.generate(context);
          yield response;
        }.call(this));

    let resolveCompletion: (value: {
      assistantMessage: MentorMessageRecord;
      error?: Error;
    }) => void = () => undefined;

    const completion = new Promise<{
      assistantMessage: MentorMessageRecord;
      error?: Error;
    }>((resolve) => {
      resolveCompletion = resolve;
    });

    const stream = (async function* (
      this: PostMentorMessageStreamUseCase
    ): AsyncIterable<string> {
      let assistantContent = '';

      try {
        for await (const chunk of generator) {
          assistantContent += chunk;
          yield chunk;
        }

        const assistantMessage = await this.threadRepository.addMessage({
          threadId: thread.id,
          role: 'assistant',
          content: assistantContent.trim(),
        });

        resolveCompletion({ assistantMessage });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const fallbackContent = assistantContent.trim() || ASSISTANT_FAILURE_MESSAGE;
        const assistantMessage = await this.threadRepository.addMessage({
          threadId: thread.id,
          role: 'assistant',
          content: fallbackContent,
          metadata: { error: true, reason: 'LLM_STREAM_FAILED' },
        });
        resolveCompletion({ assistantMessage, error: err });
      }
    }.call(this));

    return { userMessage, stream, completion };
  }
}
