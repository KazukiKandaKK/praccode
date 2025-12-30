import type {
  IMentorAssessmentRepository,
  MentorAssessmentTask,
} from '@/domain/ports/IMentorAssessmentRepository';

export type MentorAssessmentSummary = {
  total: number;
  completed: number;
  reading: { total: number; completed: number };
  writing: { total: number; completed: number };
};

export type MentorAssessmentStatus = {
  tasks: MentorAssessmentTask[];
  summary: MentorAssessmentSummary;
};

export class GetMentorAssessmentStatusUseCase {
  constructor(private readonly mentorAssessmentRepository: IMentorAssessmentRepository) {}

  async execute(userId: string): Promise<MentorAssessmentStatus> {
    const tasks = await this.mentorAssessmentRepository.listTasks(userId);
    const reading = tasks.filter((task) => task.type === 'reading');
    const writing = tasks.filter((task) => task.type === 'writing');
    const completed = tasks.filter((task) => task.status === 'COMPLETED').length;

    return {
      tasks,
      summary: {
        total: tasks.length,
        completed,
        reading: {
          total: reading.length,
          completed: reading.filter((task) => task.status === 'COMPLETED').length,
        },
        writing: {
          total: writing.length,
          completed: writing.filter((task) => task.status === 'COMPLETED').length,
        },
      },
    };
  }
}
