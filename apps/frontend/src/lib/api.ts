import type { MentorMessage, MentorPostMessageResult, MentorThreadWithMessages } from '@praccode/shared';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

export type LearningPlan = {
  summary: string;
  focusAreas: string[];
  weeklyPlan: Array<{
    title: string;
    goals: string[];
    activities: string[];
    deliverables: string[];
  }>;
  quickTests: Array<{
    name: string;
    task: string;
    expectedAnswer: string;
    evaluationCriteria: string[];
  }>;
  checkpoints: Array<{
    metric: string;
    target: string;
    when: string;
  }>;
  reminders?: string[];
};

export type LearningPlanRecord = {
  id: string;
  userId: string;
  plan: LearningPlan;
  presetAnswers: Array<{ question: string; answer: string }>;
  targetLanguage: string | null;
  modelId: string | null;
  temperature: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MentorFeedback = {
  overall: string;
  strengths: string[];
  improvements: Array<{ area: string; advice: string; example?: string }>;
  suggestedChecks?: Array<{ name: string; prompt: string; whatToLookFor: string[] }>;
  nextFocus: string[];
};

export type MentorFeedbackRecord = {
  id: string;
  userId: string;
  submissionId: string;
  feedback: MentorFeedback;
  modelId: string | null;
  temperature: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MentorWorkflowStep = 'PLAN' | 'DO' | 'CHECK' | 'NEXT_PLAN';

export type MentorWorkflowState = {
  userId: string;
  step: MentorWorkflowStep;
  updatedAt: string;
};

export type MentorMetricSummary = {
  aspect: string;
  currentAvg: number;
  previousAvg: number | null;
  delta: number | null;
  sampleSize: number;
};

export type MentorSummary = {
  metrics: MentorMetricSummary[];
  strengths: Array<{ label: string; count: number }>;
  improvements: Array<{ label: string; count: number }>;
  recentAdvice: Array<{ area: string; advice: string; createdAt: string }>;
};

export type MentorAssessmentTaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

export type MentorAssessmentTask = {
  id: string;
  type: 'reading' | 'writing';
  title: string;
  language: string;
  difficulty: number;
  genre?: string | null;
  status: MentorAssessmentTaskStatus;
};

export type MentorAssessmentSummary = {
  total: number;
  completed: number;
  reading: { total: number; completed: number };
  writing: { total: number; completed: number };
};

export type MentorAssessmentStatus = {
  tasks: MentorAssessmentTask[];
  summary: MentorAssessmentSummary;
};

export type MentorSprint = {
  id: string;
  userId: string;
  learningPlanId: string | null;
  sequence: number;
  goal: string;
  focusAreas: string[];
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'COMPLETED';
  updatedAt: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new ApiError(error.message || 'An error occurred', response.status);
  }
  return response.json();
}

const userIdHeader = (userId: string) => ({ 'x-user-id': userId });

const parseSseEvent = (raw: string): { event: string; data: string } | null => {
  const lines = raw.split('\n');
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (!event && dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
};

export type MentorChatStreamEvent =
  | { type: 'start'; userMessage: MentorMessage }
  | { type: 'delta'; delta: string }
  | { type: 'done'; assistantMessage: MentorMessage }
  | { type: 'error'; message: string; assistantMessage?: MentorMessage };

export const api = {
  // Mentor
  async generateLearningPlan(params: {
    userId: string;
    presetAnswers: Array<{ question: string; answer: string }>;
    targetLanguage?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/mentor/learning-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<LearningPlan>(response);
  },

  async generateNextLearningPlan(params: { userId: string }) {
    const response = await fetch(`${API_BASE_URL}/mentor/learning-plan/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<LearningPlan>(response);
  },

  async getLatestLearningPlan(userId: string) {
    const response = await fetch(
      `${API_BASE_URL}/mentor/learning-plan/latest?userId=${encodeURIComponent(userId)}`,
      { cache: 'no-store' }
    );
    return handleResponse<LearningPlanRecord>(response);
  },

  async getLearningPlanHistory(userId: string, limit = 20) {
    const response = await fetch(
      `${API_BASE_URL}/mentor/learning-plan/history?userId=${encodeURIComponent(userId)}&limit=${limit}`,
      { cache: 'no-store' }
    );
    return handleResponse<LearningPlanRecord[]>(response);
  },

  async getMentorFeedbackHistory(userId: string, limit = 20) {
    const response = await fetch(
      `${API_BASE_URL}/mentor/feedback/history?userId=${encodeURIComponent(userId)}&limit=${limit}`,
      { cache: 'no-store' }
    );
    return handleResponse<MentorFeedbackRecord[]>(response);
  },

  async getMentorWorkflowState(userId: string) {
    const response = await fetch(
      `${API_BASE_URL}/mentor/workflow?userId=${encodeURIComponent(userId)}`,
      { cache: 'no-store' }
    );
    return handleResponse<MentorWorkflowState>(response);
  },

  async updateMentorWorkflowState(params: { userId: string; step: MentorWorkflowStep }) {
    const response = await fetch(`${API_BASE_URL}/mentor/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<MentorWorkflowState>(response);
  },

  async getMentorSummary(userId: string) {
    const response = await fetch(
      `${API_BASE_URL}/mentor/summary?userId=${encodeURIComponent(userId)}`,
      { cache: 'no-store' }
    );
    return handleResponse<MentorSummary>(response);
  },

  async getMentorAssessmentStatus(userId: string) {
    const response = await fetch(
      `${API_BASE_URL}/mentor/assessment?userId=${encodeURIComponent(userId)}`,
      { cache: 'no-store' }
    );
    return handleResponse<MentorAssessmentStatus>(response);
  },

  async getCurrentMentorSprint(userId: string) {
    const response = await fetch(
      `${API_BASE_URL}/mentor/sprint/current?userId=${encodeURIComponent(userId)}`,
      { cache: 'no-store' }
    );
    return handleResponse<MentorSprint>(response);
  },

  async createMentorThread(params: {
    userId: string;
    exerciseId?: string;
    submissionId?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/mentor/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userIdHeader(params.userId) },
      body: JSON.stringify({
        exerciseId: params.exerciseId,
        submissionId: params.submissionId,
      }),
    });
    return handleResponse<{ threadId: string }>(response);
  },

  async getMentorThread(threadId: string, userId: string) {
    const response = await fetch(`${API_BASE_URL}/mentor/threads/${threadId}`, {
      cache: 'no-store',
      headers: userIdHeader(userId),
    });
    return handleResponse<MentorThreadWithMessages>(response);
  },

  async postMentorMessage(threadId: string, userId: string, content: string) {
    const response = await fetch(`${API_BASE_URL}/mentor/threads/${threadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userIdHeader(userId) },
      body: JSON.stringify({ content }),
    });
    return handleResponse<MentorPostMessageResult>(response);
  },

  async *streamMentorMessage(params: {
    threadId: string;
    userId: string;
    content: string;
    signal?: AbortSignal;
  }): AsyncIterable<MentorChatStreamEvent> {
    const response = await fetch(
      `${API_BASE_URL}/mentor/threads/${params.threadId}/messages/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userIdHeader(params.userId) },
        body: JSON.stringify({ content: params.content }),
        signal: params.signal,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new ApiError(error.message || 'An error occurred', response.status);
    }

    if (!response.body) {
      throw new ApiError('Stream response is empty', 500);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const parsed = parseSseEvent(part);
        if (!parsed) continue;
        const payload = parsed.data ? JSON.parse(parsed.data) : {};

        switch (parsed.event) {
          case 'start':
            yield { type: 'start', userMessage: payload.userMessage as MentorMessage };
            break;
          case 'delta':
            yield { type: 'delta', delta: String(payload.delta ?? '') };
            break;
          case 'done':
            yield { type: 'done', assistantMessage: payload.assistantMessage as MentorMessage };
            break;
          case 'error':
            yield {
              type: 'error',
              message: String(payload.message ?? 'メンターの応答生成に失敗しました'),
              assistantMessage: payload.assistantMessage as MentorMessage | undefined,
            };
            break;
          default:
            break;
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining) {
      const parsed = parseSseEvent(remaining);
      if (parsed) {
        const payload = parsed.data ? JSON.parse(parsed.data) : {};
        if (parsed.event === 'done') {
          yield { type: 'done', assistantMessage: payload.assistantMessage as MentorMessage };
        }
        if (parsed.event === 'error') {
          yield {
            type: 'error',
            message: String(payload.message ?? 'メンターの応答生成に失敗しました'),
            assistantMessage: payload.assistantMessage as MentorMessage | undefined,
          };
        }
      }
    }
  },

  async logLearningTime(params: {
    userId: string;
    durationSec: number;
    source: string;
    startedAt?: string;
    endedAt?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/learning-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<{ ok: boolean }>(response);
  },

  async getLearningTimeDaily(userId: string, days = 14) {
    const response = await fetch(
      `${API_BASE_URL}/learning-time/daily?userId=${encodeURIComponent(userId)}&days=${days}`,
      { cache: 'no-store' }
    );
    return handleResponse<Array<{ date: string; durationSec: number }>>(response);
  },

  // Exercises
  async getExercises(params?: { language?: string; difficulty?: number; page?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.language) searchParams.set('language', params.language);
    if (params?.difficulty) searchParams.set('difficulty', String(params.difficulty));
    if (params?.page) searchParams.set('page', String(params.page));

    const response = await fetch(`${API_BASE_URL}/exercises?${searchParams}`);
    return handleResponse<{
      exercises: Array<{
        id: string;
        title: string;
        language: string;
        difficulty: number;
        learningGoals: string[];
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(response);
  },

  async getExercise(id: string) {
    const response = await fetch(`${API_BASE_URL}/exercises/${id}`);
    return handleResponse<{
      id: string;
      title: string;
      language: string;
      difficulty: number;
      code: string;
      learningGoals: string[];
      questions: Array<{
        id: string;
        questionIndex: number;
        questionText: string;
      }>;
    }>(response);
  },

  // Submissions
  async createSubmission(exerciseId: string, userId: string) {
    const response = await fetch(`${API_BASE_URL}/exercises/${exerciseId}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return handleResponse<{
      id: string;
      exerciseId: string;
      userId: string;
      status: string;
      answers: Array<{
        id: string;
        questionIndex: number;
        answerText: string;
      }>;
    }>(response);
  },

  async getSubmission(id: string) {
    const response = await fetch(`${API_BASE_URL}/submissions/${id}`);
    return handleResponse<{
      id: string;
      exerciseId: string;
      status: string;
      answers: Array<{
        id: string;
        questionIndex: number;
        answerText: string;
        score: number | null;
        level: string | null;
        llmFeedback: string | null;
        aspects: Record<string, number> | null;
      }>;
      exercise: {
        id: string;
        title: string;
        code: string;
        questions: Array<{
          id: string;
          questionIndex: number;
          questionText: string;
        }>;
      };
    }>(response);
  },

  async saveAnswers(
    submissionId: string,
    answers: Array<{ questionIndex: number; answerText: string }>
  ) {
    const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}/answers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    return handleResponse<{
      id: string;
      answers: Array<{ questionIndex: number; answerText: string }>;
    }>(response);
  },

  async evaluateSubmission(submissionId: string) {
    const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}/evaluate`, {
      method: 'POST',
    });
    return handleResponse<{
      submissionId: string;
      scores: Array<{
        questionIndex: number;
        score: number;
        level: string;
        feedback: string;
        aspects: Record<string, number>;
      }>;
    }>(response);
  },

  // Progress
  async getProgress(userId: string) {
    const response = await fetch(`${API_BASE_URL}/me/progress?userId=${userId}`);
    return handleResponse<{
      userId: string;
      totalExercises: number;
      completedExercises: number;
      averageScore: number;
      aspectScores: Record<string, number>;
      recentSubmissions: Array<{
        exerciseId: string;
        exerciseTitle: string;
        submittedAt: string;
        averageScore: number;
      }>;
    }>(response);
  },

  // Hints
  async getHint(exerciseId: string, questionIndex: number, userId: string) {
    const response = await fetch(`${API_BASE_URL}/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId, questionIndex, userId }),
    });
    return handleResponse<{ hint: string }>(response);
  },
};
