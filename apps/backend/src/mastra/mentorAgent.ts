/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Agent } from '@mastra/core/agent';
import type { MastraMemory, MastraLanguageModel } from '@mastra/core';
import { z } from 'zod';
import type { SubmissionDetail } from '@/domain/ports/ISubmissionRepository';
import { MastraOllamaModel } from './ollamaModel.js';

export type PresetAnswer = { question: string; answer: string };

export type ProgressSnapshot = {
  totalExercises: number;
  completedExercises: number;
  averageScore: number;
  aspectScores: Record<string, number>;
  weakAspects: Array<{ aspect: string; score: number }>;
  recentSubmissions: Array<{
    exerciseTitle: string;
    averageScore: number;
    updatedAt: string;
  }>;
};

export type UserProfileSnapshot = {
  id: string;
  name: string | null;
  email: string;
  role: 'ADMIN' | 'LEARNER';
};

export const learningPlanSchema = z.object({
  summary: z.string(),
  focusAreas: z.array(z.string()).min(1),
  weeklyPlan: z
    .array(
      z.object({
        title: z.string(),
        goals: z.array(z.string()).min(1),
        activities: z.array(z.string()).min(1),
        deliverables: z.array(z.string()).min(1),
      })
    )
    .min(1),
  quickTests: z
    .array(
      z.object({
        name: z.string(),
        task: z.string(),
        expectedAnswer: z.string(),
        evaluationCriteria: z.array(z.string()).min(1),
      })
    )
    .min(1),
  checkpoints: z.array(
    z.object({
      metric: z.string(),
      target: z.string(),
      when: z.string(),
    })
  ),
  reminders: z.array(z.string()).optional(),
});

export type LearningPlan = z.infer<typeof learningPlanSchema>;

export const mentorFeedbackSchema = z.object({
  overall: z.string(),
  strengths: z.array(z.string()).min(1),
  improvements: z
    .array(
      z.object({
        area: z.string(),
        advice: z.string(),
        example: z.string().optional(),
      })
    )
    .min(1),
  suggestedChecks: z
    .array(
      z.object({
        name: z.string(),
        prompt: z.string(),
        whatToLookFor: z.array(z.string()).min(1),
      })
    )
    .optional(),
  nextFocus: z.array(z.string()).min(1),
});

export type MentorFeedback = z.infer<typeof mentorFeedbackSchema>;

type LearningPlanInput = {
  profile: UserProfileSnapshot;
  progress: ProgressSnapshot;
  presetAnswers: PresetAnswer[];
  targetLanguage?: string;
  threadId?: string;
};

type FeedbackInput = {
  submission: SubmissionDetail;
  progress: ProgressSnapshot;
  threadId?: string;
};

type NextLearningPlanInput = LearningPlanInput & {
  previousPlan: LearningPlan;
  latestFeedback: MentorFeedback;
};

export class MentorAgent {
  private readonly agent: Agent;

  constructor(opts: { model?: MastraLanguageModel; memory?: MastraMemory } = {}) {
    const { model = new MastraOllamaModel(), memory } = opts;

    this.agent = new Agent({
      name: 'praccode-mentor',
      model,
      memory,
      instructions: [
        'あなたはコードリーディングとレビューをサポートするメンターです。',
        '回答は日本語で、実務的で具体的な提案を行います。',
        '学習計画では弱点補強と継続性を両立させ、簡潔なチェック課題を添付します。',
        '提出物フィードバックでは過剰な褒め言葉を避け、具体的な改善手順と確認ポイントを示します。',
        '出力は要求されたスキーマに合わせて構造化してください。',
      ].join('\n'),
    });
  }

  async generateLearningPlan(input: LearningPlanInput): Promise<LearningPlan> {
    const message = this.buildPlanPrompt(input);
    const threadId = input.threadId || `plan-${input.profile.id}`;
    const result = await this.agent.generate(
      [{ role: 'user', content: message }],
      {
        output: learningPlanSchema,
        temperature: 0.2,
        resourceId: input.profile.id,
        threadId,
      }
    );
    return result.object;
  }

  async generateNextLearningPlan(input: NextLearningPlanInput): Promise<LearningPlan> {
    const message = this.buildNextPlanPrompt(input);
    const threadId = input.threadId || `plan-next-${input.profile.id}`;
    const result = await this.agent.generate(
      [{ role: 'user', content: message }],
      {
        output: learningPlanSchema,
        temperature: 0.2,
        resourceId: input.profile.id,
        threadId,
      }
    );
    return result.object;
  }

  async generateSubmissionFeedback(input: FeedbackInput): Promise<MentorFeedback> {
    const message = this.buildFeedbackPrompt(input);
    const threadId = input.threadId || `feedback-${input.submission.id}`;
    const result = await this.agent.generate(
      [{ role: 'user', content: message }],
      {
        output: mentorFeedbackSchema,
        temperature: 0.1,
        resourceId: input.submission.userId,
        threadId,
      }
    );
    return result.object;
  }

