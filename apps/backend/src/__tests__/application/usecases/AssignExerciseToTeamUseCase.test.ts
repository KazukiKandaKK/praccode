import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { AssignExerciseToTeamUseCase } from '@/application/usecases/team/AssignExerciseToTeamUseCase';
import { ITeamRepository } from '@/domain/ports/ITeamRepository';
import { IExerciseAssignmentRepository } from '@/domain/ports/IExerciseAssignmentRepository';
import { IUserAccountRepository } from '@/domain/ports/IUserAccountRepository';
import { ApplicationError } from '@/application/errors/ApplicationError';

const mockTeamRepo: Mocked<ITeamRepository> = {
  getTeamsForUser: vi.fn(),
  getMembersByTeamIds: vi.fn(),
  isMemberOfTeam: vi.fn(),
};

const mockExerciseAssignmentRepo: Mocked<IExerciseAssignmentRepository> = {
  findOwnedReadyExercises: vi.fn(),
  isOwnedExercise: vi.fn(),
  copyExerciseToUsers: vi.fn(),
};

const mockUserAccountRepo: Mocked<IUserAccountRepository> = {
  getProfile: vi.fn(),
  updateName: vi.fn(),
  findByEmail: vi.fn(),
  findByIdWithPassword: vi.fn(),
  updatePassword: vi.fn(),
  updateEmail: vi.fn(),
};

describe('AssignExerciseToTeamUseCase', () => {
  let useCase: AssignExerciseToTeamUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AssignExerciseToTeamUseCase(
      mockTeamRepo,
      mockExerciseAssignmentRepo,
      mockUserAccountRepo
    );
  });

  it('リクエスターがADMINでない場合は403を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'requester-1',
      email: 'a@example.com',
      name: 'A',
      image: null,
      role: 'LEARNER',
      hasPassword: true,
      oauthProviders: [],
    });

    await expect(
      useCase.execute({ requesterId: 'requester-1', teamId: 'team-1', exerciseId: 'ex-1' })
    ).rejects.toMatchObject({ statusCode: 403 } as Partial<ApplicationError>);
  });

  it('リクエスターがそのチームに所属していない場合は404を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'requester-1',
      email: 'a@example.com',
      name: 'A',
      image: null,
      role: 'ADMIN',
      hasPassword: true,
      oauthProviders: [],
    });
    mockTeamRepo.isMemberOfTeam.mockResolvedValue(false);

    await expect(
      useCase.execute({ requesterId: 'requester-1', teamId: 'team-1', exerciseId: 'ex-1' })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<ApplicationError>);
  });

  it('自分が作成していない演習の場合は404を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'requester-1',
      email: 'a@example.com',
      name: 'A',
      image: null,
      role: 'ADMIN',
      hasPassword: true,
      oauthProviders: [],
    });
    mockTeamRepo.isMemberOfTeam.mockResolvedValue(true);
    mockExerciseAssignmentRepo.isOwnedExercise.mockResolvedValue(false);

    await expect(
      useCase.execute({ requesterId: 'requester-1', teamId: 'team-1', exerciseId: 'ex-1' })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<ApplicationError>);
  });

  it('チーム内のLEARNERにのみ演習を割り当てる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'requester-1',
      email: 'admin@example.com',
      name: 'Admin',
      image: null,
      role: 'ADMIN',
      hasPassword: true,
      oauthProviders: [],
    });
    mockTeamRepo.isMemberOfTeam.mockResolvedValue(true);
    mockExerciseAssignmentRepo.isOwnedExercise.mockResolvedValue(true);
    mockTeamRepo.getMembersByTeamIds.mockResolvedValue([
      { id: 'requester-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' },
      { id: 'user-1', name: 'Learner One', email: 'l1@example.com', role: 'LEARNER' },
      { id: 'user-2', name: 'Learner Two', email: 'l2@example.com', role: 'LEARNER' },
    ]);
    mockExerciseAssignmentRepo.copyExerciseToUsers.mockResolvedValue({
      'user-1': 'ex-copy-1',
      'user-2': 'ex-copy-2',
    });

    const result = await useCase.execute({
      requesterId: 'requester-1',
      teamId: 'team-1',
      exerciseId: 'ex-1',
    });

    expect(mockExerciseAssignmentRepo.copyExerciseToUsers).toHaveBeenCalledWith('ex-1', [
      'user-1',
      'user-2',
    ]);
    expect(result.assignedCount).toBe(2);
  });
});
