'use client';

import { useState } from 'react';
import Link from 'next/link';
import { registerUser, loginWithGitHub } from '@/app/actions/auth';
import { Code2, Github, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    const result = await registerUser(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(result.success);
    }
    setIsLoading(false);
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
          {success ? (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">登録完了</h1>
              <p className="text-slate-400 text-center mb-6">メールアドレスの確認をお願いします</p>

              {/* Success message */}
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-emerald-300 font-medium mb-2">{success}</p>
                <p className="text-sm text-emerald-400">
                  メールが届かない場合は、迷惑メールフォルダをご確認ください。
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">アカウント作成</h1>
              <p className="text-slate-400 text-center mb-6">
                無料でコードリーディングを始めましょう
              </p>

              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {/* GitHub Register */}
              <form action={loginWithGitHub}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors mb-4"
                >
                  <Github className="w-5 h-5" />
                  GitHub で登録
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-slate-800/50 text-slate-400">または</span>
                </div>
              </div>

              {/* Email Register Form */}
              <form action={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                    ユーザー名
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="username"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    メールアドレス
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    パスワード
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      id="password"
                      name="password"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="8文字以上"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 font-semibold rounded-xl transition-colors"
                >
                  {isLoading ? '登録中...' : 'アカウントを作成'}
                </button>
              </form>

              <p className="text-xs text-slate-500 text-center mt-4">
                登録することで、利用規約とプライバシーポリシーに同意したことになります。
              </p>
            </>
          )}
        </div>

        {/* Login link - only show when not success */}
        {!success && (
          <p className="text-center text-slate-400 mt-6">
            既にアカウントをお持ちですか？{' '}
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300">
              ログイン
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
