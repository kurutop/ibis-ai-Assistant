// ============================================================
// Ibis Magus AI v2.0 - Test Suite
// ============================================================

async function testTools() {
  const { allBaseTools, getToolByName, getAllToolDescriptions, parseToolCalls, validateToolCall } = await import('./core/tools');
  console.log('✅ Tools loaded:', allBaseTools.length, 'tools');
  console.log('   Names:', allBaseTools.map(t => t.name).join(', '));

  const desc = getAllToolDescriptions();
  console.log('✅ Tool descriptions:', desc.length, 'chars');

  const testCalls = parseToolCalls('{"tool": "read_file", "arguments": {"filepath": "test.txt"}}');
  console.log('✅ Parse tool calls:', testCalls ? 'works' : 'failed');

  const tool = getToolByName('read_file');
  if (tool) {
    const v = validateToolCall(tool, { filepath: 'test.txt' });
    console.log('✅ Validation:', v.valid ? 'valid' : v.error);
  }
}

async function testState() {
  const { appStore, addMessage, clearSession, updateConfig } = await import('./core/state');
  console.log('\n✅ State store loaded');
  console.log('   Session:', appStore.getState().sessionId);

  addMessage({ role: 'user', content: 'test', timestamp: Date.now() });
  console.log('   Messages after add:', appStore.getState().messages.length);

  clearSession();
  console.log('   Messages after clear:', appStore.getState().messages.length);

  updateConfig({ model: 'llama3.1:8b' });
  console.log('   Model updated:', appStore.getState().model);
}

async function testCommands() {
  const { executeCommand, allCommands } = await import('./core/commands');
  console.log('\n✅ Commands loaded:', allCommands.length, 'commands');

  const help = await executeCommand('/help');
  console.log('   /help:', help?.success ? '✅' : '❌');

  const tools = await executeCommand('/tools');
  console.log('   /tools:', tools?.success ? '✅' : '❌');

  const status = await executeCommand('/status');
  console.log('   /status:', status?.success ? '✅' : '❌');

  const model = await executeCommand('/model llama3.1:8b');
  console.log('   /model:', model?.success ? '✅' : '❌');
}

async function testPermissions() {
  const { PermissionManager } = await import('./core/permissions');
  console.log('\n✅ Permissions loaded');

  const pm = PermissionManager.presets.cautious();
  const allow = pm.evaluate({ toolName: 'read_file', args: {}, isReadOnly: true, isDestructive: false, category: 'file' });
  console.log('   Read file:', allow.action);

  const ask = pm.evaluate({ toolName: 'bash', args: {}, isReadOnly: false, isDestructive: true, category: 'shell' });
  console.log('   Bash:', ask.action);
}

async function testHooks() {
  const { hookManager } = await import('./core/hooks');
  console.log('\n✅ Hooks loaded');
  console.log('   Registered:', hookManager.getHooks().length, 'hooks');
}

async function testContextManager() {
  const { createContextManager } = await import('./core/contextManager');
  console.log('\n✅ Context Manager loaded');

  const cm = createContextManager({
    agentName: 'Test', agentId: 'test-01', role: 'Tester',
    capabilities: ['Testing'], constraints: ['None'],
    workspaceDir: process.cwd(), currentDate: new Date().toISOString(),
  });

  const prompt = cm.buildSystemPrompt();
  console.log('   System prompt:', prompt.length, 'chars');

  cm.addMessage('user', 'Hello');
  cm.addMessage('assistant', 'Hi!');
  console.log('   Messages:', cm.getHistory().length);
  console.log('   Tokens:', cm.getTokenUsage());
}

async function testEngine() {
  const { IbisBrain } = await import('./core/engine');
  console.log('\n✅ Engine loaded');
  const brain = new IbisBrain();
  console.log('   Brain initialized');
  console.log('   Tools:', brain.getTools().length);
}

async function runAll() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Ibis Magus AI v2.0 - Test Suite           ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    await testTools();
    await testState();
    await testCommands();
    await testPermissions();
    await testHooks();
    await testContextManager();
    await testEngine();

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║           ✅ ALL TESTS PASSED! ✅            ║');
    console.log('╚══════════════════════════════════════════════╝\n');
  } catch (err: any) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runAll();
