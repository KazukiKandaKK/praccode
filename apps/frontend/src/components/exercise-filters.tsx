'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const LANGUAGES = [
  { value: '', label: 'すべての言語' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'python', label: 'Python' },
];

const DIFFICULTIES = [
  { value: '', label: 'すべての難易度' },
  { value: '1', label: '入門' },
  { value: '2', label: '初級' },
  { value: '3', label: '中級' },
  { value: '4', label: '上級' },
  { value: '5', label: 'エキスパート' },
];

const GENRES = [
  { value: '', label: 'すべてのジャンル' },
  { value: 'auth', label: '認証/認可' },
  { value: 'database', label: 'データベース' },
  { value: 'error_handling', label: 'エラーハンドリング' },
  { value: 'api_client', label: 'APIクライアント' },
  { value: 'async_concurrency', label: '非同期/並行' },
  { value: 'performance', label: 'パフォーマンス' },
  { value: 'testing', label: 'テスト' },
  { value: 'refactoring', label: 'リファクタリング' },
];

export function ExerciseFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const language = searchParams.get('language') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const genre = searchParams.get('genre') || '';
  const fromMentor = searchParams.get('from') === 'mentor';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      // ページングがあればリセット
      params.delete('page');

      const query = params.toString();
      router.push(query ? `/exercises?${query}` : '/exercises');
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push(fromMentor ? '/exercises?from=mentor' : '/exercises');
  }, [router, fromMentor]);

  const hasFilters = language || difficulty || genre;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* 言語フィルター */}
      <select
        value={language}
        onChange={(e) => updateFilter('language', e.target.value)}
        className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[140px]"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>

      {/* 難易度フィルター */}
      <select
        value={difficulty}
        onChange={(e) => updateFilter('difficulty', e.target.value)}
        className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[140px]"
      >
        {DIFFICULTIES.map((diff) => (
          <option key={diff.value} value={diff.value}>
            {diff.label}
          </option>
        ))}
      </select>

      {/* ジャンルフィルター */}
      <select
        value={genre}
        onChange={(e) => updateFilter('genre', e.target.value)}
        className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[160px]"
      >
        {GENRES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>

      {/* フィルタークリアボタン */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          フィルターをクリア
        </button>
      )}
    </div>
  );
}
