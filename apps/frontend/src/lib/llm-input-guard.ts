type LlmInputField = {
  field: string;
  value: string;
};

export type LlmInputViolation = {
  field: string;
  reason: string;
};

const MAX_INPUT_LENGTH = 100000;

const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;

const INJECTION_PATTERNS = [
  /\bignore\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\bforget\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\bdisregard\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\boverride\s+(previous|all|the)\s+(instructions?|prompts?|rules?)\b/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\buser\s*:/i,
  /\b(you|your)\s+(are|is|must|should|will)\s+(now|a|an)\s+/i,
  /\b(new|different)\s+(instructions?|prompts?|rules?|system)\b/i,
  /前の指示を無視/i,
  /以前の指示を無視/i,
  /システム\s*:/i,
  /アシスタント\s*:/i,
  /ユーザー\s*:/i,
  /指示を無視/i,
  /プロンプトを無視/i,
  /ルールを無視/i,
];

export function findLlmInputViolation(fields: LlmInputField[]): LlmInputViolation | null {
  for (const field of fields) {
    const value = field.value ?? '';
    if (!value.trim()) {
      continue;
    }

    if (value.length > MAX_INPUT_LENGTH) {
      return { field: field.field, reason: '入力が長すぎます' };
    }

    if (CONTROL_CHAR_PATTERN.test(value)) {
      return { field: field.field, reason: '制御文字が含まれています' };
    }

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        return { field: field.field, reason: '禁止表現が含まれています' };
      }
    }
  }

  return null;
}
