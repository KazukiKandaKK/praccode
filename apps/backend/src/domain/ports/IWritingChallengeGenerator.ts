export interface WritingChallengeGenerateInput {
  userId: string;
  language: 'javascript' | 'typescript' | 'python' | 'go';
  difficulty: number;
  topic?: string;
}

export interface WritingChallengeGenerated {
  title: string;
  description: string;
  difficulty: number;
  testCode: string;
  starterCode?: string | null;
  sampleCode?: string | null;
}

export interface IWritingChallengeGenerator {
  generate(input: WritingChallengeGenerateInput): Promise<WritingChallengeGenerated>;
}
