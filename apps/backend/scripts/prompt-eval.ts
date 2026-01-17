import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { generateWithOllama } from '../src/infrastructure/llm/llm-client.js';
import { estimateTokens } from '../src/infrastructure/llm/token-estimator.js';

type TaskType = 'grade_code_reading' | 'answer_qa';

type DatasetItem = {
  id: string;
  task: TaskType;
  question: string;
  context: {
    language: 'ts' | 'go' | 'rb' | 'md' | 'mixed';
    text: string;
  };
  studentAnswer?: string;
  gold: {
    goldPoints: string[];
    forbiddenClaims?: string[];
  };
  meta?: {
    tags?: string[];
    expectedJsonSchema?: 'grader_v1';
  };
};

type EvalConfig = {
  promptVersion: 'grader_v1' | 'grader_v2' | 'grader_v3';
  temperature: number;
  maxOutputTokens: number;
  lineNumbers: boolean;
  k: number;
  maxLinesPerChunk: number;
  queryExpander: boolean;
  contextSelector: boolean;
};

type Evidence = { quote: string };
type Claim = { text: string; evidence: Evidence[] };
type PointEntry = { text: string; evidence: Evidence[] };
type WrongPointEntry = { text: string; why_wrong: string; evidence: Evidence[] };

const CRITERIA = ['responsibility', 'data_flow', 'error_handling', 'reliability', 'clarity'] as const;
type CriterionName = (typeof CRITERIA)[number];

type NormalizedOutput = {
  overall_score: number | null;
  criteria: Record<CriterionName, { score: number | null; comment: string; evidence: Evidence[] }>;
  good_points: PointEntry[];
  missing_points: PointEntry[];
  wrong_points: WrongPointEntry[];
  next_actions: PointEntry[];
  gold_point_eval: GoldPointEval;
};

type GoldPointEval = {
  covered: Array<{ id: number; evidence: Evidence[] }>;
  missing: number[];
  notes: string;
};

type EvalMetrics = {
  modelOverallScore: number | null;
  overallScoreCalc: number;
  overallScoreMismatch: boolean;
  groundedClaimRate: number;
  normalizedGroundedClaimRate: number;
  evidenceQuoteHitRate: number;
  goldPointCoverageRate: number;
  goldPointSelfReportRate: number;
  goldPointCheatRate: number;
  lexicalOverlapProxy: number;
  forbiddenClaimRate: number;
  quoteContainsForbiddenRate: number;
};

type ItemRunResult = { ok: true; metrics: EvalMetrics } | { ok: false };

type GoldPointStatus = {
  goldPoints: string[];
  claimedCoveredIds: number[];
  validCoveredIds: number[];
  missingIds: number[];
  perIdStatus: Array<{
    id: number;
    status: 'covered_valid' | 'covered_invalid' | 'missing' | 'unreported';
  }>;
};

type ConfigResult = {
  config: EvalConfig;
  goldPointCoverageRate: number;
  goldPointSelfReportRate: number;
  goldPointCheatRate: number;
  lexicalOverlapProxy: number;
  tokenEstimate: number;
  redundancyRatio: number;
  groundedClaimRate: number;
  normalizedGroundedClaimRate: number;
  evidenceQuoteHitRate: number;
  forbiddenClaimRate: number;
  quoteContainsForbiddenRate: number;
  modelOverallScore: number | null;
  overallScoreCalc: number;
  overallScoreMismatchRate: number;
  items: number;
  parseFailures: number;
};

