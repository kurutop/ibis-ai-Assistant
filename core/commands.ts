// ============================================================
// Command System - Slash commands with availability checks
// ============================================================

import { appStore, updateConfig, clearSession } from './state';
import { allBaseTools, getToolByName, getToolsByCategory, ToolCategory } from './tools';

export interface CommandContext {
  args: string[];
  flags: Record<string, string | boolean>;
}

export interface CommandResult {
  success: boolean;
  output: string;
  continueConversation?: boolean;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  category: string;
  handler: (ctx: CommandContext) => Promise<CommandResult> | CommandResult;
  isEnabled?: () => boolean;
}

// ============================================================
// Session Commands
// ============================================================

export const ClearCommand: Command = {
  name: 'clear',
  aliases: ['reset'],
  description: 'Clear conversation history',
  usage: '/clear',
  category: 'session',
  handler: () => {
    clearSession();
    return { success: true, output: '🧹 Session cleared.' };
  },
};

export const StatusCommand: Command = {
  name: 'status',
  aliases: ['stats'],
  description: 'Show session statistics',
  usage: '/status',
  category: 'session',
  handler: () => {
    const state = appStore.getState();
    const uptime = Math.round((Date.now() - state.stats.startTime) / 1000);
    const mins = Math.floor(uptime / 60);
    const secs = uptime % 60;
    
    return {
      success: true,
      output: `📊 Session Status:
  • Messages: ${state.stats.totalMessages}
  • Tool calls: ${state.stats.totalToolCalls}
  • Model: ${state.model}
  • Max turns: ${state.maxTurns}
  • Uptime: ${mins}m ${secs}s
  • Workspace: ${state.workspaceDir}`,
    };
  },
};

// ============================================================
// Configuration Commands
// ============================================================

export const ModelCommand: Command = {
  name: 'model',
  aliases: [],
  description: 'Show or change the current model',
  usage: '/model [model_name]',
  category: 'config',
  handler: ({ args }) => {
    const state = appStore.getState();
    
    if (args.length === 0) {
      return { success: true, output: `🤖 Current model: ${state.model}` };
    }
    
    const newModel = args[0];
    updateConfig({ model: newModel });
    return { success: true, output: `🤖 Model changed to: ${newModel}` };
  },
};

export const MaxTurnsCommand: Command = {
  name: 'max_turns',
  aliases: ['turns'],
  description: 'Set maximum tool execution turns',
  usage: '/max_turns <number>',
  category: 'config',
  handler: ({ args }) => {
    const num = parseInt(args[0]);
    if (isNaN(num) || num < 1 || num > 50) {
      return { success: false, output: '❌ Invalid number. Use: /max_turns <1-50>' };
    }
    updateConfig({ maxTurns: num });
    return { success: true, output: `⚙️ Max turns set to: ${num}` };
  },
};

export const VerboseCommand: Command = {
  name: 'verbose',
  aliases: [],
  description: 'Toggle verbose mode',
  usage: '/verbose',
  category: 'config',
  handler: () => {
    const state = appStore.getState();
    const newVal = !state.verbose;
    updateConfig({ verbose: newVal });
    return { success: true, output: `🔍 Verbose mode: ${newVal ? 'ON' : 'OFF'}` };
  },
};

export const PermissionModeCommand: Command = {
  name: 'permission',
  aliases: ['perm'],
  description: 'Set permission mode for tool execution',
  usage: '/permission <ask|allow|deny>',
  category: 'config',
  handler: ({ args }) => {
    const mode = args[0] as 'ask' | 'allow' | 'deny';
    if (!['ask', 'allow', 'deny'].includes(mode)) {
      return { success: false, output: '❌ Invalid mode. Use: ask, allow, or deny' };
    }
    updateConfig({ permissionMode: mode });
    return { success: true, output: `🔒 Permission mode: ${mode}` };
  },
};

export const InstructionsCommand: Command = {
  name: 'instructions',
  aliases: ['instruct'],
  description: 'Set custom system instructions',
  usage: '/instructions <text>',
  category: 'config',
  handler: ({ args }) => {
    const text = args.join(' ');
    if (!text) {
      const state = appStore.getState();
      return { success: true, output: state.customInstructions ? `Current instructions:\n${state.customInstructions}` : 'No custom instructions set.' };
    }
    updateConfig({ customInstructions: text });
    return { success: true, output: '✅ Custom instructions updated.' };
  },
};

// ============================================================
// Tool Commands
// ============================================================

