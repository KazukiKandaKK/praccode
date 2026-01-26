import type { ProgressSnapshot } from '@/mastra/mentorAgent';
import type { MentorMessageRole } from './IMentorThreadRepository';

export type MentorChatExerciseContext = {
  id: string;
  code: string;
  learningGoals: string[];
  questions: Array<{
    questionIndex: number;
    questionText: string;
  }>;
};

export type MentorChatSubmissionContext = {
  id: string;
  status: string;
  answers: Array<{
    questionIndex: number;
    answerText: string | null;
    score: number | null;
    level: string | null;
  }>;
  exercise: {
    id: string;
    title: string;
    code: string;
    questions: Array<{
      questionIndex: number;
      questionText: string;
      idealAnswerPoints: string[];
    }>;
  };
};

export type MentorChatHistoryMessage = {
  role: MentorMessageRole;
  content: string;
};

export type MentorChatContext = {
  exercise?: MentorChatExerciseContext;
  submission?: MentorChatSubmissionContext;
  progress: ProgressSnapshot;
  history: MentorChatHistoryMessage[];
  userMessage: string;
};

export interface IMentorChatGenerator {
  generate(context: MentorChatContext): Promise<string>;
  generateStream?(context: MentorChatContext): AsyncIterable<string>;
}
