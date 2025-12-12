const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

  async saveAnswers(submissionId: string, answers: Array<{ questionIndex: number; answerText: string }>) {
    const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}/answers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    return handleResponse<{ id: string; answers: Array<{ questionIndex: number; answerText: string }> }>(response);
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

