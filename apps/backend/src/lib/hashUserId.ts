import crypto from 'node:crypto';

/**
 * 生の userId をログ等に記録する際、識別しつつも元の値を直接露出させないための
 * 一方向ハッシュ。衝突リスクを考慮し、必要に応じてより長い slice を使う。
 */
export function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 12);
}
