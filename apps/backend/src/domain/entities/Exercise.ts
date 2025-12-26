export interface Question {
    questionIndex: number;
    questionText: string;
}
  
export interface Exercise {
    id: string;
    code: string;
    learningGoals: string[];
    questions: Question[];

    getQuestion(index: number): Question | undefined;
}

export class ExerciseEntity implements Exercise {
    constructor(
        public readonly id: string,
        public readonly code: string,
        public readonly learningGoals: string[],
        public readonly questions: Question[]
    ) {}

    getQuestion(index: number): Question | undefined {
        return this.questions.find(q => q.questionIndex === index);
    }
}
