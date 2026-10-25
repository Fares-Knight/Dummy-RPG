// Real inference test, opt-in: uses the currently connected Codex account.
import { mkdir, writeFile } from 'node:fs/promises';
import { newGame, applyNarration, choose, restoreGame } from '../src/engine.js';
import { generateNarration, narratorStatus } from '../server/narrator.mjs';

const status = await narratorStatus();
console.log(JSON.stringify(status));
if (!status.ready) process.exit(1);
let state = newGame();
const evidence = [];
for (let step = 0; step < 3; step++) {
  let previous = null, choice = null;
  if (step > 0) {
    previous = state;
    const index = state.scene.choices.findIndex(c => c.chance === 1 && c.cost === 0 && c.goldCost === 0 && c.progress === 1);
    const outcome = choose(state, index);
    if (outcome.error) throw new Error(outcome.error);
    state = outcome.state; choice = outcome.choice;
  }
  const { narration, metadata } = await generateNarration({ state, action: step ? 'choose' : 'start', choice, previous });
  state = applyNarration(state, narration, { ...metadata, requestId: `live-test-${Date.now()}-${step}` }, previous, choice);
  if (!restoreGame(JSON.stringify(state))) throw new Error('Sauvegarde IA invalide.');
  const entry = { step, choice: choice?.label || null, ...metadata, narration };
  evidence.push(entry);
  console.log(JSON.stringify(entry));
  await mkdir('.runtime', { recursive: true });
  await writeFile('.runtime/live-narrator-evidence.json', JSON.stringify(evidence, null, 2));
}
console.log('PASS : 3 scènes réellement générées, 2 choix suivis, état et mémoire conservés.');