type RunResult = ConfigResult & {
  runIndex: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../..');
const DATASET_PATH = resolve(PROJECT_ROOT, 'llm-tools/eval/datasets/prompt_eval_v1.jsonl');
const OUT_DIR = resolve(PROJECT_ROOT, 'out');

const PROMPT_VERSIONS: EvalConfig['promptVersion'][] = ['grader_v1', 'grader_v2', 'grader_v3'];
const TEMPERATURES = [0, 0.2];
const MAX_OUTPUT_TOKENS = [512, 1024];

async function loadDataset(path: string): Promise<DatasetItem[]> {
  const content = await readFile(path, 'utf-8');
  const items: DatasetItem[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    items.push(JSON.parse(trimmed) as DatasetItem);
  }
  return items;
}

function buildPrompt(
  item: DatasetItem,
  promptVersion: EvalConfig['promptVersion'],
  lineNumbers: boolean
): string {
  const forbiddenClaims = item.gold.forbiddenClaims?.length
    ? item.gold.forbiddenClaims.join('\n')
    : '';
  const goldPointsBlock = item.gold.goldPoints.length
    ? [
        '[GOLD_POINTS]',
        ...item.gold.goldPoints.map((point, index) => `GP${index}: ${point}`),
        '',
      ].join('\n')
    : '[GOLD_POINTS]\n';

  const versionNote =
    promptVersion === 'grader_v2'
      ? '【追加指示】根拠の引用は短く、最小限の抜粋にすること。'
      : promptVersion === 'grader_v3'
        ? '【追加指示】IDの判定は慎重に行い、不明な場合はmissingにすること。'
        : '';
  const contextText = lineNumbers ? addLineNumbers(item.context.text) : item.context.text;
  const evidenceRuleTop = lineNumbers
    ? '- evidence.quote は【CONTEXT】の L###: で始まる1行をそのままコピー（改行禁止）。'
    : '- evidence.quote は【CONTEXT】からコピーした“連続した1行”の抜粋のみ（改行禁止）。';
  const evidenceRule = lineNumbers
    ? '- evidence.quote は L###: で始まる1行をそのままコピー（改行なし）。200文字以内、\"…\" 禁止。'
    : '- evidence.quote は CONTEXT からの連続した1行で、改行なし・200文字以内・\"…\" 不可。';

  return [
    'あなたはコード/仕様テキストに基づいて受講者の回答を採点する採点者です。',
    '',
    '【最重要ルール】',
    '- 根拠は【CONTEXT】のみ。外部知識・推測は禁止。',
    '- 根拠が見つからない場合は「コンテキストから判断できません」と書き、evidenceは空配列 [] にする。',
    evidenceRuleTop,
    '- evidence.quote は最大200文字、"…" は絶対に使わない。',
    '- 出力は JSON のみ。JSONの外側に文章を一切書かない。',
    '- 末尾カンマ禁止、ダブルクォートで正しいJSONにする。',
    '',
    '【入力】',
    '[QUESTION]',
    item.question,
    '',
    '[STUDENT_ANSWER]',
    item.studentAnswer ?? '',
    '',
    '[CONTEXT]',
    contextText,
    '',
    goldPointsBlock,
    '[FORBIDDEN_CLAIMS]（空なら無視）',
    forbiddenClaims,
    '',
    versionNote,
    '',
    '【出力(JSON)】',
    '{',
    '  "overall_score": 0,',
    '  "criteria": {',
    '    "responsibility": {"score":0,"comment":"","evidence":[]},',
    '    "data_flow": {"score":0,"comment":"","evidence":[]},',
    '    "error_handling": {"score":0,"comment":"","evidence":[]},',
    '    "reliability": {"score":0,"comment":"","evidence":[]},',
    '    "clarity": {"score":0,"comment":"","evidence":[]}',
    '  },',
    '  "good_points": [],',
    '  "missing_points": [],',
    '  "wrong_points": [],',
    '  "next_actions": [],',
    '  "gold_point_eval": {',
    '    "covered": [',
    '      {"id": 0, "evidence": [{"chunk_id":"CTX","lines":"n/a","quote":""}]}',
    '    ],',
    '    "missing": [1],',
    '    "notes": ""',
    '  }',
    '}',
    '',
    '【evidence要素の形式】',
    'evidence の各要素は次の形：',
    '{"chunk_id":"CTX","lines":"n/a","quote":"（CONTEXTからの1行抜粋）"}',
    '',
    '【制限】',
    '- good_points / missing_points / wrong_points / next_actions は各最大5件',
    '- good_points / missing_points / next_actions の要素は {"text":"","evidence":[]} 形式',
    '- wrong_points の要素は {"text":"","why_wrong":"","evidence":[]} 形式',
    '- gold_point_eval.covered の各要素は {"id": 数値, "evidence": [...]} 形式',
    '- criteria.*.comment と good/missing/wrong の text/why_wrong は各120文字以内',
    '- forbiddenClaims が指定されている場合、comment/text/why_wrong/next_actions に含めない（quoteは除外してよい）',
    '- gold_point_eval は必ず出力すること。判断に迷う場合は missing に入れる。',
    '- gold_point_eval.covered は evidence 必須 (1件以上)。推測で covered にしない。',
    '- gold_point_eval の id は GOLD_POINTS の番号に対応する（GP0 -> 0）。',
    '- GOLD_POINTS が空の場合、gold_point_eval.covered と gold_point_eval.missing は空配列にする。',
    evidenceRule,
  ].join('\n');
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

function normalizeEvidence(value: unknown): Evidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return { quote: entry };
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { quote?: unknown }).quote === 'string'
      ) {
        return { quote: (entry as { quote: string }).quote };
      }
      return null;
    })
    .filter((entry): entry is Evidence => Boolean(entry))
    .map((entry) => ({ quote: entry.quote.trim() }))
    .filter((entry) => entry.quote.length > 0);
}

function normalizePoint(value: unknown): PointEntry {
  if (typeof value === 'string') {
    return { text: value, evidence: [] };
  }
  if (value && typeof value === 'object') {
    const candidate = value as { text?: string; comment?: string; evidence?: unknown };
    const text =
      typeof candidate.text === 'string'
        ? candidate.text
        : typeof candidate.comment === 'string'
          ? candidate.comment
          : '';
    return {
      text,
      evidence: normalizeEvidence(candidate.evidence),
    };
  }
  return { text: '', evidence: [] };
}

function normalizeWrongPoint(value: unknown): WrongPointEntry {
  if (typeof value === 'string') {
    return { text: value, why_wrong: '', evidence: [] };
  }
  if (value && typeof value === 'object') {
    const candidate = value as {
      text?: string;
      comment?: string;
      why_wrong?: string;
      whyWrong?: string;
      evidence?: unknown;
    };
    const rawWhyWrong =
      typeof candidate.why_wrong === 'string'
        ? candidate.why_wrong
        : typeof candidate.whyWrong === 'string'
          ? candidate.whyWrong
          : '';
    let text = '';
    if (typeof candidate.text === 'string') {
      text = candidate.text;
    } else if (typeof candidate.comment === 'string') {
      text = candidate.comment;
    } else if (rawWhyWrong) {
      text = rawWhyWrong;
    }
    return {
      text,
      why_wrong: rawWhyWrong,
      evidence: normalizeEvidence(candidate.evidence),
    };
  }
  return { text: '', why_wrong: '', evidence: [] };
}

const goldPointEvalSchema = z.object({
  covered: z
    .array(
      z.object({
        id: z.number().int(),
        evidence: z.array(z.unknown()).optional(),
      })
    )
    .default([]),
  missing: z.array(z.number().int()).default([]),
  notes: z.string().optional(),
});

