export interface WritingChallenge {
  id: string;
  title: string;
  description: string;
  language: 'javascript' | 'typescript' | 'python' | 'go';
  difficulty: number;
  status: 'GENERATING' | 'READY' | 'FAILED';
  testCode: string;
  starterCode?: string | null;
  sampleCode?: string | null;
  assignedToId: string;
}
