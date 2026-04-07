import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type ToolCategory = 'file' | 'shell' | 'search' | 'web' | 'system' | 'memory';
export type PermissionLevel = 'read' | 'write' | 'execute' | 'dangerous';

export interface ToolMetadata {
  name: string;
  description: string;
  category: ToolCategory;
  permissionLevel: PermissionLevel;
  isReadOnly: boolean;
  isDestructive: boolean;
  parameters: z.ZodType<any>;
  parameterDescriptions: Record<string, string>;
  examples: Array<{ input: string; description: string }>;
}

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface RegisteredTool extends ToolMetadata {
  execute: (args: any, context?: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  workspaceDir: string;
  allowedDirs: string[];
  environment: Record<string, string>;
}

function resolveAndValidatePath(targetPath: string, baseDirs: string[]): { valid: boolean; fullPath: string; error?: string } {
  const fullPath = path.resolve(targetPath);
  const isAllowed = baseDirs.some(dir => fullPath.startsWith(dir));
  if (!isAllowed) return { valid: false, fullPath, error: 'Access denied: Path escapes allowed directories' };
  return { valid: true, fullPath };
}

export const ReadFileTool: RegisteredTool = {
  name: 'read_file', description: 'Read file contents with optional line range.', category: 'file', permissionLevel: 'read', isReadOnly: true, isDestructive: false,
  parameters: z.object({ filepath: z.string(), startLine: z.number().optional(), endLine: z.number().optional() }),
  parameterDescriptions: { filepath: 'Path to read', startLine: 'Start line (1-based)', endLine: 'End line (1-based)' },
  examples: [{ input: '{"filepath": "src/index.ts"}', description: 'Read file' }],
  execute: async ({ filepath, startLine, endLine }, ctx) => {
    try {
      const pathCheck = resolveAndValidatePath(filepath, ctx?.allowedDirs || []);
      if (!pathCheck.valid) return { success: false, content: '', error: pathCheck.error };
      const content = await fs.readFile(pathCheck.fullPath, 'utf-8');
      const lines = content.split('\n');
      let result = content;
      if (startLine !== undefined || endLine !== undefined) {
        const start = Math.max(0, (startLine || 1) - 1);
        const end = endLine ? Math.min(endLine, lines.length) : lines.length;
        result = lines.slice(start, end).join('\n');
      }
      return { success: true, content: result, metadata: { totalLines: lines.length } };
    } catch (err: any) { return { success: false, content: '', error: err.message }; }
  },
};

export const WriteFileTool: RegisteredTool = {
  name: 'write_file', description: 'Write content to a file.', category: 'file', permissionLevel: 'write', isReadOnly: false, isDestructive: false,
  parameters: z.object({ filepath: z.string(), content: z.string(), append: z.boolean().optional().default(false) }),
  parameterDescriptions: { filepath: 'Path to write', content: 'Content to write', append: 'Append mode' },
  examples: [{ input: '{"filepath": "out.txt", "content": "Hello"}', description: 'Write file' }],
  execute: async ({ filepath, content, append }, ctx) => {
    try {
      const pathCheck = resolveAndValidatePath(filepath, ctx?.allowedDirs || []);
      if (!pathCheck.valid) return { success: false, content: '', error: pathCheck.error };
      await fs.mkdir(path.dirname(pathCheck.fullPath), { recursive: true });
      if (append) await fs.appendFile(pathCheck.fullPath, content, 'utf-8');
      else await fs.writeFile(pathCheck.fullPath, content, 'utf-8');
      return { success: true, content: `Wrote to ${filepath}` };
    } catch (err: any) { return { success: false, content: '', error: err.message }; }
  },
};

export const EditFileTool: RegisteredTool = {
  name: 'edit_file', description: 'Make targeted edits to a file.', category: 'file', permissionLevel: 'write', isReadOnly: false, isDestructive: false,
  parameters: z.object({ filepath: z.string(), oldString: z.string(), newString: z.string(), replaceAll: z.boolean().optional().default(false) }),
  parameterDescriptions: { filepath: 'Path to edit', oldString: 'Text to replace', newString: 'Replacement text', replaceAll: 'Replace all occurrences' },
  examples: [{ input: '{"filepath": "app.ts", "oldString": "const x=1", "newString": "const x=2"}', description: 'Edit variable' }],
  execute: async ({ filepath, oldString, newString, replaceAll }, ctx) => {
    try {
      const pathCheck = resolveAndValidatePath(filepath, ctx?.allowedDirs || []);
      if (!pathCheck.valid) return { success: false, content: '', error: pathCheck.error };
      const content = await fs.readFile(pathCheck.fullPath, 'utf-8');
      if (!content.includes(oldString)) return { success: false, content: '', error: 'Text not found' };
      const newContent = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
      await fs.writeFile(pathCheck.fullPath, newContent, 'utf-8');
      return { success: true, content: `Edited ${filepath}` };
    } catch (err: any) { return { success: false, content: '', error: err.message }; }
  },
};

export const ListFilesTool: RegisteredTool = {
  name: 'list_files', description: 'List files and directories.', category: 'file', permissionLevel: 'read', isReadOnly: true, isDestructive: false,
  parameters: z.object({ dirpath: z.string().optional().default('.'), recursive: z.boolean().optional().default(false) }),
  parameterDescriptions: { dirpath: 'Directory to list', recursive: 'List recursively' },
  examples: [{ input: '{}', description: 'List root' }],
  execute: async ({ dirpath, recursive }, ctx) => {
    try {
      const targetPath = dirpath === '.' ? ctx?.workspaceDir || '.' : dirpath;
      const pathCheck = resolveAndValidatePath(targetPath, ctx?.allowedDirs || []);
      if (!pathCheck.valid) return { success: false, content: '', error: pathCheck.error };
      const entries = await fs.readdir(pathCheck.fullPath, { withFileTypes: true, recursive });
      const formatted = entries.map(e => (e.isDirectory() ? '📁 ' : '📄 ') + (recursive ? e.path : e.name)).join('\n');
      return { success: true, content: formatted || '(empty)', metadata: { count: entries.length } };
    } catch (err: any) { return { success: false, content: '', error: err.message }; }
  },
};

export const BashTool: RegisteredTool = {
  name: 'bash', description: 'Execute a shell command.', category: 'shell', permissionLevel: 'execute', isReadOnly: false, isDestructive: true,
  parameters: z.object({ command: z.string(), timeout: z.number().optional().default(30000) }),
  parameterDescriptions: { command: 'Command to execute', timeout: 'Timeout in ms' },
  examples: [{ input: '{"command": "ls -la"}', description: 'List files' }],
  execute: async ({ command, timeout }, ctx) => {
    try {
      const { stdout, stderr } = await execAsync(command, { timeout, cwd: ctx?.workspaceDir, env: { ...process.env, ...ctx?.environment }, maxBuffer: 1024 * 1024 * 10 });
      let content = '';
      if (stdout) content += stdout;
      if (stderr) content += `\n[stderr]\n${stderr}`;
      return { success: true, content: content || '(no output)', metadata: { command } };
    } catch (err: any) { return { success: false, content: err.stdout || '', error: err.stderr || err.message }; }
  },
};

export const GrepTool: RegisteredTool = {
  name: 'grep', description: 'Search for a pattern in files.', category: 'search', permissionLevel: 'read', isReadOnly: true, isDestructive: false,
  parameters: z.object({ pattern: z.string(), filepath: z.string().optional(), ignoreCase: z.boolean().optional().default(false), maxResults: z.number().optional().default(50) }),
  parameterDescriptions: { pattern: 'Regex pattern', filepath: 'Search path', ignoreCase: 'Case insensitive', maxResults: 'Max results' },
  examples: [{ input: '{"pattern": "function.*error"}', description: 'Find error functions' }],
  execute: async ({ pattern, filepath, ignoreCase, maxResults }, ctx) => {
    try {
      const searchPath = filepath || ctx?.workspaceDir || '.';
      const pathCheck = resolveAndValidatePath(searchPath, ctx?.allowedDirs || []);
      if (!pathCheck.valid) return { success: false, content: '', error: pathCheck.error };
      const flags = ignoreCase ? '-i' : '';
      const { stdout } = await execAsync(`grep -r ${flags} -n "${pattern}" "${pathCheck.fullPath}" | head -n ${maxResults}`, { maxBuffer: 1024 * 1024 * 5 });
      return { success: true, content: stdout || 'No matches found' };
    } catch (err: any) { if (err.code === 1) return { success: true, content: 'No matches found' }; return { success: false, content: '', error: err.message }; }
  },
};

export interface MemoryEntry { id: string; key: string; value: string; timestamp: number; tags: string[]; }
const memoryStore: Map<string, MemoryEntry> = new Map();

export const SaveMemoryTool: RegisteredTool = {
  name: 'save_memory', description: 'Save information to long-term memory.', category: 'memory', permissionLevel: 'write', isReadOnly: false, isDestructive: false,
  parameters: z.object({ key: z.string(), value: z.string(), tags: z.array(z.string()).optional() }),
  parameterDescriptions: { key: 'Unique key', value: 'Information to store', tags: 'Tags' },
  examples: [{ input: '{"key": "user", "value": "John"}', description: 'Save memory' }],
  execute: async ({ key, value, tags }) => {
    const entry: MemoryEntry = { id: `${key}-${Date.now()}`, key, value, timestamp: Date.now(), tags: tags || [] };
    memoryStore.set(key, entry);
    return { success: true, content: `Saved: "${key}"` };
  },
};

export const RecallMemoryTool: RegisteredTool = {
  name: 'recall_memory', description: 'Recall information from memory.', category: 'memory', permissionLevel: 'read', isReadOnly: true, isDestructive: false,
  parameters: z.object({ key: z.string() }),
  parameterDescriptions: { key: 'Key to recall' },
  examples: [{ input: '{"key": "user"}', description: 'Recall memory' }],
  execute: async ({ key }) => {
    const entry = memoryStore.get(key);
    if (!entry) return { success: false, content: '', error: `No memory for: "${key}"` };
    return { success: true, content: entry.value };
  },
};

export const ListMemoriesTool: RegisteredTool = {
  name: 'list_memories', description: 'List all memories.', category: 'memory', permissionLevel: 'read', isReadOnly: true, isDestructive: false,
  parameters: z.object({}), parameterDescriptions: {}, examples: [{ input: '{}', description: 'List memories' }],
  execute: async () => {
    if (memoryStore.size === 0) return { success: true, content: 'No memories.' };
    const entries = Array.from(memoryStore.values()).map(e => `• ${e.key} [${e.tags.join(', ')}]`).join('\n');
    return { success: true, content: entries, metadata: { count: memoryStore.size } };
  },
};

export const DeleteMemoryTool: RegisteredTool = {
  name: 'delete_memory', description: 'Delete a memory.', category: 'memory', permissionLevel: 'write', isReadOnly: false, isDestructive: true,
  parameters: z.object({ key: z.string() }), parameterDescriptions: { key: 'Key to delete' },
  examples: [{ input: '{"key": "old"}', description: 'Delete memory' }],
  execute: async ({ key }) => {
    const deleted = memoryStore.delete(key);
    if (!deleted) return { success: false, content: '', error: `Not found: "${key}"` };
    return { success: true, content: `Deleted: "${key}"` };
  },
};

export const allBaseTools: RegisteredTool[] = [
  ReadFileTool, WriteFileTool, EditFileTool, ListFilesTool,
  BashTool, GrepTool,
  SaveMemoryTool, RecallMemoryTool, ListMemoriesTool, DeleteMemoryTool,
];

export function getToolByName(name: string): RegisteredTool | undefined {
  return allBaseTools.find(t => t.name === name);
}

export function getToolsByCategory(category: ToolCategory): RegisteredTool[] {
  return allBaseTools.filter(t => t.category === category);
}

export function getAllToolDescriptions(): string {
  return allBaseTools.map(tool => {
    const paramDesc = Object.entries(tool.parameterDescriptions).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
    return `## ${tool.name}\n${tool.description}\nParameters:\n${paramDesc || '  (none)'}`;
  }).join('\n\n');
}

export function getToolPromptInstructions(): string {
  return `To use a tool, respond with a JSON object: {"tool": "tool_name", "arguments": {...}}. You can call multiple tools by including multiple JSON objects separated by newlines.`;
}

export function parseToolCalls(response: string): Array<{ name: string; arguments: Record<string, any> }> | null {
  const calls: Array<{ name: string; arguments: Record<string, any> }> = [];
  const lines = response.trim().split('\n');
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.tool && parsed.arguments) calls.push(parsed);
    } catch {}
  }
  if (calls.length === 0) {
    try {
      const parsed = JSON.parse(response);
      if (parsed.tool && parsed.arguments) calls.push(parsed);
      else if (parsed.name && parsed.args) calls.push({ name: parsed.name, arguments: parsed.args });
    } catch {}
  }
  return calls.length > 0 ? calls : null;
}

export function validateToolCall(tool: RegisteredTool, args: any): { valid: boolean; error?: string; validatedArgs?: any } {
  const result = tool.parameters.safeParse(args);
  if (!result.success) return { valid: false, error: result.error.errors.map((e: any) => e.message).join(', ') };
  return { valid: true, validatedArgs: result.data };
}