function normalizeGoldPointEval(raw: unknown, goldPointsLength: number): GoldPointEval {
  const parsed = goldPointEvalSchema.safeParse(raw);
  const data = parsed.success
    ? parsed.data
    : {
        covered: [],
        missing: [],
        notes: '',
      };

  const isValidId = (id: number) => id >= 0 && id < goldPointsLength;

  const covered = data.covered
    .filter((entry) => typeof entry.id === 'number' && isValidId(entry.id))
    .map((entry) => ({
      id: entry.id,
      evidence: normalizeEvidence(entry.evidence),
    }));

  const missing = data.missing.filter((id) => isValidId(id));

  return {
    covered,
    missing: Array.from(new Set(missing)),
    notes: typeof data.notes === 'string' ? data.notes : '',
  };
}

function normalizeOutput(raw: unknown, goldPointsLength: number): NormalizedOutput {
  const output = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const criteriaInput = (output.criteria && typeof output.criteria === 'object'
    ? output.criteria
    : {}) as Record<string, unknown>;

  const criteria = CRITERIA.reduce((acc, name) => {
    const entry = (criteriaInput[name] && typeof criteriaInput[name] === 'object'
      ? criteriaInput[name]
      : {}) as { score?: unknown; comment?: unknown; evidence?: unknown };
    acc[name] = {
      score: typeof entry.score === 'number' ? entry.score : null,
      comment: typeof entry.comment === 'string' ? entry.comment : '',
      evidence: normalizeEvidence(entry.evidence),
    };
    return acc;
  }, {} as NormalizedOutput['criteria']);

  const good_points = Array.isArray(output.good_points)
    ? output.good_points.map(normalizePoint)
    : [];
  const missing_points = Array.isArray(output.missing_points)
    ? output.missing_points.map(normalizePoint)
    : [];
  const wrong_points = Array.isArray(output.wrong_points)
    ? output.wrong_points.map(normalizeWrongPoint)
    : [];
  const next_actions = Array.isArray(output.next_actions)
    ? output.next_actions.map(normalizePoint)
    : [];

  return {
    overall_score: typeof output.overall_score === 'number' ? output.overall_score : null,
    criteria,
    good_points,
    missing_points,
    wrong_points,
    next_actions,
    gold_point_eval: normalizeGoldPointEval(output.gold_point_eval, goldPointsLength),
  };
}

function extractClaims(normalized: NormalizedOutput): Claim[] {
  const claims: Claim[] = [];
  for (const name of CRITERIA) {
    claims.push({
      text: normalized.criteria[name].comment,
      evidence: normalized.criteria[name].evidence,
    });
  }
  claims.push(
    ...normalized.good_points.map((point) => ({ text: point.text, evidence: point.evidence })),
    ...normalized.missing_points.map((point) => ({ text: point.text, evidence: point.evidence })),
    ...normalized.wrong_points.map((point) => ({ text: point.text, evidence: point.evidence }))
  );
  return claims;
}

function collectForbiddenTexts(normalized: NormalizedOutput): string[] {
  const texts: string[] = [];
  for (const name of CRITERIA) {
    if (normalized.criteria[name].comment) {
      texts.push(normalized.criteria[name].comment);
    }
  }
  for (const point of normalized.good_points) {
    if (point.text) texts.push(point.text);
  }
  for (const point of normalized.missing_points) {
    if (point.text) texts.push(point.text);
  }
  for (const point of normalized.wrong_points) {
    if (point.text) texts.push(point.text);
    if (point.why_wrong) texts.push(point.why_wrong);
  }
  for (const point of normalized.next_actions) {
    if (point.text) texts.push(point.text);
  }
  return texts;
}

function collectQuotes(normalized: NormalizedOutput): Evidence[] {
  const quotes: Evidence[] = [];
  for (const name of CRITERIA) {
    quotes.push(...normalized.criteria[name].evidence);
  }
  for (const point of normalized.good_points) quotes.push(...point.evidence);
  for (const point of normalized.missing_points) quotes.push(...point.evidence);
  for (const point of normalized.wrong_points) quotes.push(...point.evidence);
  for (const point of normalized.next_actions) quotes.push(...point.evidence);
  for (const entry of normalized.gold_point_eval.covered) {
    quotes.push(...entry.evidence);
  }
  return quotes;
}

function computeOverallScoreCalc(
  criteria: NormalizedOutput['criteria']
): number {
  const sum = CRITERIA.reduce((acc, name) => {
    const value = criteria[name].score;
    return acc + (typeof value === 'number' ? value : 0);
  }, 0);
  return Math.round((sum / 25) * 100);
}

function groundednessMetrics(
  claims: Claim[],
  contextText: string,
  requireLineNumberPrefix: boolean
) {
  let groundedClaims = 0;
  let normalizedGroundedClaims = 0;
  let totalClaims = 0;
  let hitQuotes = 0;
  let totalQuotes = 0;
  const normalizedContext = normalizeWhitespace(contextText);

  for (const claim of claims) {
    totalClaims += 1;
    const quotes = claim.evidence.map((e) => e.quote).filter((q) => q.length > 0);
    let claimGrounded = false;
    let normalizedClaimGrounded = false;
    for (const quote of quotes) {
      totalQuotes += 1;
      const match = quoteMatchesContext(
        quote,
        contextText,
        normalizedContext,
        requireLineNumberPrefix
      );
      if (match.strict) {
        hitQuotes += 1;
        claimGrounded = true;
      }
      if (!normalizedClaimGrounded && match.normalized) {
        normalizedClaimGrounded = true;
      }
    }
    if (claimGrounded) groundedClaims += 1;
    if (normalizedClaimGrounded) normalizedGroundedClaims += 1;
  }

  return {
    groundedClaimRate: totalClaims === 0 ? 0 : groundedClaims / totalClaims,
    normalizedGroundedClaimRate: totalClaims === 0 ? 0 : normalizedGroundedClaims / totalClaims,
    evidenceQuoteHitRate: totalQuotes === 0 ? 0 : hitQuotes / totalQuotes,
  };
}

