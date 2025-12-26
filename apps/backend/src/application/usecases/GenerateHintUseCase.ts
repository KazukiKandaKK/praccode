import { IExerciseRepository } from '../../domain/ports/IExerciseRepository';
import { IHintRepository } from '../../domain/ports/IHintRepository';
import { IHintGenerator } from '../../domain/ports/IHintGenerator';
import { HintEntity } from '../../domain/entities/Hint';
import { ApplicationError } from '../errors/ApplicationError';

export interface GenerateHintInput {
    exerciseId: string;
    questionIndex: number;
    userId: string;
}

export class GenerateHintUseCase {
    constructor(
        private readonly exerciseRepository: IExerciseRepository,
        private readonly hintRepository: IHintRepository,
        private readonly hintGenerator: IHintGenerator
    ) {}

    async execute(input: GenerateHintInput): Promise<string> {
        const exercise = await this.exerciseRepository.findById(input.exerciseId);
        if (!exercise) {
            throw new ApplicationError('Exercise not found', 404);
        }

        const question = exercise.getQuestion(input.questionIndex);
        if (!question) {
            throw new ApplicationError('Question not found', 404);
        }

        const hintText = await this.hintGenerator.generate({
            code: exercise.code,
            question: question.questionText,
            learningGoals: exercise.learningGoals,
        });

        const hint = new HintEntity(
            input.exerciseId,
            input.userId,
            input.questionIndex,
            hintText
        );

        await this.hintRepository.save(hint);

        return hintText;
    }
}
