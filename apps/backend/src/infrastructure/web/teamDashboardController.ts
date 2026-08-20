import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { GetMyTeamsUseCase } from '../../application/usecases/team/GetMyTeamsUseCase.js';
import { GetTeamDashboardUseCase } from '../../application/usecases/team/GetTeamDashboardUseCase.js';
import { AssignExerciseToTeamUseCase } from '../../application/usecases/team/AssignExerciseToTeamUseCase.js';
import { ListOwnedExercisesUseCase } from '../../application/usecases/team/ListOwnedExercisesUseCase.js';
import { CreateTeamUseCase } from '../../application/usecases/team/CreateTeamUseCase.js';
import { AddTeamMemberUseCase } from '../../application/usecases/team/AddTeamMemberUseCase.js';
import { RemoveTeamMemberUseCase } from '../../application/usecases/team/RemoveTeamMemberUseCase.js';
import { ApplicationError } from '../../application/errors/ApplicationError.js';

const teamParamsSchema = z.object({
  teamId: z.string().uuid(),
});

const teamMemberParamsSchema = z.object({
  teamId: z.string().uuid(),
  memberUserId: z.string().uuid(),
});

const assignExerciseParamsSchema = z.object({
  teamId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

const createTeamBodySchema = z.object({
  name: z.string().min(1).max(100),
});

const addMemberBodySchema = z.object({
  email: z.string().email(),
});

export interface TeamDashboardControllerDeps {
  getMyTeams: GetMyTeamsUseCase;
  getTeamDashboard: GetTeamDashboardUseCase;
  assignExerciseToTeam: AssignExerciseToTeamUseCase;
  listOwnedExercises: ListOwnedExercisesUseCase;
  createTeam: CreateTeamUseCase;
  addTeamMember: AddTeamMemberUseCase;
  removeTeamMember: RemoveTeamMemberUseCase;
}

const getUserId = (request: FastifyRequest): string | null => {
  const header = request.headers['x-user-id'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  try {
    return z.string().uuid().parse(raw);
  } catch {
    return null;
  }
};

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const userId = getUserId(request);
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }
  return userId;
};

const handleKnownErrors = (error: unknown, reply: FastifyReply) => {
  if (error instanceof z.ZodError) {
    return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
  }
  if (error instanceof ApplicationError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }
  throw error;
};

export const teamDashboardController = (
  fastify: FastifyInstance,
  deps: TeamDashboardControllerDeps
) => {
  fastify.get('/teams/me', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const teams = await deps.getMyTeams.execute(userId);
    return reply.send({ teams });
  });

  fastify.post('/teams', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const { name } = createTeamBodySchema.parse(request.body);
      const team = await deps.createTeam.execute({ requesterId: userId, name });
      return reply.status(201).send(team);
    } catch (error) {
      return handleKnownErrors(error, reply);
    }
  });

  fastify.get('/teams/:teamId/dashboard', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const { teamId } = teamParamsSchema.parse(request.params);
      const result = await deps.getTeamDashboard.execute({ requesterId: userId, teamId });
      return reply.send(result);
    } catch (error) {
      return handleKnownErrors(error, reply);
    }
  });

  fastify.post('/teams/:teamId/members', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const { teamId } = teamParamsSchema.parse(request.params);
      const { email } = addMemberBodySchema.parse(request.body);
      await deps.addTeamMember.execute({ requesterId: userId, teamId, memberEmail: email });
      return reply.status(204).send();
    } catch (error) {
      return handleKnownErrors(error, reply);
    }
  });

  fastify.delete('/teams/:teamId/members/:memberUserId', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const { teamId, memberUserId } = teamMemberParamsSchema.parse(request.params);
      await deps.removeTeamMember.execute({ requesterId: userId, teamId, memberUserId });
      return reply.status(204).send();
    } catch (error) {
      return handleKnownErrors(error, reply);
    }
  });

  fastify.post('/teams/:teamId/exercises/:exerciseId/assign', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const { teamId, exerciseId } = assignExerciseParamsSchema.parse(request.params);
      const result = await deps.assignExerciseToTeam.execute({
        requesterId: userId,
        teamId,
        exerciseId,
      });
      return reply.send(result);
    } catch (error) {
      return handleKnownErrors(error, reply);
    }
  });

  fastify.get('/exercises/owned', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const exercises = await deps.listOwnedExercises.execute(userId);
      return reply.send({ exercises });
    } catch (error) {
      return handleKnownErrors(error, reply);
    }
  });
};