function redundancyRatio(contextText: string): number {
  const lines = contextText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length <= 1) return 0;
  const unique = new Set(lines);
  return 1 - unique.size / lines.length;
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function addLineNumbers(text: string): string {
  const lines = text.split('\n');
  const width = Math.max(3, String(lines.length).length);
  return lines
    .map((line, index) => `L${String(index + 1).padStart(width, '0')}: ${line}`)
    .join('\n');
}

function quoteMatchesContext(
  quote: string,
  contextText: string,
  normalizedContext?: string,
  requireLineNumberPrefix: boolean = false
): { strict: boolean; normalized: boolean } {
  if (requireLineNumberPrefix && !/^L\d{3,}:\s/.test(quote)) {
    return { strict: false, normalized: false };
  }
  const strict = quote.length > 0 && contextText.includes(quote);
  const normalizedQuote = normalizeWhitespace(quote);
  const normalizedTarget = normalizedContext ?? normalizeWhitespace(contextText);
  const normalized =
    normalizedQuote.length > 0 && normalizedTarget.length > 0
      ? normalizedTarget.includes(normalizedQuote)
      : false;
  return { strict, normalized };
}

function toBigrams(text: string): Set<string> {
  if (text.length <= 1) return new Set([text]);
  const grams = new Set<string>();
  for (let i = 0; i < text.length - 1; i += 1) {
    grams.add(text.slice(i, i + 2));
  }
  return grams;
}

function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aBigrams = toBigrams(a);
  const bBigrams = toBigrams(b);
  if (aBigrams.size === 0 || bBigrams.size === 0) return 0;
  let intersection = 0;
  for (const gram of aBigrams) {
    if (bBigrams.has(gram)) intersection += 1;
  }
  const union = aBigrams.size + bBigrams.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isMatch(predicted: string, gold: string): boolean {
  const normPred = normalizeForMatch(predicted);
  const normGold = normalizeForMatch(gold);
  if (!normPred || !normGold) return false;
  if (normGold.includes(normPred) || normPred.includes(normGold)) return true;
  return bigramSimilarity(normPred, normGold) >= 0.35;
}

function lexicalOverlapProxy(
  predictedPoints: string[],
  goldPoints: string[],
  k: number
): number {
  if (goldPoints.length === 0) {
    return 0;
  }
  const topK = predictedPoints.slice(0, k);
  const matchedGold = new Set<number>();
  let matchedPredicted = 0;

  topK.forEach((point) => {
    for (let i = 0; i < goldPoints.length; i += 1) {
      if (matchedGold.has(i)) continue;
      if (isMatch(point, goldPoints[i])) {
        matchedGold.add(i);
        matchedPredicted += 1;
        break;
      }
    }
  });

  const matchedCount = matchedGold.size;
  const precision = topK.length === 0 ? 0 : matchedPredicted / topK.length;
  const recall = matchedCount / goldPoints.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return f1;
}

function goldPointIdMetrics(
  goldPointEval: GoldPointEval,
  goldPointsLength: number,
  contextText: string,
  requireLineNumberPrefix: boolean
): {
  claimedCoveredIds: number[];
  validCoveredIds: number[];
  missingIds: number[];
  goldPointSelfReportRate: number;
  goldPointCoverageRate: number;
  goldPointCheatRate: number;
} {
  if (goldPointsLength <= 0) {
    return {
      claimedCoveredIds: [],
      validCoveredIds: [],
      missingIds: [],
      goldPointSelfReportRate: 0,
      goldPointCoverageRate: 0,
      goldPointCheatRate: 0,
    };
  }

  const normalizedContext = normalizeWhitespace(contextText);
  const claimedCoveredIds = Array.from(
    new Set(goldPointEval.covered.map((entry) => entry.id))
  );
  const validCoveredIds = new Set<number>();

  for (const entry of goldPointEval.covered) {
    if (validCoveredIds.has(entry.id)) continue;
    const hasValidEvidence = entry.evidence.some((evidence) => {
      const match = quoteMatchesContext(
        evidence.quote,
        contextText,
        normalizedContext,
        requireLineNumberPrefix
      );
      return match.strict || match.normalized;
    });
    if (hasValidEvidence) {
      validCoveredIds.add(entry.id);
    }
  }

  const validCoveredIdsList = Array.from(validCoveredIds);
  const goldPointSelfReportRate = claimedCoveredIds.length / goldPointsLength;
  const goldPointCoverageRate = validCoveredIdsList.length / goldPointsLength;
  const invalidCoveredCount = claimedCoveredIds.filter((id) => !validCoveredIds.has(id)).length;
  const goldPointCheatRate =
    claimedCoveredIds.length === 0 ? 0 : invalidCoveredCount / claimedCoveredIds.length;

  const missingIds = goldPointEval.missing.filter(
    (id) => !validCoveredIds.has(id) && !claimedCoveredIds.includes(id)
  );

  return {
    claimedCoveredIds,
    validCoveredIds: validCoveredIdsList,
    missingIds,
    goldPointSelfReportRate,
    goldPointCoverageRate,
    goldPointCheatRate,
  };
}

