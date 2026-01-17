'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type AgentRunDetails = {
  run: {
    id: string;
    mode: string;
    goal: string;
    status: string;
    resultJson: { message?: string } | null;
  };
  steps: Array<{
    id: string;
    stepIndex: number;
    kind: string;
    outputJson: any;
  }>;
  toolInvocations: Array<{
    id: string;
    toolName: string;
    status: string;
    argsJson: any;
    resultJson: any;
    errorMessage?: string | null;
  }>;
  safetyDecisions: Array<{
    id: string;
    invocationId: string;
    decision: string;
    reasonsJson: any;
    feedbackToAgent?: string | null;
  }>;
  routingDecisions: Array<{
    id: string;
    stepId?: string | null;
    chosenProvider: string;
    chosenModel: string;
    toolset: string;
    reason: string;
  }>;
  evidence: Array<{
    id: string;
    claim: string;
    sourceType: string;
    confidence?: number | null;
  }>;
};

const MODES = [
  { value: 'mentor', label: 'mentor' },
  { value: 'coach', label: 'coach' },
  { value: 'deep_research', label: 'deep_research' },
  { value: 'code_assist', label: 'code_assist' },
  { value: 'generic', label: 'generic' },
];

export default function AgentPlaygroundPage() {
  const { data: session } = useSession();
  const [mode, setMode] = useState('mentor');
  const [goal, setGoal] = useState('');
  const [inputJson, setInputJson] = useState('{}');
  const [runId, setRunId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<AgentRunDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const startRun = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const parsedInput = inputJson ? JSON.parse(inputJson) : undefined;
      const response = await fetch(`${API_BASE_URL}/agent/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ mode, goal, inputJson: parsedInput }),
      });
      if (!response.ok) {
        throw new Error('Failed to start agent run');
      }
      const data = (await response.json()) as { runId: string };
      setRunId(data.runId);
      await refreshRun(data.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setLoading(false);
    }
  };

  const refreshRun = async (id?: string) => {
    if (!userId || !(id || runId)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/agent/runs/${id ?? runId}`, {
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch run');
      }
      const data = (await response.json()) as AgentRunDetails;
      setRunDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const continueRun = async () => {
    if (!userId || !runId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/agent/runs/${runId}/continue`, {
        method: 'POST',
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) {
        throw new Error('Failed to continue run');
      }
      await refreshRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue');
    } finally {
      setLoading(false);
    }
  };

  const confirmInvocation = async (invocationId: string, decision: 'allow' | 'deny') => {
    if (!userId || !runId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/agent/runs/${runId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ invocationId, decision }),
      });
      if (!response.ok) {
        throw new Error('Failed to confirm');
      }
      await refreshRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Agent Playground</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`px-3 py-1 rounded-full text-sm ${
                  mode === m.value ? 'bg-cyan-500 text-slate-900' : 'bg-slate-800 text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Input JSON</label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-3 text-xs text-white font-mono"
              rows={4}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={startRun} disabled={!goal || loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Run
            </Button>
            <Button variant="secondary" onClick={() => refreshRun()} disabled={!runId || loading}>
              Refresh
            </Button>
            <Button variant="outline" onClick={continueRun} disabled={!runId || loading}>
              Continue
            </Button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </CardContent>
      </Card>

      {runDetails && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Run Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span>ID: {runDetails.run.id}</span>
              <Badge variant="secondary">{runDetails.run.mode}</Badge>
              <Badge>{runDetails.run.status}</Badge>
            </div>
            {runDetails.run.resultJson?.message && (
              <div className="p-3 bg-slate-800 rounded-md text-slate-100 text-sm">
                {runDetails.run.resultJson.message}
              </div>
            )}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Steps</h3>
              {runDetails.steps.map((step) => (
                <div key={step.id} className="border border-slate-800 rounded-md p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Badge variant="secondary">#{step.stepIndex}</Badge>
                    <span>{step.kind}</span>
                  </div>
                  <pre className="mt-2 text-xs text-slate-200 whitespace-pre-wrap">
                    {JSON.stringify(step.outputJson, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Tool Invocations</h3>
              {runDetails.toolInvocations.map((invocation) => (
                <div key={invocation.id} className="border border-slate-800 rounded-md p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Badge variant="secondary">{invocation.toolName}</Badge>
                    <Badge>{invocation.status}</Badge>
                  </div>
                  <pre className="mt-2 text-xs text-slate-200 whitespace-pre-wrap">
                    {JSON.stringify(invocation.argsJson, null, 2)}
                  </pre>
                  {invocation.resultJson && (
                    <pre className="mt-2 text-xs text-slate-200 whitespace-pre-wrap">
                      {JSON.stringify(invocation.resultJson, null, 2)}
                    </pre>
                  )}
                  {invocation.errorMessage && (
                    <p className="text-xs text-red-400 mt-1">{invocation.errorMessage}</p>
                  )}
                  {invocation.status === 'needs_confirmation' && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => confirmInvocation(invocation.id, 'allow')}
                      >
                        Allow
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => confirmInvocation(invocation.id, 'deny')}
                      >
                        Deny
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Safety Decisions</h3>
              {runDetails.safetyDecisions.map((decision) => (
                <div key={decision.id} className="border border-slate-800 rounded-md p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Badge variant="secondary">{decision.decision}</Badge>
                    <span>Invocation: {decision.invocationId}</span>
                  </div>
                  <pre className="mt-2 text-xs text-slate-200 whitespace-pre-wrap">
                    {JSON.stringify(decision.reasonsJson, null, 2)}
                  </pre>
                  {decision.feedbackToAgent && (
                    <p className="text-xs text-slate-300 mt-1">{decision.feedbackToAgent}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Routing Decisions</h3>
              {runDetails.routingDecisions.map((decision) => (
                <div key={decision.id} className="border border-slate-800 rounded-md p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Badge variant="secondary">{decision.chosenProvider}</Badge>
                    <Badge>{decision.chosenModel}</Badge>
                    <Badge variant="outline">{decision.toolset}</Badge>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">{decision.reason}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Evidence</h3>
              {runDetails.evidence.map((item) => (
                <div key={item.id} className="border border-slate-800 rounded-md p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Badge variant="secondary">{item.sourceType}</Badge>
                    {item.confidence !== null && item.confidence !== undefined && (
                      <Badge variant="outline">{item.confidence}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-200 mt-2">{item.claim}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
