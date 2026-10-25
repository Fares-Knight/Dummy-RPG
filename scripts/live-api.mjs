import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { restoreGame } from '../src/engine.js';

const base = `http://localhost:${process.env.PORT || 3000}`;
const config = await (await fetch(base + '/api/status')).json();
if (!config.ready) throw new Error(config.message);
const evidence = [];
let state;
for (let i = 0; i < 2; i++) {
  const choiceIndex = i ? state.scene.choices.findIndex(c => c.chance === 1 && !c.cost && !c.goldCost && c.progress === 1) : undefined;
  const request = { requestId: randomUUID(), action: i ? 'choose' : 'start', ...(i ? { state, choiceIndex } : {}) };
  const response = await fetch(base + '/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lisiere-Token': config.token }, body: JSON.stringify(request), signal: AbortSignal.timeout(320000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  state = restoreGame(JSON.stringify(data.state));
  if (!state?.scene) throw new Error('Réponse HTTP non jouable.');
  evidence.push({ requestId: request.requestId, action: request.action, choice: i ? state.journal.at(-1).choice : null, state });
  console.log(JSON.stringify({ turn: state.turn, title: state.scene.title, quest: state.quest.title, consequence: state.lastResult?.text, model: state.generation.model, durationMs: state.generation.durationMs, choices: state.scene.choices.map(c => c.label) }));
  await mkdir('.runtime', { recursive: true });
  await writeFile('.runtime/live-api-evidence.json', JSON.stringify(evidence, null, 2));
}
console.log('PASS : démarrage et décision réels via HTTP, sauvegarde validée.');
