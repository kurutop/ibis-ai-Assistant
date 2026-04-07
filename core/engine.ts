// ============================================================
// Ibis Brain - Upgraded Engine with proper tool calling loop
// ============================================================

import { RegisteredTool, allBaseTools, getToolByName, parseToolCalls, validateToolCall, ToolResult, ToolContext } from './tools';
import { ContextManager, createContextManager } from './contextManager';
import { appStore, addMessage, addToolCall, addToolResult, updateConfig, AppState } from './state';
import { PermissionManager, PermissionContext } from './permissions';
import { hookManager } from './hooks';
import { executeCommand } from './commands';

export class IbisBrain {
  private contextManager: ContextManager;
  private permissionManager: PermissionManager;
  private toolContext: ToolContext;

  constructor() {
    const state = appStore.getState();
    
    this.contextManager = createContextManager({
      agentName: 'Ibis',
      agentId: 'GR-α-01',
      role: 'A calm, analytical advisor. Courageous and kind, primarily communicates in Thai.',
      capabilities: [
        'Read, write, and edit files',
        'Execute shell commands',
        'Search file contents',
        'Store and recall long-term memories',
        'Multi-step problem solving with tool chaining',
      ],
      constraints: [
        'Always validate file paths before access',
        'Never execute destructive commands without confirmation',
        'Respect permission boundaries',
        'Communicate primarily in Thai with the user',
      ],
      workspaceDir: state.workspaceDir,
      currentDate: new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      customInstructions: state.customInstructions,
    });

    this.permissionManager = PermissionManager.presets.cautious();
    
    this.toolContext = {
      workspaceDir: state.workspaceDir,
      allowedDirs: state.allowedDirs,
      environment: process.env as Record<string, string>,
    };
  }

  async process(userInput: string): Promise<string> {
    const state = appStore.getState();

    // Check for slash commands first
    if (userInput.startsWith('/')) {
      const result = await executeCommand(userInput);
      if (result) {
        return result.output;
      }
    }

    // Add user message to context
    this.contextManager.addMessage('user', userInput);
    addMessage({ role: 'user', content: userInput, timestamp: Date.now() });

    // Build full prompt with system context
    const systemPrompt = this.contextManager.buildSystemPrompt();
    const history = this.contextManager.getHistoryForAPI();
    
    const fullPrompt = `${systemPrompt}\n\n---\n\nConversation History:\n${history}\n\n---\n\nUser: ${userInput}\n\nIbis:`;

    let currentInput = fullPrompt;
    let turn = 0;
    let finalResponse = '';

    while (turn < state.maxTurns) {
      try {
        const response = await this.callOllama(currentInput, state.model);

        // Try to parse tool calls
        const toolCalls = parseToolCalls(response);

        if (toolCalls && toolCalls.length > 0) {
          const toolResults: string[] = [];

          for (const call of toolCalls) {
            // Execute hook: PreToolUse
            const hookResult = await hookManager.execute('PreToolUse', { toolName: call.name, arguments: call.arguments });
            if (hookResult.blocked) {
              toolResults.push(`[Blocked] ${hookResult.blockReason}`);
              continue;
            }

            const tool = getToolByName(call.name);
            if (!tool) {
              toolResults.push(`[Error] Unknown tool: ${call.name}`);
              continue;
            }

            // Validate arguments
            const validation = validateToolCall(tool, call.arguments);
            if (!validation.valid) {
              toolResults.push(`[Validation Error] ${tool.name}: ${validation.error}`);
              continue;
            }

            // Check permissions
            const permContext: PermissionContext = {
              toolName: tool.name,
              args: validation.validatedArgs || call.arguments,
              isReadOnly: tool.isReadOnly,
              isDestructive: tool.isDestructive,
              category: tool.category,
            };
            const permissionDecision = this.permissionManager.evaluate(permContext);

            if (permissionDecision.action === 'deny') {
              toolResults.push(`[Denied] ${tool.name}: ${permissionDecision.reason}`);
              continue;
            }

            if (permissionDecision.action === 'ask' && !tool.isReadOnly) {
              toolResults.push(`[Requires Approval] ${tool.name} - ${permissionDecision.reason}`);
              continue;
            }

            // Execute tool
            addToolCall(tool.name, call.arguments);
            const result = await tool.execute(validation.validatedArgs || call.arguments, this.toolContext);
            addToolResult(tool.name, result.success, result.content, result.error);

            // Execute hook: PostToolUse
            await hookManager.execute('PostToolUse', { toolName: tool.name, result });

            const resultSummary = result.success 
              ? `[${tool.name}] Success: ${result.content.substring(0, 500)}`
              : `[${tool.name}] Error: ${result.error}`;
            
            toolResults.push(resultSummary);

            // Add to context
            this.contextManager.addMessage('tool', resultSummary);
          }

          // Feed tool results back to model
          currentInput = `${fullPrompt}\n\nTool Results:\n${toolResults.join('\n')}\n\nBased on these results, continue your response:`;
          turn++;
          continue;
        }

        // No tool calls - this is the final response
        finalResponse = response;
        this.contextManager.addMessage('assistant', response);
        break;

      } catch (err: any) {
        finalResponse = `❌ Error: ${err.message}`;
        break;
      }
    }

    if (turn >= state.maxTurns && !finalResponse) {
      finalResponse = '⚠️ ใช้เวลานานเกินไป (Max turns reached)';
    }

    return finalResponse;
  }

  private async callOllama(prompt: string, model: string): Promise<string> {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.response;
  }

  // ============================================================
  // Utility methods
  // ============================================================

  getContextInfo(): string {
    const tokenUsage = this.contextManager.getTokenUsage();
    const state = appStore.getState();
    const rules = this.permissionManager.getRules();

    return `📊 Context Info:
  • Tokens: ${tokenUsage.estimated}/${tokenUsage.limit} (${tokenUsage.percentage}%)
  • Messages: ${state.stats.totalMessages}
  • Tool calls: ${state.stats.totalToolCalls}
  • Permission rules: ${rules.length}
  • Model: ${state.model}`;
  }

  updatePermissionManager(manager: PermissionManager): void {
    this.permissionManager = manager;
  }

  getTools(): RegisteredTool[] {
    return allBaseTools;
  }
}
