// ============================================================
// Permission Framework - Multi-source, rule-based permissions
// ============================================================

export type PermissionAction = 'allow' | 'deny' | 'ask';
export type PermissionSource = 'user' | 'project' | 'policy' | 'session';

export interface PermissionRule {
  pattern: string; // Tool name pattern (regex)
  action: PermissionAction;
  source: PermissionSource;
  reason?: string;
}

export interface PermissionContext {
  toolName: string;
  args: Record<string, any>;
  isReadOnly: boolean;
  isDestructive: boolean;
  category: string;
}

export interface PermissionDecision {
  action: PermissionAction;
  reason?: string;
  source?: PermissionSource;
}

export class PermissionManager {
  private rules: PermissionRule[] = [];
  private defaultMode: PermissionAction = 'ask';

  constructor(rules?: PermissionRule[], defaultMode?: PermissionAction) {
    if (rules) this.rules = rules;
    if (defaultMode) this.defaultMode = defaultMode;
  }

  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  removeRule(index: number): boolean {
    if (index >= 0 && index < this.rules.length) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  setDefaultMode(mode: PermissionAction): void {
    this.defaultMode = mode;
  }

  evaluate(context: PermissionContext): PermissionDecision {
    // If bypass mode, allow everything
    if (this.defaultMode === 'allow') {
      return { action: 'allow', reason: 'Bypass mode enabled' };
    }

    // If deny all, block everything
    if (this.defaultMode === 'deny') {
      return { action: 'deny', reason: 'All tools denied' };
    }

    // Check rules in order (most specific first)
    for (const rule of this.rules) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(context.toolName)) {
        return {
          action: rule.action,
          reason: rule.reason || `Matched rule: ${rule.pattern}`,
          source: rule.source,
        };
      }
    }

    // Default: ask for non-read-only tools, allow read-only
    if (context.isReadOnly) {
      return { action: 'allow', reason: 'Read-only tool' };
    }

    return { action: this.defaultMode, reason: 'Default policy' };
  }

  // Preset configurations
  static presets = {
    permissive: (): PermissionManager => new PermissionManager([], 'allow'),
    cautious: (): PermissionManager => new PermissionManager([
      { pattern: '^read_', action: 'allow', source: 'user', reason: 'Read operations allowed' },
      { pattern: '^list_', action: 'allow', source: 'user', reason: 'List operations allowed' },
      { pattern: '^grep', action: 'allow', source: 'user', reason: 'Search allowed' },
    ], 'ask'),
    restrictive: (): PermissionManager => new PermissionManager([
      { pattern: '^bash', action: 'deny', source: 'policy', reason: 'Shell commands denied' },
      { pattern: '^delete_', action: 'deny', source: 'policy', reason: 'Delete operations denied' },
    ], 'ask'),
  };
}
