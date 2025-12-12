import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { SessionProviderWrapper } from '@/components/session-provider-wrapper';
import { EvaluationToastProvider } from '@/components/evaluation-toast-provider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <SessionProviderWrapper>
      <EvaluationToastProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
          <Navigation user={session.user} />
          <main className="pt-16">{children}</main>
        </div>
      </EvaluationToastProvider>
    </SessionProviderWrapper>
  );
}

