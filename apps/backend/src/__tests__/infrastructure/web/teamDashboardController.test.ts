import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { teamDashboardController } from '@/infrastructure/web/teamDashboardController';
import { GetMyTeamsUseCase } from '@/application/usecases/dashboard/GetMyTeamsUseCase';
import { GetTeamDashboardUseCase } from '@/application/usecases/dashboard/GetTeamDashboardUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';

const mockGetMyTeams = {
  execute: vi.fn(),
} as unknown as Mocked<GetMyTeamsUseCase>;

const mockGetTeamDashboard = {
  execute: vi.fn(),
} as unknown as Mocked<GetTeamDashboardUseCase>;

describe('teamDashboardController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      teamDashboardController(instance, {
        getMyTeams: mockGetMyTeams,
        getTeamDashboard: mockGetTeamDashboard,
      });
      done();
    });
    vi.clearAllMocks();
    await app.ready();
  });

  it('x-user-idヘッダが無い場合は401を返す', async () => {
    const response = await app.inject({ method: 'GET', url: '/teams/me' });
    expect(response.statusCode).toBe(401);
  });

  it('所属チーム一覧を返す', async () => {
    mockGetMyTeams.execute.mockResolvedValue([{ id: 'team-1', name: 'Team A' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/teams/me',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ teams: [{ id: 'team-1', name: 'Team A' }] });
  });

  it('ADMINでないリクエストは403を返す', async () => {
    mockGetTeamDashboard.execute.mockRejectedValue(new ApplicationError('Forbidden', 403));

    const response = await app.inject({
      method: 'GET',
      url: '/teams/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0/dashboard',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('teamIdがUUID形式でない場合は400を返す', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/teams/not-a-uuid/dashboard',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(400);
  });
});
