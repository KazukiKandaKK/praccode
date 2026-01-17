import { z } from 'zod';

export type ToolPermission = 'read' | 'write' | 'network' | 'exec';

export type ToolDefinition<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  permission: ToolPermission;
  sideEffects: boolean;
  handler: (ctx: ToolExecutionContext, args: z.infer<TInput>) => Promise<z.infer<TOutput>>;
};

export type ToolExecutionContext = {
  userId: string;
  runId: string;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>>();

  register<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
    tool: ToolDefinition<TInput, TOutput>
  ) {
    this.tools.set(tool.name, tool);
  }

  get(toolName: string) {
    return this.tools.get(toolName);
  }

  list() {
    return Array.from(this.tools.values());
  }
}
