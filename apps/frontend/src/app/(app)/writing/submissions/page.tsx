import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { WritingSubmissionsTable } from '@/components/writing-submissions-table';
import { PenTool, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';

interface WritingSubmissionSummary {
  id: string;
  challengeId: string;
  language: string;
  code: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  passed: boolean | null;
  executedAt: string | null;
  llmFeedback: string | null;
  llmFeedbackStatus: string;
  llmFeedbackAt: string | null;
  createdAt: string;
  challenge: {
    id: string;
    title: string;
    language: string;
    difficulty: number;
  };
}

interface SubmissionsResponse {
  submissions: WritingSubmissionSummary[];
}

async function getSubmissions(userId: string): Promise<SubmissionsResponse> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/writing/submissions?userId=${userId}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch writing submissions:', response.status);
      return { submissions: [] };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching writing submissions:', error);
    return { submissions: [] };
  }
}

export default async function WritingSubmissionsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { submissions } = await getSubmissions(session.user.id);

  // 統計計算
  const totalCount = submissions.length;
  const passedCount = submissions.filter((s) => s.passed === true).length;
  const failedCount = submissions.filter((s) => s.passed === false).length;
  const feedbackCount = submissions.filter((s) => s.llmFeedbackStatus === 'COMPLETED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-violet-500/10 rounded-xl">
            <PenTool className="w-6 h-6 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">ライティング結果</h1>
        </div>
        <p className="text-slate-400">コードライティングの提出結果を確認できます</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="総提出数"
          value={totalCount.toString()}
          icon={<PenTool className="w-5 h-5" />}
        />
        <StatCard
          label="成功"
          value={passedCount.toString()}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        />
        <StatCard
          label="失敗"
          value={failedCount.toString()}
          icon={<XCircle className="w-5 h-5 text-red-400" />}
        />
        <StatCard
          label="FB済み"
          value={feedbackCount.toString()}
          icon={<MessageSquare className="w-5 h-5 text-cyan-400" />}
        />
      </div>

      {/* Results Table with Side Panel */}
      <WritingSubmissionsTable submissions={submissions} />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
          <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center text-slate-400">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
