'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

const MarkdownMessage = ({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      code: ({ className, inline, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        if (!inline && match) {
          return (
            <div className="my-3">
              <SyntaxHighlighter
                {...props}
                language={match[1]}
                style={oneDark}
                customStyle={{
                  margin: 0,
                  borderRadius: 12,
                  fontSize: '0.85rem',
                  background: 'rgba(15, 23, 42, 0.85)',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          );
        }
        return (
          <code className="rounded bg-slate-950/70 px-1 py-0.5 text-[0.85em] text-cyan-200">
            {children}
          </code>
        );
      },
    }}
  >
    {content}
  </ReactMarkdown>
);

export function MentorChat({ userId, exerciseId, submissionId }: MentorChatProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState('');
  const [initError, setInitError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const initOnceRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamingMessageId]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

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
    const optimisticAssistant = createTempMessage('assistant', '');

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
    setInput('');
    setStreamingMessageId(optimisticAssistant.id);

    const controller = new AbortController();
    streamAbortRef.current?.abort();
    streamAbortRef.current = controller;

    let streamedContent = '';
    let finalUserMessage: MentorMessage | null = null;
    let finalAssistantMessage: MentorMessage | null = null;

    try {
      for await (const event of api.streamMentorMessage({
        threadId,
        userId,
        content: input,
        signal: controller.signal,
      })) {
        if (event.type === 'start') {
          finalUserMessage = event.userMessage;
        }
        if (event.type === 'delta') {
          streamedContent += event.delta;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === optimisticAssistant.id
                ? { ...message, content: streamedContent }
                : message
            )
          );
        }
        if (event.type === 'done') {
          finalAssistantMessage = event.assistantMessage;
        }
        if (event.type === 'error') {
          setSendError(event.message);
          if (event.assistantMessage) {
            finalAssistantMessage = event.assistantMessage;
          }
        }
      }

      setMessages((prev) => {
        const filtered = prev.filter(
          (message) =>
            message.id !== optimisticUser.id && message.id !== optimisticAssistant.id
        );
        const next = [...filtered];
        next.push(finalUserMessage ?? optimisticUser);
        if (finalAssistantMessage) {
          next.push(finalAssistantMessage);
        } else if (streamedContent.trim()) {
          next.push({ ...optimisticAssistant, content: streamedContent });
        }
        return next;
      });
    } catch (error) {
      setMessages((prev) =>
        prev.filter((message) => message.id !== optimisticAssistant.id)
      );
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
      setStreamingMessageId(null);
    }
  };

  return (
    <Card className="border-slate-700/60 bg-slate-950/50 shadow-lg shadow-cyan-500/10">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/60">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
            <Sparkles className="w-4 h-4" />
          </span>
          AIメンター
        </CardTitle>
        {isInitializing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            準備中
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {initError ? (
          <div className="space-y-3">
            <p className="text-sm text-red-400">{initError}</p>
            <Button size="sm" variant="secondary" onClick={initializeThread}>
              再試行
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-900/30 px-4 py-3 text-sm text-slate-400">
                  弱点の克服や深掘り質問など、学習の相談を気軽にどうぞ。
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === 'user';
                  const isError = Boolean(message.metadata && message.metadata.error);
                  const isStreaming = streamingMessageId === message.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[88%]">
                        {!isUser && (
                          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
                            メンター
                          </div>
                        )}
                        <div
                          className={[
                            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                            isUser
                              ? 'bg-gradient-to-br from-cyan-500/25 via-cyan-500/15 to-slate-900/60 text-cyan-100 border border-cyan-500/30'
                              : isError
                                ? 'bg-red-500/10 text-red-200 border border-red-500/30'
                                : 'bg-slate-900/70 text-slate-100 border border-slate-700/70',
                          ].join(' ')}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          ) : message.content ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                              <MarkdownMessage content={message.content} />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                              返答を作成中...
                            </div>
                          )}
                          {isStreaming && message.content && (
                            <span className="ml-1 inline-block h-3 w-2 animate-pulse rounded-sm bg-cyan-400/80 align-middle" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollAnchorRef} />
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
                placeholder="弱点の克服や深掘りしたいポイントを相談してください"
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
