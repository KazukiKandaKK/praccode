import { IHintGenerator, GenerateHintContext } from '../../domain/ports/IHintGenerator';
import { generateHint as generateHintFromLLM } from './hint.js';

export class LLMHintGenerator implements IHintGenerator {
  async generate(context: GenerateHintContext): Promise<string> {
    // The old function can be reused directly as it matches the interface
    return await generateHintFromLLM({
      code: context.code,
      question: context.question,
      learningGoals: context.learningGoals,
    });
  }
}