function forbiddenClaimMetrics(
  texts: string[],
  forbiddenClaims: string[] | undefined,
  quotes: Evidence[]
): { forbiddenClaimRate: number; quoteContainsForbiddenRate: number } {
  if (!forbiddenClaims || forbiddenClaims.length === 0) {
    return { forbiddenClaimRate: 0, quoteContainsForbiddenRate: 0 };
  }
  let forbiddenHits = 0;
  let quoteHits = 0;
  const normalizedForbidden = forbiddenClaims.map((claim) => normalizeForMatch(claim));

  const textMatchesForbidden = (text: string) => {
    const normalized = normalizeForMatch(text);
    if (!normalized) return false;
    return normalizedForbidden.some((forbidden) => forbidden && normalized.includes(forbidden));
  };

  for (const text of texts) {
    if (textMatchesForbidden(text)) {
      forbiddenHits += 1;
    }
  }

  for (const quote of quotes) {
    if (textMatchesForbidden(quote.quote)) {
      quoteHits += 1;
    }
  }

  return {
    forbiddenClaimRate: texts.length === 0 ? 0 : forbiddenHits / texts.length,
    quoteContainsForbiddenRate: quotes.length === 0 ? 0 : quoteHits / quotes.length,
  };
}

async function evaluateItem(item: DatasetItem, config: EvalConfig) {
  const prompt = buildPrompt(item, config.promptVersion, config.lineNumbers);
  let response = '';
  try {
    response = await generateWithOllama(prompt, {
      temperature: config.temperature,
      maxTokens: config.maxOutputTokens,
      jsonMode: true,
      timeoutMs: 120000,
    });

    const parsed = JSON.parse(extractJson(response)) as unknown;
    const normalized = normalizeOutput(parsed, item.gold.goldPoints.length);
    const contextForQuotes = config.lineNumbers
      ? addLineNumbers(item.context.text)
      : item.context.text;
    const claims = extractClaims(normalized);
    const grounded = groundednessMetrics(claims, contextForQuotes, config.lineNumbers);

    const predictedPoints = normalized.good_points.map((point) => point.text).filter(Boolean);
    const lexicalProxy = lexicalOverlapProxy(predictedPoints, item.gold.goldPoints, config.k);
    const idCoverage = goldPointIdMetrics(
      normalized.gold_point_eval,
      item.gold.goldPoints.length,
      contextForQuotes,
      config.lineNumbers
    );
    const forbiddenTexts = collectForbiddenTexts(normalized);
    const allQuotes = collectQuotes(normalized);
    const forbidden = forbiddenClaimMetrics(forbiddenTexts, item.gold.forbiddenClaims, allQuotes);
    const overallScoreCalc = computeOverallScoreCalc(normalized.criteria);
    const modelOverallScore =
      typeof normalized.overall_score === 'number' ? normalized.overall_score : null;
    const overallScoreMismatch =
      modelOverallScore === null ? true : Math.abs(modelOverallScore - overallScoreCalc) > 10;

    return {
      ok: true as const,
      metrics: {
        modelOverallScore,
        overallScoreCalc,
        overallScoreMismatch,
        groundedClaimRate: grounded.groundedClaimRate,
        normalizedGroundedClaimRate: grounded.normalizedGroundedClaimRate,
        evidenceQuoteHitRate: grounded.evidenceQuoteHitRate,
        goldPointCoverageRate: idCoverage.goldPointCoverageRate,
        goldPointSelfReportRate: idCoverage.goldPointSelfReportRate,
        goldPointCheatRate: idCoverage.goldPointCheatRate,
        lexicalOverlapProxy: lexicalProxy,
        forbiddenClaimRate: forbidden.forbiddenClaimRate,
        quoteContainsForbiddenRate: forbidden.quoteContainsForbiddenRate,
      },
      parsed,
      normalized,
      goldPointStatus: {
        goldPoints: item.gold.goldPoints,
        claimedCoveredIds: idCoverage.claimedCoveredIds,
        validCoveredIds: idCoverage.validCoveredIds,
        missingIds: idCoverage.missingIds,
        perIdStatus: item.gold.goldPoints.map((_, id) => {
          if (idCoverage.validCoveredIds.includes(id)) {
            return { id, status: 'covered_valid' };
          }
          if (idCoverage.claimedCoveredIds.includes(id)) {
            return { id, status: 'covered_invalid' };
          }
          if (idCoverage.missingIds.includes(id)) {
            return { id, status: 'missing' };
          }
          return { id, status: 'unreported' };
        }),
      },
      prompt,
      rawResponse: response,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: (error as Error).message,
      prompt,
      rawResponse: response || null,
    };
  }
}

function formatRate(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : '';
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '';
}

