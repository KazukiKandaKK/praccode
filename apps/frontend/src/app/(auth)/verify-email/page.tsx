'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('認証トークンが見つかりません');
      return;
    }

    // 重複リクエストを防ぐ（React Strict Mode対策）
    if (hasVerified.current) {
      return;
    }
    hasVerified.current = true;

    async function verifyEmail() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.alreadyVerified) {
            setStatus('success');
            setMessage('メールアドレスは既に認証済みです。ログインできます。');
          } else {
            setStatus('success');
            setMessage('メールアドレスの確認が完了しました。ログインできます。');
          }
        } else {
          const data = await response.json();
          setStatus('error');
          if (response.status === 410) {
            setMessage('認証トークンの有効期限が切れています');
          } else if (response.status === 404) {
            setMessage('無効な認証トークンです。既に認証済みか、有効期限が切れている可能性があります。');
          } else if (response.status === 400) {
            setMessage('無効なリクエストです');
          } else {
            setMessage(data.error || 'メールアドレスの確認に失敗しました');
          }
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('メールアドレスの確認に失敗しました');
      }
    }

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">メールアドレスの確認</CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-cyan-400 animate-spin" />
              <p className="text-slate-300">確認中...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
              <p className="text-white font-medium mb-4">{message}</p>
              <Link href="/login">
                <Button className="w-full">ログインページへ</Button>
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
              <p className="text-white font-medium mb-4">{message}</p>
              <div className="space-y-2">
                <Link href="/register">
                  <Button variant="secondary" className="w-full">
                    新規登録
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    ログイン
                  </Button>
                </Link>
              </div>
              {message.includes('既に認証済み') && (
                <p className="text-sm text-slate-400 mt-4">
                  既にメール認証が完了している場合、すぐにログインできます。
                </p>
              )}
              {message.includes('無効な認証トークン') && !message.includes('既に認証済み') && (
                <p className="text-sm text-slate-400 mt-4">
                  トークンが無効または期限切れの場合、新規登録からやり直してください。
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
