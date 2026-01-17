export type RoutingResult = {
  chosenProvider: string;
  chosenModel: string;
  toolset: string;
  reason: string;
};

const getModelName = () => {
  if (process.env.LLM_PROVIDER === 'openai') {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }
  if (process.env.LLM_PROVIDER === 'gemini') {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  }
  return process.env.OLLAMA_MODEL || 'qwen2.5:7b';
};

export class AgentRouter {
  decide(params: { mode: string; goal: string }): RoutingResult {
    const provider = process.env.LLM_PROVIDER || 'ollama';
    const model = getModelName();
    const toolset = params.mode;
    const reason = `Rule-based routing: mode=${params.mode}, provider=${provider}`;
    return {
      chosenProvider: provider,
      chosenModel: model,
      toolset,
      reason,
    };
  }
}
