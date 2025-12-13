'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Code2, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('リセットトークンが見つかりません');
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上である必要があります');
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login?passwordReset=true');
        }, 2000);
      } else {
        const data = await response.json();
        if (response.status === 410) {
          setError('リセットトークンの有効期限が切れています');
        } else if (response.status === 404) {
          setError('無効なリセットトークンです');
        } else {
          setError(data.error || 'エラーが発生しました。');
        }
      }
    } catch {
      setError('エラーが発生しました。しばらくしてからお試しください。');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Code2 className="w-10 h-10 text-cyan-400" />
          <span className="text-2xl font-bold text-white">PracCode</span>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700/50 p-8">
          <h1 className="text-2xl font-bold text-white text-center mb-2">新しいパスワードを設定</h1>
          <p className="text-slate-400 text-center mb-6">新しいパスワードを入力してください</p>

          {/* Success message */}
          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-300 font-medium">
                  パスワードがリセットされました。ログインページにリダイレクトします...
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {!success && token && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  新しいパスワード
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="6文字以上"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  パスワード（確認）
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="パスワードを再入力"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 font-semibold rounded-xl transition-colors"
              >
                {isLoading ? 'リセット中...' : 'パスワードをリセット'}
              </button>
            </form>
          )}

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-slate-400 hover:text-cyan-400">
              ログインページに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

