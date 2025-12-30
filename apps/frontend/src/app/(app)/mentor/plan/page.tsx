import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MentorPlan } from '@/components/mentor/mentor-dashboard';

export default async function MentorPlanPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <MentorPlan
        userId={session.user.id}
        userName={session.user.name || session.user.email || 'あなた'}
      />
    </div>
  );
}
