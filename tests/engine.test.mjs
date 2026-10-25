import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, choose, drinkPotion, continueJourney, getScene, unavailableReason, restoreGame, validateNarration, applyNarration } from '../src/engine.js';
import { narration, metadata, startedGame } from './fixtures.mjs';

test('Une nouvelle partie ne contient aucune histoire ni choix préécrits', () => {
  const state = newGame(1);
  assert.equal(state.scene, null);
  assert.equal(state.quest, null);
  assert.equal(getScene(state).text, '');
  assert.deepEqual(getScene(state).choices, []);
  assert.equal(state.memory, '');
});

test('Un choix applique ses règles sans inventer de narration ni altérer la sauvegarde', () => {
  const previous = startedGame();
  const outcome = choose(previous, 1);
  assert.equal(outcome.state.focus, 8);
  assert.equal(outcome.state.inventory.fragment, 1);
  assert.equal(outcome.result.text, '');
  assert.equal(outcome.state.progress, 1);
  assert.equal(previous.focus, 10);
  assert.equal(previous.turn, 0);
  assert.equal(previous.inventory.fragment, 0);
});

test('Les conséquences générées entrent dans le journal après validation seulement', () => {
  const previous = startedGame();
  const outcome = choose(previous, 0);
  const next = applyNarration(outcome.state, narration({ title: 'Le secret d’Elna', consequence: 'Elna vous indique le passage sous les racines.', memory: 'Elna a révélé le passage sous les racines. Le sceau y est caché.' }), metadata, previous, outcome.choice);
  assert.equal(next.journal.length, 1);
  assert.equal(next.journal[0].choice, previous.scene.choices[0].label);
  assert.equal(next.journal[0].narrative, previous.scene.text);
  assert.equal(next.lastResult.text, 'Elna vous indique le passage sous les racines.');
  assert.match(next.memory, /racines/);
  assert.deepEqual(restoreGame(JSON.stringify(next)), next);
});

test('Les réponses invalides, bloquantes ou contradictoires sont rejetées', () => {
  const state = startedGame();
  assert.throws(() => validateNarration(narration({ choices: [] }), state));
  assert.throws(() => validateNarration(narration({ choices: narration().choices.map(c => ({ ...c, chance: .7 })) }), state));
  assert.throws(() => validateNarration(narration({ questCompleted: true, choices: [] }), state));
  assert.throws(() => validateNarration(narration({ quest: { title: 'Une autre quête', description: 'Une description suffisamment longue.' } }), state));
  assert.throws(() => validateNarration(narration({ choices: narration().choices.map(c => ({ ...c, gold: 9000 })) }), state));
});

test('Les ressources insuffisantes empêchent la dépense et les choix invalides sont refusés', () => {
  const s = startedGame(); s.focus = 0;
  assert.equal(unavailableReason(s, s.scene.choices[1]), 'Instinct insuffisant');
  assert.strictEqual(choose(s, 1).state, s);
  assert.ok(choose(s, 1).error);
  assert.ok(choose(s, 9).error);
  assert.ok(choose(s, .5).error);
});

test('Une potion soigne sans dépasser le maximum ni se perdre à pleine santé', () => {
  const s = startedGame();
  assert.ok(drinkPotion(s).error);
  s.hp = 18;
  const result = drinkPotion(s);
  assert.equal(result.heal, 2);
  assert.equal(result.state.hp, 20);
  assert.equal(result.state.inventory.potion, 1);
  assert.equal(s.inventory.potion, 2);
});

test('Mort et conclusion viennent du modèle mais restent contraintes par les règles', () => {
  const dead = startedGame(); dead.hp = 0; dead.status = 'dead';
  const ending = applyNarration(dead, narration({ choices: [] }), metadata);
  assert.equal(ending.status, 'dead');
  assert.ok(choose(ending, 0).error);
  const ready = startedGame(); ready.progress = 5;
  const complete = applyNarration(ready, narration({ choices: [], questCompleted: true }), metadata);
  assert.equal(complete.status, 'complete');
  const continued = continueJourney(complete);
  assert.equal(continued.quest, null);
  assert.equal(continued.progress, 0);
  assert.equal(continued.questNumber, 1);
  assert.equal(continued.memory, complete.memory);
  assert.equal(continued.gold, complete.gold + 10);
});

test('Une quête à cinq étapes impose sa conclusion sans empêcher une fin par mort', () => {
  const ready = startedGame(); ready.progress = 5;
  assert.throws(() => validateNarration(narration(), ready), /conclure/);
  const completed = applyNarration(ready, narration({ choices: [], questCompleted: true }), metadata);
  assert.equal(completed.status, 'complete');
  assert.deepEqual(restoreGame(JSON.stringify(completed)), completed);

  const dead = { ...ready, hp: 0, status: 'dead' };
  const ending = applyNarration(dead, narration({ choices: [], questCompleted: false }), metadata);
  assert.equal(ending.status, 'dead');
  assert.deepEqual(restoreGame(JSON.stringify(ending)), ending);
});

test('Les anciennes sauvegardes simulées et les données corrompues sont rejetées', () => {
  const state = startedGame();
  assert.deepEqual(restoreGame(JSON.stringify(state)), state);
  for (const value of [null, {}, { ...state, version: 1 }, { ...state, hp: -1 }, { ...state, memory: null }, { ...state, scene: { choices: [] } }, { ...state, journal: [{}] }, { ...state, generation: { provider: 'Codex' } }]) assert.equal(restoreGame(JSON.stringify(value)), null);
});
