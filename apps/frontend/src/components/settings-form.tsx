'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Lock, User, Shield } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  hasPassword: boolean;
  oauthProviders: string[];
}

export function SettingsForm({ me }: { me: MeResponse }) {
  const { data: session } = useSession();
  const userId = session?.user?.id || me.id;

  const [name, setName] = useState(me.name || '');
  const [email, setEmail] = useState(me.email);
  const [newEmail, setNewEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const [savingName, setSavingName] = useState(false);
  const [requestingEmail, setRequestingEmail] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const isOAuthUser = useMemo(() => {
    // OAuthユーザーはパスワード変更を非表示（要件）
    return (me.oauthProviders || []).length > 0 && !me.hasPassword;
  }, [me.hasPassword, me.oauthProviders]);

  const apiUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }, []);

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch(`${apiUrl}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      toast.success('名前を更新しました');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新に失敗しました');
    } finally {
      setSavingName(false);
    }
  };

  const handleRequestEmailChange = async () => {
    setRequestingEmail(true);
    try {
      const res = await fetch(`${apiUrl}/users/me/email-change/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newEmail }),
      });
      if (!res.ok && res.status !== 202) {
        const t = await res.text();
        throw new Error(t);
      }
      toast.success('確認リンクを発行しました（開発環境ではbackendログを確認してください）');
      setNewEmail('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'メール変更の開始に失敗しました');
    } finally {
      setRequestingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== newPassword2) {
      toast.error('新しいパスワードが一致しません');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${apiUrl}/users/me/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      toast.success('パスワードを変更しました');
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'パスワード変更に失敗しました');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            プロフィール
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">ユーザID</label>
              <div className="text-sm text-slate-300 font-mono break-all">{me.id}</div>
            </div>
            <div className="flex items-center gap-2 justify-start md:justify-end">
              <Badge variant="secondary">{me.role}</Badge>
              {me.oauthProviders?.map((p) => (
                <Badge key={p} variant="default">
                  {p}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">表示名</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: Kazuki" />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveName} disabled={savingName || !name.trim()}>
              {savingName ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-violet-400" />
            メールアドレス
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">現在のメールアドレス</label>
            <Input value={email} readOnly />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">新しいメールアドレス</label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
            />
            <p className="text-xs text-slate-500 mt-2">
              新しいメール宛に確認リンクを送信し、確認後に反映します（開発環境ではbackendログにURLを出力）。
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleRequestEmailChange} disabled={requestingEmail || !newEmail.trim()}>
              {requestingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              確認リンクを送る
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password (Credentials only) */}
      {!isOAuthUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              パスワード
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!me.hasPassword ? (
              <p className="text-sm text-slate-400">
                このアカウントにはパスワードが設定されていません。
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">現在のパスワード</label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">新しいパスワード</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">新しいパスワード（確認）</label>
                  <Input
                    type="password"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !currentPassword || !newPassword || !newPassword2}
                  >
                    {changingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    変更する
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* MFA (UI only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            MFA（多要素認証）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-slate-800/40 border border-slate-700 rounded-xl">
            <p className="text-sm text-slate-300">MFAは今後対応予定です。</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


