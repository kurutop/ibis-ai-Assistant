// ============================================================
// State Store - Immutable pub/sub pattern
// ============================================================

type Listener<T> = (state: T, prevState: T) => void;

export class Store<T extends Record<string, any>> {
  private state: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initial: T) {
    this.state = initial;
  }

  getState(): T {
    return this.state;
  }

  setState(updater: T | ((prev: T) => T)): void {
    const prevState = this.state;
    this.state = typeof updater === 'function' ? (updater as (prev: T) => T)(prevState) : updater;
    this.notify(prevState);
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(prevState: T): void {
    for (const listener of this.listeners) {
      listener(this.state, prevState);
    }
  }
}

// ============================================================
// Application State
// ============================================================

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCall?: { name: string; arguments: Record<string, any> };
  toolResult?: { name: string; success: boolean; content: string; error?: string };
}

export interface SessionStats {
  totalMessages: number;
  totalToolCalls: number;
  totalTokensUsed: number;
  totalCost: number;
  startTime: number;
}

export interface AppState {
  // Session
  sessionId: string;
  messages: Message[];
  stats: SessionStats;
  
  // Configuration
  model: string;
  maxTurns: number;
  workspaceDir: string;
  allowedDirs: string[];
  
  // Features
  verbose: boolean;
  autoToolExecution: boolean;
  permissionMode: 'ask' | 'allow' | 'deny';
  
  // Memory
  memories: Array<{ key: string; value: string; tags: string[] }>;
  
  // System context
  systemPrompt: string;
  customInstructions: string;
}

export const defaultState: AppState = {
  sessionId: `session-${Date.now()}`,
  messages: [],
  stats: {
    totalMessages: 0,
    totalToolCalls: 0,
    totalTokensUsed: 0,
    totalCost: 0,
    startTime: Date.now(),
  },
  model: 'llama3.2:3b',
  maxTurns: 10,
  workspaceDir: process.cwd(),
  allowedDirs: [process.cwd()],
  verbose: false,
  autoToolExecution: true,
  permissionMode: 'ask',
  memories: [],
  systemPrompt: '',
  customInstructions: '',
};

export const appStore = new Store<AppState>(defaultState);

// ============================================================
// Convenience helpers
// ============================================================

export function addMessage(message: Message): void {
  appStore.setState(prev => ({
    ...prev,
    messages: [...prev.messages, message],
    stats: {
      ...prev.stats,
      totalMessages: prev.stats.totalMessages + 1,
    },
  }));
}

export function addToolCall(toolName: string, args: Record<string, any>): void {
  appStore.setState(prev => ({
    ...prev,
    stats: {
      ...prev.stats,
      totalToolCalls: prev.stats.totalToolCalls + 1,
    },
  }));
}

export function addToolResult(toolName: string, success: boolean, content: string, error?: string): void {
  addMessage({
    role: 'tool',
    content,
    timestamp: Date.now(),
    toolResult: { name: toolName, success, content, error },
  });
}

export function clearSession(): void {
  appStore.setState(prev => ({
    ...prev,
    messages: [],
    stats: {
      ...prev.stats,
      totalMessages: 0,
      totalToolCalls: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      startTime: Date.now(),
    },
  }));
}

export function updateConfig(updates: Partial<Pick<AppState, 'model' | 'maxTurns' | 'verbose' | 'autoToolExecution' | 'permissionMode' | 'customInstructions'>>): void {
  appStore.setState(prev => ({ ...prev, ...updates }));
}