async function run() {
  const { options, runId } = parseArgs(process.argv.slice(2));
  const dataset = await loadDataset(DATASET_PATH);
  if (dataset.length === 0) {
    throw new Error('Dataset is empty.');
  }

  let filtered = dataset;
  if (options.ids.length > 0) {
    const idSet = new Set(options.ids);
    filtered = filtered.filter((item) => idSet.has(item.id));
  }

  if (options.seed !== null) {
    filtered = shuffleWithSeed(filtered, options.seed);
  }

  if (options.maxItems !== null) {
    filtered = filtered.slice(0, options.maxItems);
  }

  if (filtered.length === 0) {
    throw new Error('No dataset items after filtering.');
  }

  const grid = buildGrid(options);
  const contextStats = computeContextStats(filtered, options.lineNumbers);
  const runResults: RunResult[] = [];

  for (const config of grid) {
    console.info(
      `[prompt-eval] Running config promptVersion=${config.promptVersion}, temperature=${config.temperature}, maxOutputTokens=${config.maxOutputTokens}`
    );

    const configHash = configToHash(config);
    const runDir = resolve(OUT_DIR, 'runs', runId, configHash);
    await mkdir(runDir, { recursive: true });

    for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
      const itemResults = await mapWithConcurrency(
        filtered,
        options.concurrency,
        async (item) => {
          const start = Date.now();
          const result = await evaluateItem(item, config);
          const itemDir = resolve(runDir, item.id);
          await mkdir(itemDir, { recursive: true });

          if (!result.ok) {
            const artifact = {
              itemId: item.id,
              run_index: runIndex,
              config,
              prompt: result.prompt,
              raw_response: result.rawResponse,
              parsed_json: null,
              normalized_response: null,
              metrics: null,
              error: result.error,
              timing_ms: Date.now() - start,
            };
            await writeFile(
              resolve(itemDir, `run_${runIndex}.json`),
              JSON.stringify(artifact, null, 2),
              'utf-8'
            );
            await appendGoldPointArtifact(
              resolve(itemDir, 'gold_points.json'),
              buildGoldPointArtifact(item, runIndex, null)
            );
            console.warn(`[prompt-eval] Failed item ${item.id}: ${result.error}`);
            return { ok: false as const };
          }

          const artifact = {
            itemId: item.id,
            run_index: runIndex,
            config,
            prompt: result.prompt,
            raw_response: result.rawResponse,
            parsed_json: result.parsed,
            normalized_response: result.normalized,
            metrics: {
              model_overall_score: result.metrics.modelOverallScore,
              overall_score_calc: result.metrics.overallScoreCalc,
              overall_score_mismatch: result.metrics.overallScoreMismatch,
              gold_point_coverage_rate: result.metrics.goldPointCoverageRate,
              gold_point_self_report_rate: result.metrics.goldPointSelfReportRate,
              gold_point_cheat_rate: result.metrics.goldPointCheatRate,
              lexical_overlap_proxy: result.metrics.lexicalOverlapProxy,
              grounded_claim_rate: result.metrics.groundedClaimRate,
              normalized_grounded_claim_rate: result.metrics.normalizedGroundedClaimRate,
              evidence_quote_hit_rate: result.metrics.evidenceQuoteHitRate,
              forbidden_claim_rate: result.metrics.forbiddenClaimRate,
              quote_contains_forbidden_rate: result.metrics.quoteContainsForbiddenRate,
            },
            timing_ms: Date.now() - start,
          };
          await writeFile(
            resolve(itemDir, `run_${runIndex}.json`),
            JSON.stringify(artifact, null, 2),
            'utf-8'
          );
          await appendGoldPointArtifact(
            resolve(itemDir, 'gold_points.json'),
            buildGoldPointArtifact(item, runIndex, result.goldPointStatus)
          );

          return { ok: true as const, metrics: result.metrics };
        }
      );

      runResults.push({
        config,
        runIndex,
        ...summarizeRun(itemResults, filtered.length, contextStats),
      });
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  const csvHeader = [
    'prompt_version',
    'temperature',
    'max_output_tokens',
    'run_index',
    'lineNumbers',
    'k',
    'maxLinesPerChunk',
    'queryExpander',
    'contextSelector',
    'model_overall_score',
    'overall_score_calc',
    'overall_score_mismatch_rate',
    'gold_point_self_report_rate',
    'gold_point_coverage_rate',
    'gold_point_cheat_rate',
    'lexical_overlap_proxy',
    'tokenEstimate',
    'redundancyRatio',
    'groundedClaimRate',
    'normalizedGroundedClaimRate',
    'evidenceQuoteHitRate',
    'forbiddenClaimRate',
    'quoteContainsForbiddenRate',
    'items',
    'parseFailures',
  ];

  const csvRows = runResults.map((row) =>
    [
      row.config.promptVersion,
      row.config.temperature,
      row.config.maxOutputTokens,
      row.runIndex,
      row.config.lineNumbers,
      row.config.k,
      row.config.maxLinesPerChunk,
      row.config.queryExpander,
      row.config.contextSelector,
      formatRate(row.modelOverallScore),
      formatRate(row.overallScoreCalc),
      formatRate(row.overallScoreMismatchRate),
      formatRate(row.goldPointSelfReportRate),
      formatRate(row.goldPointCoverageRate),
      formatRate(row.goldPointCheatRate),
      formatRate(row.lexicalOverlapProxy),
      formatNumber(row.tokenEstimate),
      formatRate(row.redundancyRatio),
      formatRate(row.groundedClaimRate),
      formatRate(row.normalizedGroundedClaimRate),
      formatRate(row.evidenceQuoteHitRate),
      formatRate(row.forbiddenClaimRate),
      formatRate(row.quoteContainsForbiddenRate),
      row.items,
      row.parseFailures,
    ].join(',')
  );

  const csvPath = resolve(OUT_DIR, 'experiments.csv');
  await writeFile(csvPath, [csvHeader.join(','), ...csvRows].join('\n'), 'utf-8');

  const aggregates = aggregateByConfig(runResults);
  const ranked = [...aggregates].sort((a, b) => {
    if (b.means.goldPointCoverageRate !== a.means.goldPointCoverageRate) {
      return b.means.goldPointCoverageRate - a.means.goldPointCoverageRate;
    }
    if (b.means.normalizedGroundedClaimRate !== a.means.normalizedGroundedClaimRate) {
      return b.means.normalizedGroundedClaimRate - a.means.normalizedGroundedClaimRate;
    }
    if (b.means.overallScoreCalc !== a.means.overallScoreCalc) {
      return b.means.overallScoreCalc - a.means.overallScoreCalc;
    }
    return b.means.groundedClaimRate - a.means.groundedClaimRate;
  });

  const topConfigs = ranked.slice(0, 3);
  const summaryLines = [
    '# Prompt Eval Summary',
    '',
    `Dataset: ${DATASET_PATH} (items: ${filtered.length})`,
    `Runs per config: ${options.runs}`,
    '',
    'Best configs (sorted by gold_point_coverage_rate, normalized_grounded_claim_rate):',
    ...topConfigs.map((entry) => {
      const cfg = entry.config;
      return `- prompt_version=${cfg.promptVersion}, temperature=${cfg.temperature}, max_output_tokens=${cfg.maxOutputTokens} | model_overall_score=${formatRate(
        entry.means.modelOverallScore
      )}±${formatRate(entry.stds.modelOverallScore)}, overall_score_calc=${formatRate(
        entry.means.overallScoreCalc
      )}±${formatRate(entry.stds.overallScoreCalc)}, gold_point_coverage_rate=${formatRate(
        entry.means.goldPointCoverageRate
      )}±${formatRate(entry.stds.goldPointCoverageRate)}, grounded_claim_rate=${formatRate(
        entry.means.groundedClaimRate
      )}±${formatRate(entry.stds.groundedClaimRate)}, normalized_grounded_claim_rate=${formatRate(
        entry.means.normalizedGroundedClaimRate
      )}±${formatRate(entry.stds.normalizedGroundedClaimRate)}`;
    }),
    '',
    'Notes:',
    '- Gold point coverage is ID-based (evidence-validated), not lexical matching.',
    '- lexical_overlap_proxy is a secondary heuristic and may be 0 due to paraphrases.',
    '- Context metrics use full context text without chunking or selection.',
    '- Evidence quotes are validated against line-numbered context when --lineNumbers is true.',
  ];

  const mdPath = resolve(OUT_DIR, 'experiments.md');
  await writeFile(mdPath, summaryLines.join('\n'), 'utf-8');

  console.info(`[prompt-eval] Wrote ${csvPath}`);
  console.info(`[prompt-eval] Wrote ${mdPath}`);
}

run().catch((error) => {
  console.error(`[prompt-eval] Failed: ${(error as Error).message}`);
  process.exit(1);
});

type CliOptions = {
  maxItems: number | null;
  ids: string[];
  concurrency: number;
  seed: number | null;
  runs: number;
  k: number;
  maxLinesPerChunk: number;
  queryExpander: boolean;
  contextSelector: boolean;
  lineNumbers: boolean;
};

function parseArgs(args: string[]): { options: CliOptions; runId: string } {
  const options: CliOptions = {
    maxItems: null,
    ids: [],
    concurrency: 1,
    seed: null,
    runs: 1,
    k: 3,
    maxLinesPerChunk: 80,
    queryExpander: false,
    contextSelector: false,
    lineNumbers: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--maxItems') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value)) options.maxItems = value;
      i += 1;
    } else if (arg === '--ids') {
      const value = args[i + 1];
      if (value) options.ids = value.split(',').map((id) => id.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--concurrency') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value) && value > 0) options.concurrency = Math.floor(value);
      i += 1;
    } else if (arg === '--seed') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value)) options.seed = value;
      i += 1;
    } else if (arg === '--runs') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value) && value > 0) options.runs = Math.floor(value);
      i += 1;
    } else if (arg === '--k') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value) && value > 0) options.k = Math.floor(value);
      i += 1;
    } else if (arg === '--maxLinesPerChunk') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value) && value > 0) options.maxLinesPerChunk = Math.floor(value);
      i += 1;
    } else if (arg === '--queryExpander') {
      const value = args[i + 1];
      if (value) options.queryExpander = parseBoolean(value);
      i += 1;
    } else if (arg === '--contextSelector') {
      const value = args[i + 1];
      if (value) options.contextSelector = parseBoolean(value);
      i += 1;
    } else if (arg === '--lineNumbers') {
      const value = args[i + 1];
      if (value) options.lineNumbers = parseBoolean(value);
      i += 1;
    }
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  return { options, runId };
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function buildGrid(options: CliOptions): EvalConfig[] {
  const grid: EvalConfig[] = [];
  for (const promptVersion of PROMPT_VERSIONS) {
    for (const temperature of TEMPERATURES) {
      for (const maxOutputTokens of MAX_OUTPUT_TOKENS) {
        grid.push({
          promptVersion,
          temperature,
          maxOutputTokens,
          lineNumbers: options.lineNumbers,
          k: options.k,
          maxLinesPerChunk: options.maxLinesPerChunk,
          queryExpander: options.queryExpander,
          contextSelector: options.contextSelector,
        });
      }
    }
  }
  return grid;
}

