export interface Question {
  questionIndex: number;
  questionText: string;
}

export type ExerciseStatus = 'GENERATING' | 'READY' | 'FAILED';

export interface Exercise {
  id: string;
  title: string;
  language: string;
  difficulty: number;
  genre?: string | null;
  status: ExerciseStatus;
  code: string;
  learningGoals: string[];
  questions: Question[];

  getQuestion(index: number): Question | undefined;
}

export class ExerciseEntity implements Exercise {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly language: string,
    public readonly difficulty: number,
    public readonly genre: string | null,
    public readonly status: ExerciseStatus,
    public readonly code: string,
    public readonly learningGoals: string[],
    public readonly questions: Question[]
  ) {}

  getQuestion(index: number): Question | undefined {
    return this.questions.find((q) => q.questionIndex === index);
  }
}
