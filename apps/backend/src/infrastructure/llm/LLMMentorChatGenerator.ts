import type { IMentorChatGenerator, MentorChatContext } from '@/domain/ports/IMentorChatGenerator';
import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

const DEFAULT_MAX_TOKENS = 700;

const wrapUserInput = (value: string) =>
  `---USER_INPUT_START---\n${value}\n---USER_INPUT_END---`;

// TODO: Add size-based truncation for code/answers/history if prompt grows too large.
const sanitizeOrMask = (value: string, fieldName: string, allowBase64 = false): string => {
  try {
    return PromptSanitizer.sanitize(value, fieldName, { allowBase64 });
  } catch {
    return '（安全上の理由で内容を省略しました）';
  }
};

const buildExerciseContext = (context: MentorChatContext['exercise']): string => {
  if (!context) return 'なし';

  const code = sanitizeOrMask(context.code, 'CODE', true);
  const questions =
    context.questions.length > 0
      ? context.questions
          .map((q) => `- [${q.questionIndex}] ${q.questionText}`)
          .join('\n')
      : '（設問なし）';
  const goals = context.learningGoals.length > 0 ? context.learningGoals.join(', ') : '未設定';

  return [
    `課題ID: ${context.id}`,
    `学習ゴール: ${goals}`,
    'コード:',
    wrapUserInput(code),
    '設問:',
    questions,
  ].join('\n');
};

const buildSubmissionContext = (context: MentorChatContext['submission']): string => {
  if (!context) return 'なし';

  const answerLines =
    context.answers.length > 0
      ? context.answers
          .map((answer) => {
            const text = sanitizeOrMask(answer.answerText ?? '未回答', 'USER_ANSWER');
            const score = answer.score ?? '未採点';
            const level = answer.level ?? '未評価';
            return `- Q${answer.questionIndex}: ${wrapUserInput(text)} (score: ${score}, level: ${level})`;
          })
          .join('\n')
      : '（回答なし）';

  const questions =
    context.exercise.questions.length > 0
      ? context.exercise.questions
          .map(
            (q) =>
              `- [${q.questionIndex}] ${q.questionText} | 理想回答ポイント: ${q.idealAnswerPoints.join(
                ', '
              )}`
          )
          .join('\n')
      : '（設問なし）';

  return [
    `提出ID: ${context.id}`,
    `ステータス: ${context.status}`,
    `課題: ${context.exercise.title}`,
    '設問:',
    questions,
    '回答:',
    answerLines,
  ].join('\n');
};

const buildProgressContext = (context: MentorChatContext['progress']): string => {
  const weakAspects =
    context.weakAspects.length > 0
      ? context.weakAspects.map((a) => `${a.aspect}: ${a.score}`).join(', ')
      : '未評価';
  const recent =
    context.recentSubmissions.length > 0
      ? context.recentSubmissions
          .map((s) => `- ${s.exerciseTitle} (${s.averageScore}点, ${s.updatedAt})`)
          .join('\n')
      : '（なし）';

  return [
    `全問題数: ${context.totalExercises}`,
    `完了: ${context.completedExercises}`,
    `平均スコア: ${context.averageScore}`,
    `観点別: ${JSON.stringify(context.aspectScores)}`,
    `弱点候補: ${weakAspects}`,
    '直近の提出:',
    recent,
  ].join('\n');
};

const buildHistory = (context: MentorChatContext['history']): string => {
  if (context.length === 0) return '（なし）';
  return context
    .map((message) => `${message.role}: ${wrapUserInput(message.content)}`)
    .join('\n');
};

export class LLMMentorChatGenerator implements IMentorChatGenerator {
  async generate(context: MentorChatContext): Promise<string> {
    const template = loadPrompt('mentor-chat-prompt.md');
    const sanitizedMessage = PromptSanitizer.sanitize(context.userMessage, 'USER_MESSAGE');

    const prompt = renderPrompt(template, {
      EXERCISE_CONTEXT: buildExerciseContext(context.exercise),
      SUBMISSION_CONTEXT: buildSubmissionContext(context.submission),
      PROGRESS_CONTEXT: buildProgressContext(context.progress),
      CONVERSATION_HISTORY: buildHistory(context.history),
      USER_MESSAGE: wrapUserInput(sanitizedMessage),
    });

    const response = await generateWithOllama(prompt, {
      temperature: 0.4,
      maxTokens: DEFAULT_MAX_TOKENS,
    });

    return response.trim();
  }
}
