import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import * as engine from '../src/engine.js';
import { icon } from '../src/icons.js';
import { narration, metadata, startedGame } from './fixtures.mjs';

// Execute the real controller with a small DOM/network/storage double. These
// tests cover its event flow, not browser layout, accessibility or rendering.
const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const controller = source.replace(/^import .+ from '\.\/(?:engine|icons)\.js';\r?\n/gm, '');
const settle = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor(id = '', dataset = {}) {
    this.id = id; this.dataset = dataset; this.style = {}; this.listeners = new Map();
    this.disabled = false; this.open = false; this.tagName = 'BUTTON';
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  setAttribute() {}
  removeAttribute() {}
  focus() {}
  getBoundingClientRect() { return { top: 0 }; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  closest(selector) {
    return selector === `#${this.id}` || (selector === '[data-choice]' && this.dataset.choice !== undefined) ? this : null;
  }
  async emit(type, event) { await this.listeners.get(type)?.(event); await settle(); }
}

async function application(initial, reply, storage = new Map([[engine.SAVE_KEY, JSON.stringify(initial)]])) {
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [`#${id}`, new Element(id)]));
  nodes.set('.keyboard-hint', new Element()); nodes.set('.story-panel', new Element());
  let choices = [];
  Object.defineProperty(nodes.get('#choices'), 'innerHTML', {
    set(value) {
      choices = [...value.matchAll(/data-choice="(\d+)"/g)].map(([, choice]) => new Element('', { choice }));
      if (value.includes('id="next-journey"')) nodes.set('#next-journey', new Element('next-journey'));
      else nodes.delete('#next-journey');
    },
  });
  const document = new Element();
  document.querySelector = selector => nodes.get(selector) || null;
  document.querySelectorAll = selector => selector === '[data-choice]' ? choices
    : selector === '.content-view' ? ['adventure', 'journal', 'map'].map(view => nodes.get(`#${view}-view`)) : [];
  const requests = [];
  await runInNewContext(`(async () => {\n${controller}\n})()`, {
    ...engine, icon, hydrateIcons() {}, document, structuredClone,
    crypto: { randomUUID }, AbortSignal,
    window: { innerWidth: 1200 },
    setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    fetch: async (url, options) => {
      if (url === '/api/status') return { ok: true, json: async () => ({ ready: true, token: 'test-only-token', model: 'fixture' }) };
      assert.equal(url, '/api/turn');
      const request = JSON.parse(options.body); requests.push(request);
      const state = await reply(request, requests.length);
      return { ok: true, status: 200, json: async () => ({ state }) };
    },
  }, { filename: 'src/app.js' });
  return {
    nodes, document, requests, storage, choices: () => choices,
    click: target => nodes.get('#choices').emit('click', { target }),
    key: key => document.emit('keydown', { key, target: { tagName: 'BODY' }, preventDefault() {} }),
    retry: () => nodes.get('#generation-status').emit('click', { target: new Element('retry-generation') }),
  };
}

function respond(request) {
  if (request.action === 'continue') return engine.applyNarration(engine.continueJourney(request.state), narration(), metadata);
  const outcome = engine.choose(request.state, request.choiceIndex);
  assert.equal(outcome.error, undefined);
  return engine.applyNarration(outcome.state, narration({ consequence: 'La gardienne révèle le passage sous les racines.' }), metadata, request.state, outcome.choice);
}

test('Une réponse perdue conserve la décision et bloque souris/clavier jusqu’à sa reprise', async () => {
  const initial = startedGame();
  const app = await application(initial, (request, attempt) => {
    if (attempt === 1) throw new Error('Réseau interrompu après envoi.');
    return respond(request);
  });
  assert.ok(app.choices().every(button => !button.disabled));
  await app.click(app.choices()[1]);
  assert.equal(app.requests.length, 1);
  const pending = app.storage.get(engine.SAVE_KEY + '.pending');
  assert.equal(JSON.parse(pending).requestId, app.requests[0].requestId);
  assert.deepEqual(JSON.parse(app.storage.get(engine.SAVE_KEY)), initial);
  assert.ok(app.choices().every(button => button.disabled));

  // Dispatch even on a disabled button to verify the controller guard too.
  await app.click(app.choices()[0]);
  for (const key of ['1', '2', '3']) await app.key(key);
  assert.equal(app.requests.length, 1);
  assert.equal(app.storage.get(engine.SAVE_KEY + '.pending'), pending);

  await app.retry();
  assert.equal(app.requests.length, 2);
  assert.deepEqual(app.requests[1], app.requests[0]);
  assert.equal(app.storage.has(engine.SAVE_KEY + '.pending'), false);
  const saved = JSON.parse(app.storage.get(engine.SAVE_KEY));
  assert.equal(saved.turn, 1); assert.equal(saved.focus, 8); assert.equal(saved.inventory.fragment, 1);
  assert.ok(app.choices().every(button => !button.disabled));
});

test('La poursuite d’une quête en erreur ne peut pas remplacer sa demande en attente', async () => {
  const ready = startedGame(); ready.progress = 5;
  const initial = engine.applyNarration(ready, narration({ choices: [], questCompleted: true }), metadata);
  const app = await application(initial, (request, attempt) => {
    if (attempt === 1) throw new Error('Réseau interrompu après envoi.');
    return respond(request);
  });
  await app.click(app.nodes.get('#next-journey'));
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].action, 'continue');
  assert.equal(app.nodes.get('#next-journey').disabled, true);
  await app.click(app.nodes.get('#next-journey'));
  await app.key('1');
  assert.equal(app.requests.length, 1);
  await app.retry();
  assert.deepEqual(app.requests[1], app.requests[0]);
  assert.equal(JSON.parse(app.storage.get(engine.SAVE_KEY)).questNumber, 1);
  assert.equal(app.storage.has(engine.SAVE_KEY + '.pending'), false);
});

test('Un rechargement reprend la même décision conservée après une erreur réseau', async () => {
  const initial = startedGame();
  const first = await application(initial, () => { throw new Error('Réseau indisponible.'); });
  await first.click(first.choices()[1]);
  const reloaded = await application(initial, respond, first.storage);
  assert.equal(reloaded.requests.length, 1);
  assert.deepEqual(reloaded.requests[0], first.requests[0]);
  assert.equal(reloaded.storage.has(engine.SAVE_KEY + '.pending'), false);
  assert.equal(JSON.parse(reloaded.storage.get(engine.SAVE_KEY)).turn, 1);
});
