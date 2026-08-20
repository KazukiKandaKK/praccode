export interface OwnedExerciseSummary {
  id: string;
  title: string;
  language: string;
  difficulty: number;
  genre: string | null;
}

export interface IExerciseAssignmentRepository {
  /** 指定ユーザー（ADMIN）が作成したREADY状態の演習一覧を返す（割り当て候補選択用） */
  findOwnedReadyExercises(createdById: string): Promise<OwnedExerciseSummary[]>;
  /** 指定演習が指定ユーザーによって作成されたものかを確認する */
  isOwnedExercise(exerciseId: string, createdById: string): Promise<boolean>;
  /**
   * 指定演習（設問含む）を対象ユーザーそれぞれに複製して割り当てる。
   * 戻り値は userId -> 新規作成された exerciseId のマップ。
   */
  copyExerciseToUsers(exerciseId: string, userIds: string[]): Promise<Record<string, string>>;
}
