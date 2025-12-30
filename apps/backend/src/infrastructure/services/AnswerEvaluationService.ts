import { IAnswerEvaluationService, EvaluateAnswerInput, EvaluateAnswerResult } from '../../domain/ports/IAnswerEvaluationService';
import { evaluateAnswer } from '../llm/evaluator';

export class AnswerEvaluationService implements IAnswerEvaluationService {
  async evaluate(input: EvaluateAnswerInput): Promise<EvaluateAnswerResult> {
    const result = await evaluateAnswer({
      code: input.code,
      question: input.question,
      idealPoints: input.idealPoints,
      userAnswer: input.userAnswer,
    });

    return {
      score: result.score,
      level: result.level,
      feedback: result.feedback,
      aspects: result.aspects || {},
    };
  }
}
