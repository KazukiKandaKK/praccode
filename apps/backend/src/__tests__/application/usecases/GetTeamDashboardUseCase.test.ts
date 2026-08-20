import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { GetTeamDashboardUseCase } from '@/application/usecases/dashboard/GetTeamDashboardUseCase';
import { ITeamRepository } from '@/domain/ports/ITeamRepository';
import { IDashboardRepository } from '@/domain/ports/IDashboardRepository';
import { IUserAccountRepository } from '@/domain/ports/IUserAccountRepository';
import { ApplicationError } from '@/application/errors/ApplicationError';

const mockTeamRepo: Mocked<ITeamRepository> = {
  getTeamsForUser: vi.fn(),
  getMembersByTeamIds: vi.fn(),
};

const mockDashboardRepo = {
  getReadingSubmissions: vi.fn(),
  getWritingSubmissions: vi.fn(),
  getReadingSubmissionsForUsers: vi.fn(),
  getWritingSubmissionsForUsers: vi.fn(),
  getReadingActivityDates: vi.fn(),
  getWritingActivityDates: vi.fn(),
  getLearningAnalysis: vi.fn(),
  saveLearningAnalysis: vi.fn(),
  createReadingExercisePlaceholder: vi.fn(),
  saveGeneratedExercise: vi.fn(),
  markExerciseFailed: vi.fn(),
  createWritingChallengePlaceholder: vi.fn(),
  saveGeneratedWritingChallenge: vi.fn(),
  markWritingChallengeFailed: vi.fn(),
} as unknown as Mocked<IDashboardRepository>;

const mockUserAccountRepo: Mocked<IUserAccountRepository> = {
  getProfile: vi.fn(),
  updateName: vi.fn(),
  findByEmail: vi.fn(),
  findByIdWithPassword: vi.fn(),
  updatePassword: vi.fn(),
  updateEmail: vi.fn(),
};

describe('GetTeamDashboardUseCase', () => {
  let useCase: GetTeamDashboardUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetTeamDashboardUseCase(mockTeamRepo, mockDashboardRepo, mockUserAccountRepo);
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
      useCase.execute({ requesterId: 'requester-1', teamId: 'team-1' })
    ).rejects.toMatchObject({ statusCode: 403 } as Partial<ApplicationError>);
  });

  it('リクエスターが該当チームに所属していない場合は404を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'requester-1',
      email: 'a@example.com',
      name: 'A',
      image: null,
      role: 'ADMIN',
      hasPassword: true,
      oauthProviders: [],
    });
    mockTeamRepo.getTeamsForUser.mockResolvedValue([{ id: 'team-other', name: 'Other' }]);

    await expect(
      useCase.execute({ requesterId: 'requester-1', teamId: 'team-1' })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<ApplicationError>);
  });

  it('メンバーの提出データを集計してチームダッシュボードを返す', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'requester-1',
      email: 'admin@example.com',
      name: 'Admin',
      image: null,
      role: 'ADMIN',
      hasPassword: true,
      oauthProviders: [],
    });
    mockTeamRepo.getTeamsForUser.mockResolvedValue([{ id: 'team-1', name: 'Team A' }]);
    mockTeamRepo.getMembersByTeamIds.mockResolvedValue([
      { id: 'user-1', name: 'Learner One', email: 'l1@example.com', role: 'LEARNER' },
      { id: 'user-2', name: 'Learner Two', email: 'l2@example.com', role: 'LEARNER' },
    ]);

    const recentDate = new Date();
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);

    mockDashboardRepo.getReadingSubmissionsForUsers.mockResolvedValue([
      {
        id: 'sub-1',
        userId: 'user-1',
        status: 'EVALUATED',
        createdAt: recentDate,
        updatedAt: recentDate,
        exercise: { id: 'ex-1', title: 'Ex1', language: 'ts', genre: null },
        answers: [{ score: 80, level: 'B', aspects: { responsibility: 80 }, llmFeedback: null }],
      },
      {
        id: 'sub-2',
        userId: 'user-2',
        status: 'EVALUATED',
        createdAt: oldDate,
        updatedAt: oldDate,
        exercise: { id: 'ex-2', title: 'Ex2', language: 'ts', genre: null },
        answers: [{ score: 60, level: 'C', aspects: { responsibility: 60 }, llmFeedback: null }],
      },
    ]);
    mockDashboardRepo.getWritingSubmissionsForUsers.mockResolvedValue([]);

    const result = await useCase.execute({ requesterId: 'requester-1', teamId: 'team-1' });

    expect(result.team).toEqual({ id: 'team-1', name: 'Team A' });
    expect(result.members).toHaveLength(2);

    const user1Stats = result.members.find((m) => m.userId === 'user-1');
    expect(user1Stats?.avgReadingScore).toBe(80);
    expect(user1Stats?.isStagnant).toBe(false);

    const user2Stats = result.members.find((m) => m.userId === 'user-2');
    expect(user2Stats?.avgReadingScore).toBe(60);
    expect(user2Stats?.isStagnant).toBe(true);

    expect(result.teamAspectAverages.responsibility).toBe(70);
  });
});
