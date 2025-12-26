import { Submission } from '../entities/Submission';

export interface ISubmissionRepository {
  findCompletedByUserId(userId: string): Promise<Submission[]>;
}
