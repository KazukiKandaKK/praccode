const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

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
