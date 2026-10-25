// Explicit test fixture. Never imported by the application or the live narrator.
import { newGame, applyNarration } from '../src/engine.js';
export const metadata = { provider: 'test-double', model: 'fixture', durationMs: 10, requestId: 'fixture-request-0001', attempts: 1 };
export function narration(overrides = {}) {
  const choice = { label: 'Interroger la gardienne', detail: 'Lui demander où se trouve le sceau disparu.', icon: 'book', chance: 1, cost: 0, goldCost: 0, hp: 0, focus: 0, gold: 0, progress: 1, failHp: -3, item: null };
  return {
    title: 'La gardienne du seuil', text: 'Une gardienne vous attend devant une porte fermée. Elle vous demande de retrouver le sceau dérobé à son village. Le voleur a laissé des traces dans la terre humide.', region: 'forest',
    quest: { title: 'Le sceau disparu', description: 'Retrouver le sceau de la gardienne et le rapporter au village.' },
    memory: 'La gardienne Elna a confié à Aëlin la quête du sceau disparu.', consequence: '', questCompleted: false,
    choices: [choice, { ...choice, label: 'Lire les traces', cost: 2, item: 'fragment' }, { ...choice, label: 'Poursuivre le voleur', chance: .5, gold: 3 }],
    ...overrides,
  };
}
export function startedGame() { return applyNarration(newGame(18234), narration(), metadata); }
