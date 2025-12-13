import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDifficultyLabel(difficulty: number): string {
  const labels: Record<number, string> = {
    1: '入門',
    2: '初級',
    3: '中級',
    4: '上級',
    5: 'エキスパート',
  };
  return labels[difficulty] || '不明';
}

export function getDifficultyColor(difficulty: number): string {
  const colors: Record<number, string> = {
    1: 'text-emerald-400',
    2: 'text-cyan-400',
    3: 'text-amber-400',
    4: 'text-orange-400',
    5: 'text-red-400',
  };
  return colors[difficulty] || 'text-slate-400';
}

export function getScoreLevelColor(level: string): string {
  const colors: Record<string, string> = {
    A: 'text-emerald-400',
    B: 'text-cyan-400',
    C: 'text-amber-400',
    D: 'text-red-400',
  };
  return colors[level] || 'text-slate-400';
}

export function getScoreLevelBgColor(level: string): string {
  const colors: Record<string, string> = {
    A: 'bg-emerald-500/20 border-emerald-500/30',
    B: 'bg-cyan-500/20 border-cyan-500/30',
    C: 'bg-amber-500/20 border-amber-500/30',
    D: 'bg-red-500/20 border-red-500/30',
  };
  return colors[level] || 'bg-slate-500/20 border-slate-500/30';
}

export function getLanguageLabel(language: string): string {
  const labels: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    go: 'Go',
    ruby: 'Ruby',
    python: 'Python',
    rust: 'Rust',
  };
  return labels[language] || language;
}

export function getLearningGoalLabel(goal: string): string {
  const labels: Record<string, string> = {
    responsibility: '責務理解',
    data_flow: 'データフロー',
    error_handling: 'エラーハンドリング',
    testing: 'テスト',
    performance: 'パフォーマンス',
    security: 'セキュリティ',
  };
  return labels[goal] || goal;
}

export function getGenreLabel(genre: string): string {
  const labels: Record<string, string> = {
    auth: '認証/認可',
    database: 'データベース',
    error_handling: 'エラーハンドリング',
    api_client: 'APIクライアント',
    async_concurrency: '非同期/並行',
    performance: 'パフォーマンス',
    testing: 'テスト',
    refactoring: 'リファクタリング',
  };
  return labels[genre] || genre;
}
