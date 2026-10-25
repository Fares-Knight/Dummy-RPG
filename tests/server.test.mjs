import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createGameServer } from '../server.mjs';
import { narration } from './fixtures.mjs';

async function serverFixture(t, generate, status = async () => ({ ready: true, provider: 'fixture', model: 'fixture' })) {
  const server = createGameServer({ generate, status });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { token } = await (await fetch(base + '/api/status')).json();
  const post = (body, headers = {}) => fetch(base + '/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lisiere-Token': token, ...headers }, body: JSON.stringify(body) });
  return { base, post };
}

test('Le serveur appelle le modèle au démarrage et à chaque décision', async t => {
  const calls = [];
  const { post } = await serverFixture(t, async context => {
    calls.push(context);
    return { narration: narration({ consequence: context.choice ? 'Elna révèle le passage dissimulé sous les racines.' : '' }), metadata: { provider: 'fixture', model: 'fixture', durationMs: 1 } };
  });
  const first = await post({ action: 'start', requestId: randomUUID() });
  assert.equal(first.status, 200);
  const { state } = await first.json();
  const next = await post({ action: 'choose', requestId: randomUUID(), state, choiceIndex: 1 });
  assert.equal(next.status, 200);
  const result = await next.json();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].choice.label, state.scene.choices[1].label);
  assert.equal(calls[1].state.focus, 8);
  assert.equal(result.state.turn, 1);
  assert.equal(result.state.journal.length, 1);
});

test('La même décision rejouée ne relance pas le modèle et ne redépense pas les ressources', async t => {
  let count = 0;
  const { post } = await serverFixture(t, async () => { count++; return { narration: narration(), metadata: { provider: 'fixture', model: 'fixture', durationMs: 1 } }; });
  const request = { action: 'start', requestId: randomUUID() };
  const a = await (await post(request)).json();
  const b = await (await post(request)).json();
  assert.deepEqual(a, b);
  assert.equal(count, 1);
  assert.equal((await post({ ...request, action: 'continue' })).status, 409);
});

test('Une panne IA remonte une erreur sans retourner de scène fictive', async t => {
  const { post } = await serverFixture(t, async () => { throw new Error('Le fournisseur est indisponible.'); });
  const response = await post({ action: 'start', requestId: randomUUID() });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.match(body.error, /indisponible/);
  assert.equal(body.state, undefined);
});

test('Les requêtes externes et les fichiers du serveur ne sont pas accessibles', async t => {
  const { base, post } = await serverFixture(t, async () => { throw new Error('Ne doit pas être appelé'); });
  assert.equal((await post({ action: 'start', requestId: randomUUID() }, { Origin: 'https://example.com' })).status, 403);
  for (const path of ['/server.mjs', '/server/narrator.mjs', '/.runtime/narrator/scene.schema.json', '/.env', '/package.json']) assert.equal((await fetch(base + path)).status, 404);
  for (const path of ['/', '/src/app.js', '/src/engine.js', '/assets/forest.svg']) assert.equal((await fetch(base + path)).status, 200);
});

test('Les chemins encodés ne permettent pas de sortir de la liste des fichiers publics', async t => {
  const { base } = await serverFixture(t, async () => { throw new Error('Ne doit pas être appelé'); });
  for (const path of ['/assets/..%5cindex.html', '/src/..%5cstyles.css', '/assets/%2e%2e%5c.runtime%5cprivate.html', '/src/..%2f.runtime%2fprivate.js', '/assets/%00.svg']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  const response = await fetch(base + '/assets/forest.svg', { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});

test('Le statut refuse les origines externes sans appeler la CLI ni révéler de jeton', async t => {
  let calls = 0;
  const { base } = await serverFixture(t, async () => { throw new Error('Ne doit pas être appelé'); }, async () => { calls++; return { ready: true }; });
  for (const headers of [{ Origin: 'https://example.com' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const response = await fetch(base + '/api/status', { headers });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).token, undefined);
  }
  const forgedHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(base + '/api/status', { headers: { Host: 'example.com' } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
  assert.equal(forgedHostStatus, 403);
  assert.equal(calls, 1);
  assert.equal((await fetch(base + '/api/status', { headers: { Origin: base, 'Sec-Fetch-Site': 'same-origin' } })).status, 200);
});

test('Les requêtes de statut simultanées partagent un seul contrôle de connexion', async t => {
  let calls = 0, release;
  const result = new Promise(resolve => { release = resolve; });
  let started;
  const checking = new Promise(resolve => { started = resolve; });
  const server = createGameServer({ status: async () => { calls++; started(); return result; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const requests = Array.from({ length: 4 }, () => fetch(base + '/api/status'));
  await checking;
  release({ ready: true, provider: 'fixture' });
  const responses = await Promise.all(requests);
  for (const response of responses) assert.equal(response.status, 200);
  assert.equal((await fetch(base + '/api/status')).status, 200);
  assert.equal(calls, 1);
});

test('La page interdit les cadres et les scripts externes tout en conservant ses ressources visuelles', async t => {
  const { base } = await serverFixture(t, async () => { throw new Error('Ne doit pas être appelé'); });
  const response = await fetch(base + '/');
  assert.equal(response.status, 200);
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /script-src 'self';/);
  assert.match(policy, /style-src 'self' 'unsafe-inline' https:\/\/fonts.googleapis.com;/);
  assert.match(policy, /font-src 'self' https:\/\/fonts.gstatic.com;/);
  assert.match(policy, /img-src 'self' data:;/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal((await fetch(base + '/', { headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Dest': 'iframe' } })).status, 403);
});

test('Un appel sans jeton valide ne lance jamais une génération', async t => {
  let calls = 0;
  const { post } = await serverFixture(t, async () => { calls++; throw new Error('Ne doit pas être appelé'); });
  for (const token of ['', 'invalid']) {
    assert.equal((await post({ action: 'start', requestId: randomUUID() }, { 'X-Lisiere-Token': token })).status, 403);
  }
  assert.equal(calls, 0);
});
