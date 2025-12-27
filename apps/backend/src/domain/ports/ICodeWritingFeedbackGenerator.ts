export interface CodeWritingFeedbackInput {
  language: string;
  challengeTitle: string;
  challengeDescription: string;
  userCode: string;
  testCode: string;
  testOutput: string;
  passed: boolean;
}

export interface ICodeWritingFeedbackGenerator {
  generate(input: CodeWritingFeedbackInput): Promise<string>;
}
