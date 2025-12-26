import { IExerciseGenerator, ExerciseGenerateInput, GeneratedExercise } from '../../domain/ports/IExerciseGenerator';
import { generateExercise } from '../../llm/generator';

export class ExerciseGeneratorService implements IExerciseGenerator {
  async generate(input: ExerciseGenerateInput): Promise<GeneratedExercise> {
    return generateExercise(input);
  }
}
