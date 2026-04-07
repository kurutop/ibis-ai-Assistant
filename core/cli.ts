// ============================================================
// Ibis CLI - Enhanced CLI with commands and better UX
// ============================================================

import readline from 'readline';
import chalk from 'chalk';
import { IbisBrain } from './engine';
import { appStore, clearSession } from './state';
import { allBaseTools } from './tools';

// Initialize readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan.bold('❖ Ibis ❯ '),
});

// Initialize brain
const brain = new IbisBrain();

// ============================================================
// Startup Banner
// ============================================================

function printBanner(): void {
  console.log('');
  console.log(chalk.bold.magenta('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║') + chalk.bold.white('          Ibis Magus AI - Agentic Mode v2.0            ') + chalk.bold.magenta('║'));
  console.log(chalk.bold.magenta('║') + chalk.gray('          ID: GR-α-01 | Calm, Analytical, Kind             ') + chalk.bold.magenta('║'));
  console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray(`  📁 Workspace: ${appStore.getState().workspaceDir}`));
  console.log(chalk.gray(`  🤖 Model: ${appStore.getState().model}`));
  console.log(chalk.gray(`  🛠️  Tools: ${allBaseTools.length} available`));
  console.log('');
  console.log(chalk.yellow('  💡 Type /help for commands, /status for stats'));
  console.log(chalk.yellow('  💡 Type "exit" or "quit" to leave'));
  console.log('');
}

// ============================================================
// Input Processing
// ============================================================

function formatOutput(text: string): string {
  // Simple markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
    .replace(/\*(.*?)\*/g, chalk.italic('$1'))
    .replace(/`(.*?)`/g, chalk.bgBlack.whiteBright('$1'))
    .replace(/^> (.+)$/gm, chalk.gray('> $1'))
    .replace(/^• /gm, chalk.cyan('• '));
}

async function handleInput(input: string): Promise<void> {
  const trimmed = input.trim();

  // Exit commands
  if (['exit', 'quit', 'bye'].includes(trimmed.toLowerCase())) {
    console.log(chalk.yellow('\nลาก่อนค่ะ 👋 See you next time!\n'));
    process.exit(0);
  }

  if (!trimmed) return;

  // Process
  try {
    const response = await brain.process(trimmed);
    console.log('');
    console.log(chalk.green.bold('Ibis:'));
    console.log(formatOutput(response));
    console.log('');
  } catch (err: any) {
    console.error(chalk.redBright(`\n❌ Error: ${err.message}\n`));
    
    if (appStore.getState().verbose) {
      console.error(chalk.gray(err.stack || ''));
    }
  }

  rl.prompt();
}

// ============================================================
// Event Handlers
// ============================================================

rl.on('line', async (line) => {
  await handleInput(line);
});

rl.on('close', () => {
  console.log(chalk.yellow('\nลาก่อนค่ะ 👋\n'));
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (err) => {
  console.error(chalk.redBright(`\n💥 Uncaught Exception: ${err.message}\n`));
  rl.prompt();
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.redBright(`\n💥 Unhandled Promise Rejection: ${reason}\n`));
  rl.prompt();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Interrupted. Type "exit" to quit.\n'));
  rl.prompt();
});

// ============================================================
// Start
// ============================================================

printBanner();
rl.prompt();
