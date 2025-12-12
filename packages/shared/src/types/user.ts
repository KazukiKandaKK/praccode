export type UserRole = 'admin' | 'learner';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProgress {
  userId: string;
  totalExercises: number;
  completedExercises: number;
  averageScore: number;
  aspectScores: Record<string, number>;
  recentSubmissions: RecentSubmission[];
}

export interface RecentSubmission {
  exerciseId: string;
  exerciseTitle: string;
  submittedAt: Date;
  averageScore: number;
}

export interface AspectScore {
  aspect: string;
  score: number;
  count: number;
}


