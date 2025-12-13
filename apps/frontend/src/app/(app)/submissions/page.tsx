import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { SubmissionsTable } from '@/components/submissions-table';
import { FileText } from 'lucide-react';

interface SubmissionSummary {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'EVALUATED';
  createdAt: string;
  updatedAt: string;
  exercise: {
    id: string;
    title: string;
    language: string;
    difficulty: number;
    genre: string | null;
  };
  avgScore: number | null;
  overallLevel: 'A' | 'B' | 'C' | 'D' | null;
  answerCount: number;
}

interface SubmissionsResponse {
  submissions: SubmissionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function getSubmissions(userId: string): Promise<SubmissionsResponse> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${apiUrl}/submissions?userId=${userId}&status=EVALUATED`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      console.error('Failed to fetch submissions:', response.status);
      return { submissions: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return { submissions: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
}

export default async function SubmissionsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { submissions, pagination } = await getSubmissions(session.user.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">リーディング結果</h1>
        <p className="text-slate-400">
          コードリーディングの評価結果を確認できます
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="総提出数"
          value={pagination.total.toString()}
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          label="A評価"
          value={submissions.filter((s) => s.overallLevel === 'A').length.toString()}
          icon={<span className="text-emerald-400 font-bold">A</span>}
        />
        <StatCard
          label="B評価"
          value={submissions.filter((s) => s.overallLevel === 'B').length.toString()}
          icon={<span className="text-cyan-400 font-bold">B</span>}
        />
        <StatCard
          label="平均スコア"
          value={
            submissions.length > 0
              ? `${Math.round(
                  submissions
                    .filter((s) => s.avgScore !== null)
                    .reduce((sum, s) => sum + (s.avgScore || 0), 0) /
                    submissions.filter((s) => s.avgScore !== null).length || 0
                )}点`
              : '-'
          }
          icon={<span className="text-violet-400">📊</span>}
        />
      </div>

      {/* Results Table with Side Panel */}
      <SubmissionsTable submissions={submissions} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
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

