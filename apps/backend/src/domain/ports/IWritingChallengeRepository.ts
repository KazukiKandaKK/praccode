import { WritingChallenge } from '../entities/WritingChallenge';
import { WritingChallengeGenerateInput } from './IWritingChallengeGenerator';

export interface IWritingChallengeRepository {
  findAssignedReady(userId: string): Promise<WritingChallenge[]>;
  findAssignedById(id: string, userId: string): Promise<WritingChallenge | null>;
  createChallenge(data: {
    title: string;
    description: string;
    language: WritingChallenge['language'];
    difficulty: number;
    testCode: string;
    sampleCode?: string | null;
  }): Promise<WritingChallenge>;
  createGenerating(
    userId: string,
    language: WritingChallenge['language'],
    difficulty: number
  ): Promise<WritingChallenge>;
  updateGenerated(challengeId: string, generated: WritingChallengeGenerateInput & {
    title: string;
    description: string;
    testCode: string;
    starterCode?: string | null;
    sampleCode?: string | null;
  }): Promise<void>;
  markFailed(challengeId: string): Promise<void>;
}