export const ToolsCommand: Command = {
  name: 'tools',
  aliases: ['commands'],
  description: 'List available tools',
  usage: '/tools [category]',
  category: 'info',
  handler: ({ args }) => {
    const category = args[0] as ToolCategory;
    
    if (category) {
      const tools = getToolsByCategory(category);
      if (tools.length === 0) return { success: false, output: `❌ Unknown category: ${category}` };
      const list = tools.map(t => `• **${t.name}** - ${t.description}`).join('\n');
      return { success: true, output: `🔧 ${category} tools:\n${list}` };
    }
    
    const categories = ['file', 'shell', 'search', 'memory'] as const;
    const output = categories.map(cat => {
      const tools = getToolsByCategory(cat);
      return `**${cat}**: ${tools.map(t => t.name).join(', ')}`;
    }).join('\n');
    
    return { success: true, output: `🛠️ Available tools:\n${output}` };
  },
};

export const ToolInfoCommand: Command = {
  name: 'tool_info',
  aliases: ['tool'],
  description: 'Show detailed info about a specific tool',
  usage: '/tool_info <tool_name>',
  category: 'info',
  handler: ({ args }) => {
    const toolName = args[0];
    if (!toolName) return { success: false, output: '❌ Usage: /tool_info <tool_name>' };
    
    const tool = getToolByName(toolName);
    if (!tool) return { success: false, output: `❌ Unknown tool: ${toolName}` };
    
    const paramInfo = Object.entries(tool.parameterDescriptions)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join('\n');
    
    const examples = tool.examples.map(e => `  ${e.input} // ${e.description}`).join('\n');
    
    return {
      success: true,
      output: `📋 **${tool.name}**
${tool.description}

Category: ${tool.category}
Permissions: ${tool.permissionLevel}
Read-only: ${tool.isReadOnly ? 'Yes' : 'No'}
Destructive: ${tool.isDestructive ? 'Yes' : 'No'}

Parameters:
${paramInfo || '  (none)'}

Examples:
${examples}`,
    };
  },
};

// ============================================================
// Help Command
// ============================================================

export const HelpCommand: Command = {
  name: 'help',
  aliases: ['?'],
  description: 'Show help message',
  usage: '/help [command]',
  category: 'info',
  handler: ({ args }) => {
    if (args.length > 0) {
      const cmd = getCommandByName(args[0]);
      if (cmd) {
        return { success: true, output: `**/${cmd.name}** - ${cmd.description}\nUsage: ${cmd.usage}` };
      }
      return { success: false, output: `❌ Unknown command: ${args[0]}` };
    }

    const commandList = [
      ClearCommand, StatusCommand,
      ModelCommand, MaxTurnsCommand, VerboseCommand, PermissionModeCommand, InstructionsCommand,
      ToolsCommand, ToolInfoCommand, HelpCommand,
    ];

    const grouped = commandList.reduce((acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    }, {} as Record<string, Command[]>);

    const output = Object.entries(grouped)
      .map(([cat, cmds]) => {
        const list = (cmds as Command[]).map(c => `  **/${c.name}** - ${c.description}`).join('\n');
        return `**${cat}**:\n${list}`;
      })
      .join('\n\n');

    return {
      success: true,
      output: `📖 Ibis Magus AI - Available Commands:\n\n${output}\n\n💡 Use /help <command> for details.`,
    };
  },
};

// ============================================================
// Command Registry
// ============================================================

export const allCommands: Command[] = [
  // Session
  ClearCommand, StatusCommand,
  // Config
  ModelCommand, MaxTurnsCommand, VerboseCommand, PermissionModeCommand, InstructionsCommand,
  // Info
  ToolsCommand, ToolInfoCommand, HelpCommand,
];

export function getCommandByName(name: string): Command | undefined {
  return allCommands.find(c => c.name === name || c.aliases.includes(name));
}

export function parseCommand(input: string): { command: Command; context: CommandContext } | null {
  if (!input.startsWith('/')) return null;
  
  const parts = input.slice(1).trim().split(/\s+/);
  const cmdName = parts[0];
  const args = parts.slice(1);
  
  const command = getCommandByName(cmdName);
  if (!command) return null;
  if (command.isEnabled && !command.isEnabled()) return null;
  
  const flags: Record<string, string | boolean> = {};
  const filteredArgs = args.filter(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value || true;
      return false;
    }
    return true;
  });
  
  return { command, context: { args: filteredArgs, flags } };
}

export async function executeCommand(input: string): Promise<CommandResult | null> {
  const parsed = parseCommand(input);
  if (!parsed) return null;
  
  try {
    return await parsed.command.handler(parsed.context);
  } catch (err: any) {
    return { success: false, output: `❌ Command error: ${err.message}` };
  }
}
