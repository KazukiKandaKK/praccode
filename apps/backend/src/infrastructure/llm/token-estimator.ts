/**
 * Rough token estimator to drive rate limiting without a tokenizer.
 * Uses UTF-8 byte length to avoid undercounting multibyte text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const byteLength = Buffer.byteLength(text, 'utf8');
  return Math.max(1, Math.ceil(byteLength / 3));
}
