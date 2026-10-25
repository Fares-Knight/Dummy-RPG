import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve, sep, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateNarration, buildPrompt, codexArguments, npmCodexBinary } from '../server/narrator.mjs';
import { newGame, choose } from '../src/engine.js';
import { narration, startedGame } from './fixtures.mjs';

test('Le contexte envoyé contient la scène, le choix, les résultats et la mémoire', () => {
  const previous = startedGame();
  const outcome = choose(previous, 1);
  const prompt = buildPrompt({ state: outcome.state, previous, choice: outcome.choice, action: 'choose' });
  assert.ok(prompt.includes(previous.scene.text));
  assert.ok(prompt.includes(previous.memory));
  assert.ok(prompt.includes(outcome.choice.label));
  assert.ok(prompt.includes('"focus":8'));
  assert.ok(prompt.includes('"item":"fragment"'));
});

test('Une sortie structurée invalide déclenche une correction, jamais une scène de secours', async () => {
  const prompts = [];
  const response = await generateNarration({ state: newGame(), action: 'start' }, { invoke: async prompt => {
    prompts.push(prompt);
    return { text: prompts.length === 1 ? 'invalid' : JSON.stringify(narration()), model: 'fixture' };
  } });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /CORRECTION REQUISE/);
  assert.equal(response.metadata.attempts, 2);
  assert.equal(response.narration.title, narration().title);
});

test('Deux réponses invalides ou une panne du modèle font échouer la génération', async () => {
  await assert.rejects(() => generateNarration({ state: newGame(), action: 'start' }, { invoke: async () => ({ text: '{}', model: 'fixture' }) }), /invalide/);
  await assert.rejects(() => generateNarration({ state: newGame(), action: 'start' }, { invoke: async () => { throw new Error('Indisponible'); } }), /Indisponible/);
});

test('Le narrateur utilise un schéma et un processus sans shell ni sous-agents', () => {
  const args = codexArguments();
  assert.ok(args.includes('--output-schema'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('shell_tool'));
  assert.ok(args.includes('multi_agent'));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.equal(args.at(-1), '-');
});

async function npmFixture(t, { local = false, arch = 'x64', bundled = false, legacy = false } = {}) {
  const fixturesRoot = fileURLToPath(new URL('../.runtime/test-npm/', import.meta.url));
  await mkdir(fixturesRoot, { recursive: true });
  const directory = await mkdtemp(join(fixturesRoot, 'fixture-'));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(fixturesRoot) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  const modules = join(directory, 'node_modules');
  const shim = local ? join(modules, '.bin', 'codex.cmd') : join(directory, 'codex.cmd');
  const packageRoot = join(modules, '@openai', 'codex');
  const platformRoot = bundled ? packageRoot : join(packageRoot, 'node_modules', '@openai', `codex-win32-${arch}`);
  const target = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  const executable = join(platformRoot, 'vendor', target, legacy ? 'codex' : 'bin', 'codex.exe');
  await mkdir(dirname(shim), { recursive: true });
  await mkdir(packageRoot, { recursive: true });
  await mkdir(dirname(executable), { recursive: true });
  await writeFile(shim, '@echo This fixture must never execute');
  await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: '@openai/codex' }));
  if (!bundled) await writeFile(join(platformRoot, 'package.json'), JSON.stringify({ name: `@openai/codex-win32-${arch}` }));
  await writeFile(executable, 'fixture: path discovery only, not an executable');
  return { shim, executable };
}

test('La découverte npm Windows trouve le binaire natif sans exécuter codex.cmd', async t => {
  for (const options of [{}, { local: true }, { arch: 'arm64' }, { bundled: true, legacy: true }]) {
    const { shim, executable } = await npmFixture(t, options);
    assert.equal(await npmCodexBinary(shim, options.arch || 'x64'), executable);
  }
});

test('Une installation npm incomplète ou une architecture inconnue ne fournit aucun exécutable', async t => {
  const { shim, executable } = await npmFixture(t);
  assert.equal(await npmCodexBinary(shim, 'ia32'), null);
  await rm(executable);
  assert.equal(await npmCodexBinary(shim, 'x64'), null);
  assert.equal(await npmCodexBinary(join(dirname(shim), 'missing-prefix', 'codex.cmd'), 'x64'), null);
});

test('Sous Windows, un PATH npm seul suffit sans extension VS Code ni CODEX_BINARY', { skip: process.platform !== 'win32' }, async t => {
  const { shim, executable } = await npmFixture(t, { arch: process.arch });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:path|codex_binary|userprofile)$/i.test(key)));
  env.PATH = `"${dirname(shim)}"` + delimiter + join(process.env.SystemRoot, 'System32');
  env.USERPROFILE = dirname(shim);
  const moduleUrl = new URL('../server/narrator.mjs', import.meta.url).href;
  const source = `import { findCodex } from ${JSON.stringify(moduleUrl)}; console.log(await findCodex());`;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { env, windowsHide: true, timeout: 10000 });
  assert.equal(stdout.trim(), executable);
});
