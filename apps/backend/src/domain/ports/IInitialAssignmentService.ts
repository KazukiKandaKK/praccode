export interface IInitialAssignmentService {
  assignPresetsToUser(userId: string): Promise<void>;
}
