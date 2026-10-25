import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { newGame, restoreGame, choose, continueJourney, applyNarration } from './src/engine.js';
import { narratorStatus, generateNarration } from './server/narrator.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const publicFiles = new Set([
  '/index.html', '/styles.css', '/src/app.js', '/src/engine.js', '/src/icons.js',
  '/assets/emblem.svg', '/assets/forest.svg', '/assets/ranger.svg',
]);
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 600000) throw new Error('La partie transmise est trop volumineuse.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createGameServer({ generate = generateNarration, status = narratorStatus } = {}) {
  const token = randomBytes(24).toString('hex');
  const results = new Map();
  let running = false;
  let statusPromise = null, statusExpiresAt = 0;
  const cachedStatus = () => {
    if (!statusPromise || Date.now() >= statusExpiresAt) {
      // Share an in-flight CLI check and reuse its result briefly across tabs.
      statusExpiresAt = Infinity;
      statusPromise = Promise.resolve().then(status).then(data => {
        statusExpiresAt = Date.now() + 5000;
        return data;
      }, error => { statusPromise = null; statusExpiresAt = 0; throw error; });
    }
    return statusPromise;
  };
  return http.createServer(async (req, res) => {
    for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
    try {
      const host = req.headers.host || '';
      if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) return json(res, 403, { error: 'Ce POC est accessible uniquement en local.' });
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${host}`)) return json(res, 403, { error: 'Les requêtes provenant d’un autre site sont interdites.' });
      const url = new URL(req.url, `http://${host}`);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/api/status' && req.method === 'GET') return json(res, 200, { ...(await cachedStatus()), token });
      if (pathname === '/api/turn' && req.method === 'POST') {
        if (req.headers['x-lisiere-token'] !== token) return json(res, 403, { error: 'Rechargez la page pour reconnecter le narrateur.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Une requête JSON est requise.' });
        let request;
        try { request = await readJson(req); } catch { return json(res, 400, { error: 'La requête est invalide ou trop volumineuse.' }); }
        if (!request || !/^[a-zA-Z0-9-]{16,80}$/.test(request.requestId || '') || !['start', 'choose', 'continue'].includes(request.action)) return json(res, 400, { error: 'Action de jeu invalide.' });
        const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
        const existing = results.get(request.requestId);
        if (existing) {
          if (existing.fingerprint !== fingerprint) return json(res, 409, { error: 'Cet identifiant correspond à une autre décision.' });
          try { return json(res, 200, await existing.promise); } catch (error) { return json(res, 502, { error: error.message }); }
        }
        if (running) return json(res, 429, { error: 'Le narrateur écrit déjà une scène. Patientez puis réessayez.' });
        let state, previous = null, choice = null;
        if (request.action === 'start') state = newGame();
        else {
          previous = restoreGame(JSON.stringify(request.state));
          if (!previous?.scene) return json(res, 400, { error: 'La sauvegarde ne contient pas de scène IA valide.' });
          if (request.action === 'continue') {
            if (previous.status !== 'complete') return json(res, 400, { error: 'La quête est encore en cours.' });
            state = continueJourney(previous);
          } else {
            const outcome = choose(previous, request.choiceIndex);
            if (outcome.error) return json(res, 400, { error: outcome.error });
            state = outcome.state; choice = outcome.choice;
          }
        }
        running = true;
        const promise = (async () => {
          const { narration, metadata } = await generate({ state, action: request.action, choice, previous });
          const next = applyNarration(state, narration, { ...metadata, requestId: request.requestId }, previous, choice);
          if (!restoreGame(JSON.stringify(next))) throw new Error('La scène produite ne peut pas être sauvegardée. Réessayez.');
          console.log(`[narrateur] ${metadata.model} · ${request.action} · ${(metadata.durationMs / 1000).toFixed(1)} s · étape ${next.turn}`);
          return { state: next };
        })();
        results.set(request.requestId, { fingerprint, promise });
        try {
          const data = await promise;
          while (results.size > 24) results.delete(results.keys().next().value);
          return json(res, 200, data);
        } catch (error) {
          results.delete(request.requestId);
          return json(res, 502, { error: error.message || 'Le narrateur est indisponible. Votre partie est conservée.' });
        } finally { running = false; }
      }
      if (pathname.startsWith('/api/')) return json(res, 404, { error: 'Route inconnue.' });
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const publicPath = pathname === '/' ? '/index.html' : pathname;
      // An exact allowlist also rejects encoded Windows separators and private files.
      if (!publicFiles.has(publicPath)) { res.writeHead(404).end('Introuvable'); return; }
      const file = resolve(root, '.' + publicPath);
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { if (!res.headersSent) res.writeHead(404); res.end('Introuvable'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createGameServer().listen(port, '127.0.0.1', () => console.log(`Lisière · narrateur IA Codex : http://localhost:${port}`));
}
