export type MentorAssessmentTaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

export type MentorAssessmentTask = {
  id: string;
  type: 'reading' | 'writing';
  title: string;
  language: string;
  difficulty: number;
  genre?: string | null;
  status: MentorAssessmentTaskStatus;
};

export interface IMentorAssessmentRepository {
  listTasks(userId: string): Promise<MentorAssessmentTask[]>;
}
