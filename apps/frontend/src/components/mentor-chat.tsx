'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { findLlmInputViolation } from '@/lib/llm-input-guard';
import type { MentorMessage } from '@praccode/shared';

type MentorChatProps = {
  userId: string;
  exerciseId?: string;
  submissionId?: string;
};

const createTempMessage = (role: MentorMessage['role'], content: string): MentorMessage => ({
  id: `temp-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  threadId: 'temp',
  role,
  content,
  createdAt: new Date().toISOString(),
});

export function MentorChat({ userId, exerciseId, submissionId }: MentorChatProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState('');
  const [initError, setInitError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const initOnceRef = useRef(false);

  const initializeThread = useCallback(async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      const result = await api.createMentorThread({ userId, exerciseId, submissionId });
      setThreadId(result.threadId);
      const thread = await api.getMentorThread(result.threadId, userId);
      setMessages(thread.messages);
    } catch (error) {
      setInitError('メンターの準備に失敗しました。再試行してください。');
    } finally {
      setIsInitializing(false);
    }
  }, [exerciseId, submissionId, userId]);

  useEffect(() => {
    if (!userId) return;
    if (initOnceRef.current) return;
    initOnceRef.current = true;
    void initializeThread();
  }, [initializeThread, userId]);

  const handleSend = async () => {
    if (!input.trim() || !threadId || isSending) return;

    const violation = findLlmInputViolation([
      { field: 'メンターへの質問', value: input },
    ]);
    if (violation) {
      setSendError(`${violation.reason}: ${violation.field}`);
      return;
    }

    setSendError(null);
    setIsSending(true);

    const optimisticUser = createTempMessage('user', input);
    const optimisticAssistant = createTempMessage('assistant', '考え中...');

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
    setInput('');

    try {
      const result = await api.postMentorMessage(threadId, userId, input);
      setMessages((prev) => {
        const filtered = prev.filter(
          (message) =>
            message.id !== optimisticUser.id && message.id !== optimisticAssistant.id
        );
        return [...filtered, result.userMessage, result.assistantMessage];
      });
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticAssistant.id));
      if (error instanceof ApiError && error.statusCode === 503 && threadId) {
        try {
          const thread = await api.getMentorThread(threadId, userId);
          setMessages(thread.messages);
        } catch {
          // Ignore refresh errors and show message below.
        }
      }
      setSendError(error instanceof Error ? error.message : 'メンターの応答に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="border-slate-700/60 bg-slate-900/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          AIメンター
        </CardTitle>
        {isInitializing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            準備中
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {initError ? (
          <div className="space-y-3">
            <p className="text-sm text-red-400">{initError}</p>
            <Button size="sm" variant="secondary" onClick={initializeThread}>
              再試行
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="text-sm text-slate-400">
                  疑問点や読み方のコツを相談してみましょう。
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === 'user';
                  const isError = Boolean(message.metadata && message.metadata.error);
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={[
                          'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                          isUser
                            ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30'
                            : isError
                              ? 'bg-red-500/10 text-red-200 border border-red-500/30'
                              : 'bg-slate-800 text-slate-100 border border-slate-700/70',
                        ].join(' ')}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {sendError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {sendError}
              </div>
            )}

            <div className="space-y-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="どこが気になるか、どう読めば良いかを相談してください"
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSend}
                  disabled={isSending || !input.trim() || !threadId}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      送信
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
