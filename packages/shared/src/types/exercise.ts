export type Language = 'typescript' | 'javascript' | 'go' | 'ruby' | 'python' | 'rust';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type SourceType = 'embedded' | 'github';

export type LearningGoal =
  | 'responsibility'
  | 'data_flow'
  | 'error_handling'
  | 'testing'
  | 'performance'
  | 'security';

export interface Exercise {
  id: string;
  title: string;
  language: Language;
  difficulty: Difficulty;
  sourceType: SourceType;
  sourceUrl: string | null;
  code: string;
  learningGoals: LearningGoal[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExerciseQuestion {
  id: string;
  exerciseId: string;
  questionIndex: number;
  questionText: string;
  idealAnswerPoints: string[];
}

export interface ExerciseWithQuestions extends Exercise {
  questions: ExerciseQuestion[];
}

export interface ExerciseListItem {
  id: string;
  title: string;
  language: Language;
  difficulty: Difficulty;
  learningGoals: LearningGoal[];
}

export interface ExerciseFilters {
  language?: Language;
  difficulty?: Difficulty;
  page?: number;
  limit?: number;
}


