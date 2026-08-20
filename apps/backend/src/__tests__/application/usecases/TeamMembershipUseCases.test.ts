import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { AddTeamMemberUseCase } from '@/application/usecases/team/AddTeamMemberUseCase';
import { RemoveTeamMemberUseCase } from '@/application/usecases/team/RemoveTeamMemberUseCase';
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

const adminProfile = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  image: null,
  role: 'ADMIN' as const,
  hasPassword: true,
  oauthProviders: [],
};

describe('AddTeamMemberUseCase', () => {
  let useCase: AddTeamMemberUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AddTeamMemberUseCase(mockTeamRepo, mockUserAccountRepo);
  });

  it('リクエスターがチームに所属していない場合は404を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue(adminProfile);
    mockTeamRepo.isMemberOfTeam.mockResolvedValue(false);

    await expect(
      useCase.execute({ requesterId: 'admin-1', teamId: 'team-1', memberEmail: 'l1@example.com' })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<ApplicationError>);
  });

  it('追加対象ユーザーが存在しない場合は404を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue(adminProfile);
    mockTeamRepo.isMemberOfTeam.mockResolvedValue(true);
    mockUserAccountRepo.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ requesterId: 'admin-1', teamId: 'team-1', memberEmail: 'nobody@example.com' })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<ApplicationError>);
  });

  it('メールアドレスでユーザーを見つけてチームに追加する', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue(adminProfile);
    mockTeamRepo.isMemberOfTeam.mockResolvedValue(true);
    mockUserAccountRepo.findByEmail.mockResolvedValue({ id: 'user-1' });

    await useCase.execute({ requesterId: 'admin-1', teamId: 'team-1', memberEmail: 'l1@example.com' });

    expect(mockTeamRepo.addMember).toHaveBeenCalledWith('team-1', 'user-1');
  });
});

describe('RemoveTeamMemberUseCase', () => {
  let useCase: RemoveTeamMemberUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RemoveTeamMemberUseCase(mockTeamRepo, mockUserAccountRepo);
  });

  it('ADMINでない場合は403を投げる', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue({ ...adminProfile, role: 'LEARNER' });

    await expect(
      useCase.execute({ requesterId: 'admin-1', teamId: 'team-1', memberUserId: 'user-1' })
    ).rejects.toMatchObject({ statusCode: 403 } as Partial<ApplicationError>);
  });

  it('チームからメンバーを削除する', async () => {
    mockUserAccountRepo.getProfile.mockResolvedValue(adminProfile);
    mockTeamRepo.isMemberOfTeam.mockResolvedValue(true);

    await useCase.execute({ requesterId: 'admin-1', teamId: 'team-1', memberUserId: 'user-1' });

    expect(mockTeamRepo.removeMember).toHaveBeenCalledWith('team-1', 'user-1');
  });
});
