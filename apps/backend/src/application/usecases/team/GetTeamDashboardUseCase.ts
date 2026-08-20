import { IDashboardRepository } from '../../../domain/ports/IDashboardRepository';
import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { ApplicationError } from '../../errors/ApplicationError';

const STAGNATION_THRESHOLD_DAYS = 7;

export interface TeamMemberDashboardStats {
  userId: string;
  name: string | null;
  email: string;
  role: 'ADMIN' | 'LEARNER';
  totalReadingSubmissions: number;
  totalWritingSubmissions: number;
  avgReadingScore: number;
  writingPassRate: number;
  aspectAverages: Record<string, number>;
  lastActivityAt: string | null;
  /** 直近 STAGNATION_THRESHOLD_DAYS 日間に学習活動が無い場合 true */
  isStagnant: boolean;
}

export interface TeamDashboardResult {
  team: { id: string; name: string };
  members: TeamMemberDashboardStats[];
  teamAspectAverages: Record<string, number>;
}

export class GetTeamDashboardUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly dashboardRepo: IDashboardRepository,
    private readonly userAccountRepo: IUserAccountRepository
  ) {}

  async execute(input: { requesterId: string; teamId: string }): Promise<TeamDashboardResult> {
    const requesterProfile = await this.userAccountRepo.getProfile(input.requesterId);
    if (!requesterProfile) {
      throw new ApplicationError('Unauthorized', 401);
    }
    if (requesterProfile.role !== 'ADMIN') {
      throw new ApplicationError('Forbidden', 403);
    }

    const requesterTeams = await this.teamRepo.getTeamsForUser(input.requesterId);
    const team = requesterTeams.find((t) => t.id === input.teamId);
    if (!team) {
      throw new ApplicationError('Team not found', 404);
    }

    const members = await this.teamRepo.getMembersByTeamIds([team.id]);
    const memberIds = members.map((m) => m.id);

    const [readingSubmissions, writingSubmissions] = await Promise.all([
      this.dashboardRepo.getReadingSubmissionsForUsers(memberIds),
      this.dashboardRepo.getWritingSubmissionsForUsers(memberIds),
    ]);

    const now = Date.now();
    const teamAspectTotals: Record<string, { total: number; count: number }> = {};

    const memberStats: TeamMemberDashboardStats[] = members.map((member) => {
      const readingForMember = readingSubmissions.filter((s) => s.userId === member.id);
      const writingForMember = writingSubmissions.filter((s) => s.userId === member.id);
      const completedWriting = writingForMember.filter((s) => s.status === 'COMPLETED');

      let totalScore = 0;
      let scoreCount = 0;
      const aspectScores: Record<string, { total: number; count: number }> = {};

      for (const sub of readingForMember) {
        for (const ans of sub.answers) {
          if (ans.score !== null) {
            totalScore += ans.score;
            scoreCount++;
          }
          if (ans.aspects) {
            for (const [aspect, score] of Object.entries(ans.aspects)) {
              if (!aspectScores[aspect]) aspectScores[aspect] = { total: 0, count: 0 };
              aspectScores[aspect].total += score;
              aspectScores[aspect].count++;

              if (!teamAspectTotals[aspect]) teamAspectTotals[aspect] = { total: 0, count: 0 };
              teamAspectTotals[aspect].total += score;
              teamAspectTotals[aspect].count++;
            }
          }
        }
      }

      const aspectAverages: Record<string, number> = {};
      for (const [aspect, data] of Object.entries(aspectScores)) {
        aspectAverages[aspect] = Math.round(data.total / data.count);
      }

      const avgReadingScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
      const writingPassRate =
        completedWriting.length > 0
          ? Math.round(
              (completedWriting.filter((s) => s.passed === true).length / completedWriting.length) * 100
            )
          : 0;

      const activityDates = [
        ...readingForMember.map((s) => s.updatedAt),
        ...writingForMember.map((s) => s.createdAt),
      ];
      const lastActivityAt =
        activityDates.length > 0
          ? new Date(Math.max(...activityDates.map((d) => new Date(d).getTime())))
          : null;

      const daysSinceLastActivity = lastActivityAt
        ? (now - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      return {
        userId: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        totalReadingSubmissions: readingForMember.length,
        totalWritingSubmissions: completedWriting.length,
        avgReadingScore,
        writingPassRate,
        aspectAverages,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        isStagnant: daysSinceLastActivity > STAGNATION_THRESHOLD_DAYS,
      };
    });

    const teamAspectAverages: Record<string, number> = {};
    for (const [aspect, data] of Object.entries(teamAspectTotals)) {
      teamAspectAverages[aspect] = Math.round(data.total / data.count);
    }

    return {
      team,
      members: memberStats,
      teamAspectAverages,
    };
  }
}
