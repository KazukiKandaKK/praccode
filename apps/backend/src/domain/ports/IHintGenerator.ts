export interface GenerateHintContext {
  code: string;
  question: string;
  learningGoals: string[];
}

export interface IHintGenerator {
  generate(context: GenerateHintContext): Promise<string>;
}
