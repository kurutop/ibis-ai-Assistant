// ============================================================
// Hook System - Extensible event hooks
// ============================================================

import { ToolResult, RegisteredTool } from './tools';

export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PreUserPrompt'
  | 'PostUserPrompt'
  | 'PreToolExecution'
  | 'PostToolExecution'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Error';

export interface HookContext {
  eventName: HookEvent;
  timestamp: number;
  data: Record<string, any>;
}

export interface HookResult {
  continue: boolean;
  modifiedData?: Record<string, any>;
  message?: string;
  blockReason?: string;
}

export type HookHandler = (ctx: HookContext) => HookResult | Promise<HookResult>;

export interface HookRegistration {
  id: string;
  event: HookEvent;
  handler: HookHandler;
  priority?: number; // Lower = higher priority
  enabled: boolean;
}

export class HookManager {
  private hooks: HookRegistration[] = [];
  private hookCounter = 0;

  register(event: HookEvent, handler: HookHandler, priority = 100): string {
    const id = `hook-${++this.hookCounter}`;
    this.hooks.push({ id, event, handler, priority, enabled: true });
    this.hooks.sort((a, b) => a.priority - b.priority);
    return id;
  }

  unregister(id: string): boolean {
    const idx = this.hooks.findIndex(h => h.id === id);
    if (idx !== -1) {
      this.hooks.splice(idx, 1);
      return true;
    }
    return false;
  }

  async execute(event: HookEvent, data: Record<string, any>): Promise<{ results: HookResult[]; blocked: boolean; blockReason?: string }> {
    const relevantHooks = this.hooks.filter(h => h.event === event && h.enabled);
    const results: HookResult[] = [];
    let blocked = false;
    let blockReason: string | undefined;

    for (const hook of relevantHooks) {
      try {
        const ctx: HookContext = { eventName: event, timestamp: Date.now(), data };
        const result = await hook.handler(ctx);
        results.push(result);

        if (!result.continue) {
          blocked = true;
          blockReason = result.blockReason || result.message;
          break;
        }

        // Apply modifications
        if (result.modifiedData) {
          Object.assign(data, result.modifiedData);
        }
      } catch (err: any) {
        results.push({ continue: true, message: `Hook error: ${err.message}` });
      }
    }

    return { results, blocked, blockReason };
  }

  getHooks(event?: HookEvent): HookRegistration[] {
    if (event) return this.hooks.filter(h => h.event === event);
    return [...this.hooks];
  }

  enableHook(id: string): boolean {
    const hook = this.hooks.find(h => h.id === id);
    if (hook) { hook.enabled = true; return true; }
    return false;
  }

  disableHook(id: string): boolean {
    const hook = this.hooks.find(h => h.id === id);
    if (hook) { hook.enabled = false; return true; }
    return false;
  }
}

// ============================================================
// Built-in hooks
// ============================================================

export function registerDefaultHooks(hookManager: HookManager): void {
  // Logging hook
  hookManager.register('PostToolUse', async (ctx) => {
    const { toolName, result } = ctx.data;
    if (result && !result.success) {
      console.error(`[Hook] Tool "${toolName}" failed: ${result.error}`);
    }
    return { continue: true };
  }, 100);

  // Verbose logging hook
  hookManager.register('PreToolExecution', async (ctx) => {
    const { toolName, args } = ctx.data;
    if (process.env.IBIS_VERBOSE === 'true') {
      console.log(`[Hook] Executing "${toolName}" with:`, JSON.stringify(args, null, 2));
    }
    return { continue: true };
  }, 50);

  // Safety hook: block destructive tools in ask mode
  hookManager.register('PreToolUse', async (ctx) => {
    const { tool, permissionDecision } = ctx.data;
    if (permissionDecision?.action === 'deny') {
      return { 
        continue: false, 
        blockReason: `Tool "${tool?.name}" is denied by permission policy`,
        message: `🚫 Blocked: ${permissionDecision.reason}`,
      };
    }
    return { continue: true };
  }, 10);
}

export const hookManager = new HookManager();
registerDefaultHooks(hookManager);
