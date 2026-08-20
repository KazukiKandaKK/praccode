import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { teamDashboardController } from '@/infrastructure/web/teamDashboardController';
import { GetMyTeamsUseCase } from '@/application/usecases/team/GetMyTeamsUseCase';
import { GetTeamDashboardUseCase } from '@/application/usecases/team/GetTeamDashboardUseCase';
import { AssignExerciseToTeamUseCase } from '@/application/usecases/team/AssignExerciseToTeamUseCase';
import { ListOwnedExercisesUseCase } from '@/application/usecases/team/ListOwnedExercisesUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';

const mockGetMyTeams = {
  execute: vi.fn(),
} as unknown as Mocked<GetMyTeamsUseCase>;

const mockGetTeamDashboard = {
  execute: vi.fn(),
} as unknown as Mocked<GetTeamDashboardUseCase>;

const mockAssignExerciseToTeam = {
  execute: vi.fn(),
} as unknown as Mocked<AssignExerciseToTeamUseCase>;

const mockListOwnedExercises = {
  execute: vi.fn(),
} as unknown as Mocked<ListOwnedExercisesUseCase>;

describe('teamDashboardController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      teamDashboardController(instance, {
        getMyTeams: mockGetMyTeams,
        getTeamDashboard: mockGetTeamDashboard,
        assignExerciseToTeam: mockAssignExerciseToTeam,
        listOwnedExercises: mockListOwnedExercises,
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

  it('演習をチームに割り当てる', async () => {
    mockAssignExerciseToTeam.execute.mockResolvedValue({
      assignedCount: 2,
      assignments: [
        { userId: 'user-1', exerciseId: 'ex-copy-1' },
        { userId: 'user-2', exerciseId: 'ex-copy-2' },
      ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/teams/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0/exercises/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab1/assign',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).assignedCount).toBe(2);
  });

  it('所有していない演習の割り当ては404を返す', async () => {
    mockAssignExerciseToTeam.execute.mockRejectedValue(new ApplicationError('Exercise not found', 404));

    const response = await app.inject({
      method: 'POST',
      url: '/teams/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0/exercises/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab1/assign',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('所有している演習一覧を返す', async () => {
    mockListOwnedExercises.execute.mockResolvedValue([
      { id: 'ex-1', title: 'Ex1', language: 'ts', difficulty: 2, genre: null },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/exercises/owned',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).exercises).toHaveLength(1);
  });
});
