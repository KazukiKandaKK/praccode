export interface ExerciseGenerateInput {
  language: string;
  difficulty: number;
  genre: string;
}

export interface GeneratedExercise {
  title: string;
  code: string;
  learningGoals: string[];
  questions: { questionText: string; idealAnswerPoints: string[] }[];
}

export interface IExerciseGenerator {
  generate(input: ExerciseGenerateInput): Promise<GeneratedExercise>;
}
