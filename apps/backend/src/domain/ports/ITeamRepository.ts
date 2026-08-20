export interface TeamRecord {
  id: string;
  name: string;
}

export interface TeamMemberRecord {
  id: string;
  name: string | null;
  email: string;
  role: 'ADMIN' | 'LEARNER';
}

export interface ITeamRepository {
  /** 指定ユーザーが所属するチーム一覧を返す */
  getTeamsForUser(userId: string): Promise<TeamRecord[]>;
  /** 指定チームIDに所属するメンバー一覧を返す（重複除去済み） */
  getMembersByTeamIds(teamIds: string[]): Promise<TeamMemberRecord[]>;
  /** 指定ユーザーが指定チームに所属しているか */
  isMemberOfTeam(userId: string, teamId: string): Promise<boolean>;
  /** チームを作成し、作成者を最初のメンバーとして登録する */
  createTeam(name: string, creatorUserId: string): Promise<TeamRecord>;
  /** チームにメンバーを追加する（既に所属していれば何もしない） */
  addMember(teamId: string, userId: string): Promise<void>;
  /** チームからメンバーを削除する */
  removeMember(teamId: string, userId: string): Promise<void>;
}
