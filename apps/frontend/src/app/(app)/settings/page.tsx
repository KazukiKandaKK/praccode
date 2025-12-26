import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/settings-form';

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  hasPassword: boolean;
  oauthProviders: string[];
}

async function getMe(userId: string): Promise<MeResponse | null> {
  try {
    const apiUrl = process.env.API_URL || 'http://backend:3001';
    const res = await fetch(`${apiUrl}/users/me?userId=${userId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const me = await getMe(session.user.id);
  if (!me) {
    // 取得に失敗した場合はログインへ（暫定）
    redirect('/login');
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">ユーザ設定</h1>
        <p className="text-slate-400">プロフィールや認証情報を管理します</p>
      </div>

      <SettingsForm me={me} />
    </div>
  );
}