function computeContextStats(
  items: DatasetItem[],
  lineNumbers: boolean
): { tokenEstimate: number; redundancyRatio: number } {
  if (items.length === 0) return { tokenEstimate: 0, redundancyRatio: 0 };
  let tokenSum = 0;
  let redundancySum = 0;
  for (const item of items) {
    const contextText = lineNumbers ? addLineNumbers(item.context.text) : item.context.text;
    tokenSum += estimateTokens(contextText);
    redundancySum += redundancyRatio(item.context.text);
  }
  return {
    tokenEstimate: tokenSum / items.length,
    redundancyRatio: redundancySum / items.length,
  };
}

function summarizeRun(
  results: ItemRunResult[],
  items: number,
  contextStats: { tokenEstimate: number; redundancyRatio: number }
): Omit<ConfigResult, 'config'> {
  let modelOverallScoreSum = 0;
  let modelOverallScoreCount = 0;
  let overallScoreCalcSum = 0;
  let overallScoreMismatchCount = 0;
  let groundedSum = 0;
  let normalizedGroundedSum = 0;
  let evidenceSum = 0;
  let coverageSum = 0;
  let selfReportSum = 0;
  let cheatSum = 0;
  let lexicalSum = 0;
  let forbiddenSum = 0;
  let quoteForbiddenSum = 0;
  let parseFailures = 0;

  for (const result of results) {
    if (!result.ok) {
      parseFailures += 1;
      continue;
    }
    if (typeof result.metrics.modelOverallScore === 'number') {
      modelOverallScoreSum += result.metrics.modelOverallScore;
      modelOverallScoreCount += 1;
    }
    overallScoreCalcSum += result.metrics.overallScoreCalc;
    if (result.metrics.overallScoreMismatch) {
      overallScoreMismatchCount += 1;
    }
    groundedSum += result.metrics.groundedClaimRate;
    normalizedGroundedSum += result.metrics.normalizedGroundedClaimRate;
    evidenceSum += result.metrics.evidenceQuoteHitRate;
    coverageSum += result.metrics.goldPointCoverageRate;
    selfReportSum += result.metrics.goldPointSelfReportRate;
    cheatSum += result.metrics.goldPointCheatRate;
    lexicalSum += result.metrics.lexicalOverlapProxy;
    forbiddenSum += result.metrics.forbiddenClaimRate;
    quoteForbiddenSum += result.metrics.quoteContainsForbiddenRate;
  }

  const denom = items || 1;
  const modelOverallScore =
    modelOverallScoreCount > 0 ? modelOverallScoreSum / modelOverallScoreCount : null;
  return {
    goldPointCoverageRate: coverageSum / denom,
    goldPointSelfReportRate: selfReportSum / denom,
    goldPointCheatRate: cheatSum / denom,
    lexicalOverlapProxy: lexicalSum / denom,
    tokenEstimate: contextStats.tokenEstimate,
    redundancyRatio: contextStats.redundancyRatio,
    groundedClaimRate: groundedSum / denom,
    normalizedGroundedClaimRate: normalizedGroundedSum / denom,
    evidenceQuoteHitRate: evidenceSum / denom,
    forbiddenClaimRate: forbiddenSum / denom,
    quoteContainsForbiddenRate: quoteForbiddenSum / denom,
    modelOverallScore,
    overallScoreCalc: overallScoreCalcSum / denom,
    overallScoreMismatchRate: overallScoreMismatchCount / denom,
    items,
    parseFailures,
  };
}

