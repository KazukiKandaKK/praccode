import { prisma } from '../../lib/prisma';
import { ITeamRepository, TeamRecord, TeamMemberRecord } from '../../domain/ports/ITeamRepository';

export class PrismaTeamRepository implements ITeamRepository {
  async getTeamsForUser(userId: string): Promise<TeamRecord[]> {
    const memberships = await prisma.teamMembership.findMany({
      where: { userId },
      include: { team: { select: { id: true, name: true } } },
    });

    return memberships.map((m) => ({ id: m.team.id, name: m.team.name }));
  }

  async getMembersByTeamIds(teamIds: string[]): Promise<TeamMemberRecord[]> {
    if (teamIds.length === 0) return [];

    const memberships = await prisma.teamMembership.findMany({
      where: { teamId: { in: teamIds } },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const byUserId = new Map<string, TeamMemberRecord>();
    for (const m of memberships) {
      byUserId.set(m.user.id, {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
      });
    }
    return Array.from(byUserId.values());
  }

  async isMemberOfTeam(userId: string, teamId: string): Promise<boolean> {
    const membership = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    return membership !== null;
  }

  async createTeam(name: string, creatorUserId: string): Promise<TeamRecord> {
    const team = await prisma.team.create({
      data: {
        name,
        members: {
          create: { userId: creatorUserId },
        },
      },
    });
    return { id: team.id, name: team.name };
  }

  async addMember(teamId: string, userId: string): Promise<void> {
    await prisma.teamMembership.upsert({
      where: { userId_teamId: { userId, teamId } },
      create: { teamId, userId },
      update: {},
    });
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await prisma.teamMembership.deleteMany({
      where: { teamId, userId },
    });
  }
}
