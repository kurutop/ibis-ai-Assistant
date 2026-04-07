// ============================================================
// Context Manager - System prompt assembly, history, token tracking
// ============================================================

import { getAllToolDescriptions, getToolPromptInstructions } from './tools';

export interface ContextConfig {
  agentName: string;
  agentId: string;
  role: string;
  capabilities: string[];
  constraints: string[];
  workspaceDir: string;
  currentDate: string;
  customInstructions?: string;
}

export class ContextManager {
  private config: ContextConfig;
  private conversationHistory: Array<{ role: string; content: string }>;
  private maxHistoryTokens: number;
  private estimatedTokens: number;

  constructor(config: ContextConfig, maxHistoryTokens = 4000) {
    this.config = config;
    this.conversationHistory = [];
    this.maxHistoryTokens = maxHistoryTokens;
    this.estimatedTokens = 0;
  }

  buildSystemPrompt(): string {
    const sections = [
      `# Identity`,
      `You are ${this.config.agentName} (ID: ${this.config.agentId}).`,
      `Role: ${this.config.role}`,
      ``,
      `# Capabilities`,
      ...this.config.capabilities.map(c => `- ${c}`),
      ``,
      `# Constraints`,
      ...this.config.constraints.map(c => `- ${c}`),
      ``,
      `# Environment`,
      `- Current date: ${this.config.currentDate}`,
      `- Working directory: ${this.config.workspaceDir}`,
      ``,
      `# Available Tools`,
      getAllToolDescriptions(),
      ``,
      `# Instructions`,
      getToolPromptInstructions(),
    ];

    if (this.config.customInstructions) {
      sections.push(``, `# Custom Instructions`, this.config.customInstructions);
    }

    return sections.join('\n');
  }

  addMessage(role: string, content: string): void {
    const tokenEstimate = this.estimateTokens(content);
    
    // Auto-compact if approaching limit
    if (this.estimatedTokens + tokenEstimate > this.maxHistoryTokens) {
      this.compact();
    }

    this.conversationHistory.push({ role, content });
    this.estimatedTokens += tokenEstimate;
  }

  getHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory];
  }

  getHistoryForAPI(): string {
    return this.conversationHistory
      .map(msg => `<${msg.role}>\n${msg.content}`)
      .join('\n\n');
  }

  compact(): void {
    if (this.conversationHistory.length <= 2) return;
    
    // Keep system context + first + last message, summarize middle
    const first = this.conversationHistory[0];
    const last = this.conversationHistory[this.conversationHistory.length - 1];
    
    const summary = `[Conversation compacted: ${this.conversationHistory.length - 2} messages summarized]`;
    
    this.conversationHistory = [first, { role: 'system', content: summary }, last];
    this.estimatedTokens = this.estimateTokens(first.content) + this.estimateTokens(summary) + this.estimateTokens(last.content);
  }

  clear(): void {
    this.conversationHistory = [];
    this.estimatedTokens = 0;
  }

  getTokenUsage(): { estimated: number; limit: number; percentage: number } {
    return {
      estimated: this.estimatedTokens,
      limit: this.maxHistoryTokens,
      percentage: Math.round((this.estimatedTokens / this.maxHistoryTokens) * 100),
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }

  updateConfig(updates: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export function createContextManager(config: ContextConfig): ContextManager {
  return new ContextManager(config);
}