function aggregateByConfig(runResults: RunResult[]) {
  const grouped = new Map<string, { config: EvalConfig; runs: RunResult[] }>();
  for (const result of runResults) {
    const hash = configToHash(result.config);
    const existing = grouped.get(hash);
    if (existing) {
      existing.runs.push(result);
    } else {
      grouped.set(hash, { config: result.config, runs: [result] });
    }
  }

  return Array.from(grouped.values()).map((entry) => {
    const modelOverallScores = entry.runs
      .map((run) => run.modelOverallScore)
      .filter((value): value is number => typeof value === 'number');
    const overallScoreCalcs = entry.runs.map((run) => run.overallScoreCalc);
    const groundedRates = entry.runs.map((run) => run.groundedClaimRate);
    const normalizedRates = entry.runs.map((run) => run.normalizedGroundedClaimRate);
    const coverageRates = entry.runs.map((run) => run.goldPointCoverageRate);

    return {
      config: entry.config,
      means: {
        modelOverallScore: modelOverallScores.length > 0 ? mean(modelOverallScores) : null,
        overallScoreCalc: mean(overallScoreCalcs),
        groundedClaimRate: mean(groundedRates),
        normalizedGroundedClaimRate: mean(normalizedRates),
        goldPointCoverageRate: mean(coverageRates),
      },
      stds: {
        modelOverallScore: modelOverallScores.length > 0 ? std(modelOverallScores) : null,
        overallScoreCalc: std(overallScoreCalcs),
        groundedClaimRate: std(groundedRates),
        normalizedGroundedClaimRate: std(normalizedRates),
        goldPointCoverageRate: std(coverageRates),
      },
    };
  });
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

type GoldPointArtifactEntry = {
  run_index: number;
  goldPoints: string[];
  claimed_covered_ids: number[];
  valid_covered_ids: number[];
  missing_ids: number[];
  per_id_status: Array<{ id: number; status: string }>;
  error?: string | null;
};

function buildGoldPointArtifact(
  item: DatasetItem,
  runIndex: number,
  status: GoldPointStatus | null
): GoldPointArtifactEntry {
  return {
    run_index: runIndex,
    goldPoints: item.gold.goldPoints,
    claimed_covered_ids: status?.claimedCoveredIds ?? [],
    valid_covered_ids: status?.validCoveredIds ?? [],
    missing_ids: status?.missingIds ?? [],
    per_id_status: status?.perIdStatus ?? item.gold.goldPoints.map((_, id) => ({
      id,
      status: 'unreported',
    })),
    error: status ? null : 'evaluation_failed',
  };
}

async function appendGoldPointArtifact(path: string, entry: GoldPointArtifactEntry) {
  let existing: GoldPointArtifactEntry[] = [];
  try {
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      existing = parsed as GoldPointArtifactEntry[];
    }
  } catch {
    existing = [];
  }
  existing.push(entry);
  await writeFile(path, JSON.stringify(existing, null, 2), 'utf-8');
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const output = [...items];
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function configToHash(config: EvalConfig): string {
  return `pv${config.promptVersion}_t${config.temperature}_mo${config.maxOutputTokens}_k${config.k}_m${
    config.maxLinesPerChunk
  }_qe${config.queryExpander ? 1 : 0}_cs${config.contextSelector ? 1 : 0}_ln${
    config.lineNumbers ? 1 : 0
  }`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await handler(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}
