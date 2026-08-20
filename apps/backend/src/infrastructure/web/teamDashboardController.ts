import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { GetMyTeamsUseCase } from '../../application/usecases/team/GetMyTeamsUseCase.js';
import { GetTeamDashboardUseCase } from '../../application/usecases/team/GetTeamDashboardUseCase.js';
import { AssignExerciseToTeamUseCase } from '../../application/usecases/team/AssignExerciseToTeamUseCase.js';
import { ListOwnedExercisesUseCase } from '../../application/usecases/team/ListOwnedExercisesUseCase.js';
import { ApplicationError } from '../../application/errors/ApplicationError.js';

const teamParamsSchema = z.object({
  teamId: z.string().uuid(),
});

const assignExerciseParamsSchema = z.object({
  teamId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export interface TeamDashboardControllerDeps {
  getMyTeams: GetMyTeamsUseCase;
  getTeamDashboard: GetTeamDashboardUseCase;
  assignExerciseToTeam: AssignExerciseToTeamUseCase;
  listOwnedExercises: ListOwnedExercisesUseCase;
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

  fastify.get('/teams/:teamId/dashboard', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const { teamId } = teamParamsSchema.parse(request.params);
      const result = await deps.getTeamDashboard.execute({ requesterId: userId, teamId });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
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
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  fastify.get('/exercises/owned', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const exercises = await deps.listOwnedExercises.execute(userId);
      return reply.send({ exercises });
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
};