  private buildPlanPrompt(input: LearningPlanInput): string {
    const { profile, progress, presetAnswers, targetLanguage } = input;

    const weakPoints =
      progress.weakAspects.length > 0
        ? progress.weakAspects.map((a) => `${a.aspect}: ${a.score}`).join(', ')
        : '未評価';

    const recent = progress.recentSubmissions
      .map(
        (s) =>
          `- ${s.exerciseTitle} (score: ${s.averageScore}, updated: ${s.updatedAt})`
      )
      .join('\n');

    const answers = presetAnswers
      .map((qa, idx) => `${idx + 1}. Q: ${qa.question}\n   A: ${qa.answer}`)
      .join('\n');

    return [
      `学習者: ${profile.name ?? '未設定'} (${profile.email}, role: ${profile.role})`,
      targetLanguage ? `希望言語/重点: ${targetLanguage}` : '',
      '進捗サマリ:',
      `- 全問題数: ${progress.totalExercises}`,
      `- 完了: ${progress.completedExercises}`,
      `- 平均スコア: ${progress.averageScore}`,
      `- 観点別: ${JSON.stringify(progress.aspectScores)}`,
      `- 弱点候補: ${weakPoints}`,
      '直近の提出:',
      recent || '- なし',
      '事前質問と回答:',
      answers || '- なし',
      '出力要件:',
      '1) focusAreas に弱点と目標をまとめる',
      '2) weeklyPlan は週ごとのフォーカス/具体的活動/アウトプットを含める（最大4週想定で短く）',
      '3) quickTests は理解確認用の即席課題と採点観点を示す',
      '4) checkpoints で測定指標といつ確認するかを示す',
      '5) reminders は短いメモで良い（任意）',
      '常にJSONスキーマに沿って簡潔に。'
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildNextPlanPrompt(input: NextLearningPlanInput): string {
    const { profile, progress, presetAnswers, targetLanguage, previousPlan, latestFeedback } =
      input;

    const weakPoints =
      progress.weakAspects.length > 0
        ? progress.weakAspects.map((a) => `${a.aspect}: ${a.score}`).join(', ')
        : '未評価';

    const recent = progress.recentSubmissions
      .map(
        (s) =>
          `- ${s.exerciseTitle} (score: ${s.averageScore}, updated: ${s.updatedAt})`
      )
      .join('\n');

    const answers = presetAnswers
      .map((qa, idx) => `${idx + 1}. Q: ${qa.question}\n   A: ${qa.answer}`)
      .join('\n');

    const previousPlanSummary = [
      `- summary: ${previousPlan.summary}`,
      `- focusAreas: ${previousPlan.focusAreas.join(', ')}`,
      `- weeklyPlan: ${previousPlan.weeklyPlan
        .map((week, idx) => `${idx + 1}. ${week.title}`)
        .join(' / ')}`,
      `- quickTests: ${previousPlan.quickTests.map((test) => test.name).join(', ')}`,
      `- checkpoints: ${previousPlan.checkpoints
        .map((cp) => `${cp.metric} (${cp.when})`)
        .join(', ')}`,
      previousPlan.reminders && previousPlan.reminders.length > 0
        ? `- reminders: ${previousPlan.reminders.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const feedbackSummary = [
      `- overall: ${latestFeedback.overall}`,
      `- strengths: ${latestFeedback.strengths.join(', ')}`,
      `- improvements: ${latestFeedback.improvements
        .map((item) => `${item.area}: ${item.advice}`)
        .join(' / ')}`,
      `- nextFocus: ${latestFeedback.nextFocus.join(', ')}`,
    ].join('\n');

    return [
      `学習者: ${profile.name ?? '未設定'} (${profile.email}, role: ${profile.role})`,
      targetLanguage ? `希望言語/重点: ${targetLanguage}` : '',
      '進捗サマリ:',
      `- 全問題数: ${progress.totalExercises}`,
      `- 完了: ${progress.completedExercises}`,
      `- 平均スコア: ${progress.averageScore}`,
      `- 観点別: ${JSON.stringify(progress.aspectScores)}`,
      `- 弱点候補: ${weakPoints}`,
      '直近の提出:',
      recent || '- なし',
      '事前質問と回答:',
      answers || '- なし',
      '直近の学習計画:',
      previousPlanSummary || '- なし',
      '最新のフィードバック:',
      feedbackSummary || '- なし',
      '出力要件:',
      '1) 最新フィードバックを踏まえて次の学習計画に更新する',
      '2) focusAreas に弱点と次の目標をまとめる',
      '3) weeklyPlan は週ごとのフォーカス/具体的活動/アウトプットを含める（最大4週想定で短く）',
      '4) quickTests は理解確認用の即席課題と採点観点を示す',
      '5) checkpoints で測定指標といつ確認するかを示す',
      '6) reminders は短いメモで良い（任意）',
      '常にJSONスキーマに沿って簡潔に。',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildFeedbackPrompt(input: FeedbackInput): string {
    const { submission, progress } = input;
    const exerciseInfo = [
      `課題: ${submission.exercise.title}`,
      `設問:`,
      submission.exercise.questions
        .map(
          (q) =>
            `  - [${q.questionIndex}] ${q.questionText} | 理想回答ポイント: ${q.idealAnswerPoints.join(', ')}`
        )
        .join('\n'),
    ].join('\n');

    const answers = submission.answers
      .map(
        (a) =>
          `- Q${a.questionIndex}: ${a.answerText ?? '未回答'}`
      )
      .join('\n');

    const weakPoints =
      progress.weakAspects.length > 0
        ? progress.weakAspects.map((a) => `${a.aspect}: ${a.score}`).join(', ')
        : '未評価';

    return [
      exerciseInfo,
      '回答:',
      answers,
      '進捗サマリ:',
      `- 平均スコア: ${progress.averageScore}`,
      `- 弱点候補: ${weakPoints}`,
      'フィードバック要件:',
      '- overallで全体所感を1文で。',
      '- strengthsは具体的な観点で2~3点。',
      '- improvementsは優先度高い順に、手順付きで示す。',
      '- suggestedChecks でセルフチェック用の簡易プロンプトと見るべき点を示す。',
      '- nextFocus で次の演習や観点を短く提示。',
      '冗長にならないように簡潔に。'
    ].join('\n');
  }

  getModelId(): string {
    // Agent.llm exposes getModelId()
    // @ts-expect-error Mastra types keep llm private; rely on runtime presence
    return this.agent.llm?.getModelId?.() ?? 'unknown';
  }
}
