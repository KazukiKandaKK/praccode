import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MentorFeedbackHistory } from '@/components/mentor/mentor-feedback-history';

export default async function MentorFeedbackPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <MentorFeedbackHistory
        userId={session.user.id}
        userName={session.user.name || session.user.email || 'あなた'}
      />
    </div>
  );
}
