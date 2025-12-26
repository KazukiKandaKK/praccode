export interface Answer {
  score: number | null;
  aspects: Record<string, number> | null;
}

export interface Submission {
  exerciseId: string;
  updatedAt: Date;
  exercise: {
    title: string;
  };
  answers: Answer[];
}
