'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface CodeViewerProps {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

export function CodeViewer({
  code,
  language,
  showLineNumbers = true,
  highlightLines = [],
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [collapsedRanges, setCollapsedRanges] = useState<Set<number>>(new Set());

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detect function/class boundaries for collapsing
  const lines = code.split('\n');
  const collapsibleRanges = detectCollapsibleRanges(lines, language);

  const toggleCollapse = (startLine: number) => {
    setCollapsedRanges((prev) => {
      const next = new Set(prev);
      if (next.has(startLine)) {
        next.delete(startLine);
      } else {
        next.add(startLine);
      }
      return next;
    });
  };

  // Filter out collapsed lines
  const visibleLines = getVisibleLines(lines, collapsedRanges, collapsibleRanges);

  return (
    <div className="relative group rounded-xl overflow-hidden bg-[#1e1e1e] border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
        <span className="text-sm text-slate-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-white rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="code-viewer overflow-auto max-h-[600px]">
        <SyntaxHighlighter
          language={getHighlighterLanguage(language)}
          style={vscDarkPlus}
          showLineNumbers={showLineNumbers}
          wrapLines={true}
          lineProps={(lineNumber) => {
            const style: React.CSSProperties = {};
            if (highlightLines.includes(lineNumber)) {
              style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
              style.borderLeft = '3px solid rgb(56, 189, 248)';
              style.marginLeft = '-3px';
            }
            return { style };
          }}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
        >
          {visibleLines.code}
        </SyntaxHighlighter>
      </div>

      {/* Collapse indicators */}
      {collapsibleRanges.map((range) => (
        <CollapsibleIndicator
          key={range.start}
          range={range}
          isCollapsed={collapsedRanges.has(range.start)}
          onToggle={() => toggleCollapse(range.start)}
        />
      ))}
    </div>
  );
}

interface CollapsibleRange {
  start: number;
  end: number;
  label: string;
}

function CollapsibleIndicator({
  range,
  isCollapsed,
  onToggle,
}: {
  range: CollapsibleRange;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  // This is a simplified indicator - in a full implementation,
  // you'd calculate the actual position based on line numbers
  return null; // Simplified for MVP - full collapse functionality would need more work
}

function detectCollapsibleRanges(lines: string[], language: string): CollapsibleRange[] {
  const ranges: CollapsibleRange[] = [];

  // Simple detection for functions/classes (can be enhanced)
  const functionPatterns: Record<string, RegExp> = {
    typescript: /^(\s*)(async\s+)?(function|const|let|var|class|interface|type)\s+(\w+)/,
    javascript: /^(\s*)(async\s+)?(function|const|let|var|class)\s+(\w+)/,
    go: /^func\s+(\w+)/,
    ruby: /^(\s*)(def|class|module)\s+(\w+)/,
    python: /^(\s*)(def|class|async def)\s+(\w+)/,
    rust: /^(\s*)(fn|struct|impl|enum)\s+(\w+)/,
  };

  const pattern = functionPatterns[language];
  if (!pattern) return ranges;

  let braceCount = 0;
  let currentRange: { start: number; label: string } | null = null;

  lines.forEach((line, index) => {
    const match = line.match(pattern);
    if (match && braceCount === 0) {
      currentRange = { start: index + 1, label: match[match.length - 1] || 'block' };
    }

    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;

    if (currentRange && braceCount === 0 && line.includes('}')) {
      ranges.push({
        ...currentRange,
        end: index + 1,
      });
      currentRange = null;
    }
  });

  return ranges;
}

function getVisibleLines(
  lines: string[],
  collapsedRanges: Set<number>,
  collapsibleRanges: CollapsibleRange[]
): { code: string; lineMapping: number[] } {
  // For MVP, just return all lines
  return {
    code: lines.join('\n'),
    lineMapping: lines.map((_, i) => i + 1),
  };
}

function getHighlighterLanguage(language: string): string {
  const mapping: Record<string, string> = {
    typescript: 'typescript',
    javascript: 'javascript',
    go: 'go',
    ruby: 'ruby',
    python: 'python',
    rust: 'rust',
  };
  return mapping[language] || 'javascript';
}

