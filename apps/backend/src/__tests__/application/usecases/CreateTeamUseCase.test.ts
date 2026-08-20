import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { CreateTeamUseCase } from '@/application/usecases/team/CreateTeamUseCase';
import { ITeamRepository } from '@/domain/ports/ITeamRepository';
import { IUserAccountRepository } from '@/domain/ports/IUserAccountRepository';
import { ApplicationError } from '@/application/errors/ApplicationError';

const mockTeamRepo: Mocked<ITeamRepository> = {
  getTeamsForUser: vi.fn(),
  getMembersByTeamIds: vi.fn(),
  isMemberOfTeam: vi.fn(),
  createTeam: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
};

const mockUserAccountRepo: Mocked<IUserAccountRepository> = {
  getProfile: vi.fn(),
  updateName: vi.fn(),
  findByEmail: vi.fn(),
  findByIdWithPassword: vi.fn(),
  updatePassword: vi.fn(),
  updateEmail: vi.fn(),
};

describe('CreateTeamUseCase', () => {
  let useCase: CreateTeamUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateTeamUseCase(mockTeamRepo, mockUserAccountRepo);
  });

  it('ADMINでない場合は403を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      name: 'A',
      image: null,
      role: 'LEARNER',
      hasPassword: true,
      oauthProviders: [],
    });

    await expect(useCase.execute({ requesterId: 'u1', name: 'Team A' })).rejects.toMatchObject({
      statusCode: 403,
    } as Partial<ApplicationError>);
  });

  it('名前が空文字の場合は400を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin',
      image: null,
      role: 'ADMIN',
      hasPassword: true,
      oauthProviders: [],
    });

    await expect(useCase.execute({ requesterId: 'u1', name: '   ' })).rejects.toMatchObject({
      statusCode: 400,
    } as Partial<ApplicationError>);
  });

  it('ADMINがチームを作成できる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin',
      image: null,
      role: 'ADMIN',
      hasPassword: true,
      oauthProviders: [],
    });
    mockTeamRepo.createTeam.mockResolvedValue({ id: 'team-1', name: 'Team A' });

    const result = await useCase.execute({ requesterId: 'u1', name: '  Team A  ' });

    expect(mockTeamRepo.createTeam).toHaveBeenCalledWith('Team A', 'u1');
    expect(result).toEqual({ id: 'team-1', name: 'Team A' });
  });
});
