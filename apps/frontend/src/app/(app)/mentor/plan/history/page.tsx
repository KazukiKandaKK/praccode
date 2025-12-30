import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MentorPlanHistory } from '@/components/mentor/mentor-plan-history';

export default async function MentorPlanHistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <MentorPlanHistory
        userId={session.user.id}
        userName={session.user.name || session.user.email || 'あなた'}
      />
    </div>
  );
}
