'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function EmailChangeConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('トークンが見つかりません');
        return;
      }
      if (!session?.user?.id) {
        setStatus('error');
        setMessage('ログインが必要です');
        return;
      }

      setStatus('loading');
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/users/me/email-change/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, token }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t);
        }
        setStatus('ok');
        setMessage('メールアドレスを更新しました');
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : '更新に失敗しました');
      }
    };
    run();
  }, [token, session?.user?.id]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Card>
        <CardHeader>
          <CardTitle>メールアドレス変更</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex items-center gap-3 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              反映中...
            </div>
          )}
          {status === 'ok' && (
            <div className="flex items-center gap-3 text-emerald-300">
              <CheckCircle className="w-5 h-5" />
              {message}
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-3 text-red-300">
              <XCircle className="w-5 h-5" />
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => router.push('/settings')}>
              設定に戻る
            </Button>
            <Button onClick={() => router.push('/exercises')}>学習へ</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



