import { newGame, getScene, getQuest, unavailableReason, drinkPotion, restoreGame, REGIONS, ITEMS, SAVE_KEY, MAX_HP, MAX_FOCUS } from './engine.js';
import { icon, hydrateIcons } from './icons.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
let state = newGame();
let storageAvailable = true;
try { state = restoreGame(localStorage.getItem(SAVE_KEY)) || state; } catch { storageAvailable = false; }
let activeView = 'adventure';
let busy = false;
let toastTimer;
let sound;
let soundEnabled = false;
let narrator = { ready: false, model: '', message: 'Connexion au narrateur…' };
let requestToken = '';
let generationError = '';
let pendingRequest = null;
let writingStarted = 0;
let writingTimer;
try {
  const pending = JSON.parse(localStorage.getItem(SAVE_KEY + '.pending'));
  if (pending && /^[a-zA-Z0-9-]{16,80}$/.test(pending.requestId || '') && ['start', 'choose', 'continue'].includes(pending.action)) pendingRequest = pending;
} catch { /* No valid pending decision. */ }

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); storageAvailable = true; } catch { storageAvailable = false; }
  $('#save-status').innerHTML = `<span class="save-dot"></span>${storageAvailable ? 'Votre progression est sauvegardée' : 'Progression conservée pour cette session'}`;
}

function changesHtml(result) {
  const symbols = { hp: ['heart', 'vitalité'], focus: ['sparkles', 'instinct'], gold: ['coins', 'or'] };
  let html = Object.entries(symbols).filter(([key]) => result.changes[key]).map(([key, [symbol, label]]) => `<span class="${result.changes[key] < 0 ? 'negative' : ''}">${icon(symbol)}${result.changes[key] > 0 ? '+' : ''}${result.changes[key]} ${label}</span>`).join('');
  if (result.item && ITEMS[result.item]) html += `<span>${icon(ITEMS[result.item].icon)}+1 ${esc(ITEMS[result.item].name.toLowerCase())}</span>`;
  return html ? `<div class="result-changes">${html}</div>` : '';
}

function renderStats() {
  $('#hp-value').textContent = state.hp;
  $('#focus-value').textContent = state.focus;
  $('#gold-value').textContent = state.gold;
  $('#hp-bar').style.width = `${state.hp / MAX_HP * 100}%`;
  $('#focus-bar').style.width = `${state.focus / MAX_FOCUS * 100}%`;
  $('#hp-meter').setAttribute('aria-valuenow', state.hp);
  $('#focus-meter').setAttribute('aria-valuenow', state.focus);
  $('#hp-meter').classList.toggle('low', state.hp <= 6);
  $('#level-badge').textContent = state.questNumber + 1;
  const quest = getQuest(state);
  $('#quest-title').textContent = quest.title;
  $('#quest-description').textContent = state.status === 'complete' ? 'Quête accomplie. Une nouvelle page vous attend au-delà de la brume.' : quest.description;
  $('#quest-count').textContent = `${state.progress} / 5`;
  $('#quest-dots').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < state.progress ? 'filled' : ''}"></i>`).join('');
  $('#inventory').innerHTML = Object.entries(ITEMS).filter(([id]) => state.inventory[id] > 0 || id === 'potion').map(([id, item]) => `<button class="inventory-item item-${id}" data-item="${id}" title="${esc(item.description)}" aria-label="${esc(item.name)}, ${state.inventory[id]}. ${esc(item.description)}"><span>${icon(item.icon)}</span><span class="item-name">${esc(item.name)}</span><span class="item-quantity">×${state.inventory[id]}</span></button>`).join('');
  const count = $('#journal-count');
  count.textContent = state.journal.length;
  count.hidden = !state.journal.length;
}

function choiceMeta(choice, reason) {
  if (reason) return esc(reason);
  const parts = [];
  if (choice.cost) parts.push(`${icon('sparkles')} ${choice.cost} instinct`);
  if (choice.goldCost) parts.push(`${icon('coins')} ${choice.goldCost} pièces`);
  if (choice.chance < 1) parts.push(`${icon('compass')} ${Math.round(choice.chance * 100)} % de réussite`);
  if (!parts.length) parts.push(`${icon('leaf')} Sans risque`);
  return parts.map(part => `<span>${part}</span>`).join('');
}

function renderStory() {
  const scene = getScene(state);
  const region = REGIONS.find(r => r.id === state.region);
  $('#scene-art').dataset.region = state.region;
  $('#location').textContent = region.name.toLocaleUpperCase('fr');
  $('#day').textContent = `${state.turn % 6 < 3 ? 'NUIT' : 'AUBE'} · JOUR ${String(Math.floor(state.turn / 6) + 1).padStart(2, '0')}`;
  const roman = new Intl.NumberFormat('fr').format(state.questNumber + 1);
  const chapter = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][state.questNumber] || roman;
  $('#chapter').textContent = state.status === 'complete' ? 'QUÊTE ACCOMPLIE · LE VOYAGE CONTINUE' : state.status === 'dead' ? 'ÉPILOGUE · UN SOUFFLE DANS LES BOIS' : `CHAPITRE ${chapter} · ${state.turn === 0 ? 'LE PREMIER PAS' : region.subtitle.toLocaleUpperCase('fr')}`;
  $('#scene-title').textContent = scene.title;
  const paragraphs = scene.text.split('\n');
  $('#narrative').innerHTML = (state.mood && state.status === 'playing' ? `<p class="mood">${esc(state.mood)}</p>` : '') + paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
  const consequence = $('#consequence');
  consequence.hidden = !state.lastResult;
  if (state.lastResult) {
    consequence.classList.toggle('failure', !state.lastResult.success);
    consequence.innerHTML = `${esc(state.lastResult.text)}${changesHtml(state.lastResult)}`;
  }
  $('#choice-prompt').textContent = state.status === 'playing' ? 'QU’ALLEZ-VOUS FAIRE ?' : 'CHAQUE FIN EST UN COMMENCEMENT';
  if (state.status === 'playing') {
    $('#choices').innerHTML = scene.choices.map((choice, index) => {
      const reason = unavailableReason(state, choice);
      return `<button class="choice" data-choice="${index}" ${reason ? 'disabled' : ''}><span class="choice-number">${index + 1}</span><span class="choice-icon">${icon(choice.icon)}</span><span class="choice-copy"><span class="choice-title">${esc(choice.label)}</span><span class="choice-description">${esc(choice.detail)}</span></span><span class="choice-meta">${choiceMeta(choice, reason)}</span><span class="choice-arrow">${icon('arrow')}</span></button>`;
    }).join('');
  } else {
    $('#choices').innerHTML = `<button class="choice" id="next-journey"><span class="choice-icon">${icon(state.status === 'complete' ? 'compass' : 'restart')}</span><span class="choice-copy"><span class="choice-title">${state.status === 'complete' ? 'Explorer au-delà de la brume' : 'Écrire une nouvelle histoire'}</span><span class="choice-description">${state.status === 'complete' ? 'Conservez votre personnage et commencez une nouvelle quête.' : 'Recommencez avec un nouveau destin et toutes vos forces.'}</span></span><span class="choice-arrow">${icon('arrow')}</span></button>`;
  }
  $('.keyboard-hint').hidden = state.status !== 'playing' || !state.scene;
  $('#story-footer-text').textContent = state.generation ? `${state.generation.model} · ${(state.generation.durationMs / 1000).toLocaleString('fr', { maximumFractionDigits: 1 })} s · scène générée par IA` : 'Chaque scène sera écrite par le narrateur IA.';
  if (!state.scene) {
    $('#choice-prompt').textContent = 'VOTRE AVENTURE VA COMMENCER';
    $('#narrative').innerHTML = '<p>Le narrateur imagine votre arrivée dans les terres d’Elderwyn. Votre première situation et vos choix apparaîtront ici.</p>';
    $('#choices').innerHTML = '';
  }
}

function renderJournal() {
  const entries = $('#journal-entries');
  if (!state.journal.length) {
    entries.innerHTML = `<div class="empty-journal">${icon('feather')}<h3>La première page est encore blanche.</h3><p>Faites votre premier choix.<br>Vos rencontres et leurs conséquences s’inscriront ici.</p></div>`;
    return;
  }
  entries.innerHTML = [...state.journal].reverse().map(entry => `<article class="journal-entry"><span class="entry-kicker">ÉTAPE ${String(entry.turn).padStart(2, '0')} · ${esc(REGIONS.find(r => r.id === entry.region)?.name || 'Elderwyn')}</span><h3>${esc(entry.title)}</h3><p class="entry-choice">${esc(entry.choice)}</p><p>${esc(entry.text)}</p>${changesHtml(entry)}</article>`).join('');
}

function renderMap() {
  const regionIcons = { forest: 'leaf', marsh: 'lantern', ruins: 'book', heights: 'mountain', sanctuary: 'sparkles' };
  $('#journey-map').innerHTML = `<svg viewBox="0 0 700 450" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="trees" width="46" height="54" patternUnits="userSpaceOnUse"><path d="m20 16-8 14h5l-8 12h22l-8-12h5ZM20 40v7" stroke="#72805b" opacity=".17" fill="none" stroke-width=".8"/></pattern></defs><rect width="700" height="450" fill="url(#trees)"/><path d="M30 380Q170 380 230 250T510 100Q600 90 665 35" fill="none" stroke="#697d6829" stroke-width="27"/><path d="M30 380Q170 380 230 250T510 100Q600 90 665 35" fill="none" stroke="#96a38b27" stroke-width="1"/><path d="M168 328Q180 250 287 238T476 288Q555 195 490 126T301 85Q248 130 287 238M168 328Q360 390 476 288M287 238 490 126" fill="none" stroke="#ac9d6b" stroke-opacity=".4" stroke-width="1.5" stroke-dasharray="4 7"/><path d="m545 333 23-42 24 42m-15-18 13-27 30 45m-39-10 20-13 28 39" fill="none" stroke="#7b896242" stroke-width="1.2"/><path d="m95 122 23-42 24 42m-15-18 13-27 30 45" fill="none" stroke="#7b896242" stroke-width="1.2"/></svg>${REGIONS.map(region => `<div class="map-node ${state.visited.includes(region.id) ? 'visited' : ''} ${region.id === state.region ? 'current' : ''}" style="left:${region.x}%;top:${region.y}%" aria-label="${esc(region.name)}, ${region.id === state.region ? 'votre position actuelle' : state.visited.includes(region.id) ? 'exploré' : 'à découvrir'}"><span class="node-icon">${icon(regionIcons[region.id])}</span><span class="node-label">${esc(region.name)}</span></div>`).join('')}<div class="map-compass" aria-hidden="true"><small>N</small>✧</div>`;
}

function render() { renderStats(); renderStory(); renderJournal(); renderMap(); renderGeneration(); save(); }

function renderGeneration() {
  const panel = $('#generation-status');
  panel.hidden = !busy && !generationError;
  panel.classList.toggle('generation-error', !!generationError);
  if (busy) panel.innerHTML = `<span class="writing-orb"></span><div><strong>${state.scene ? 'Le narrateur écrit la suite…' : 'Le narrateur invente votre première scène…'}</strong><span>Génération réelle via Codex · <span id="writing-seconds">${Math.floor((Date.now() - writingStarted) / 1000)}</span> s</span></div>`;
  else if (generationError) panel.innerHTML = `<div><strong>Le narrateur n’a pas pu répondre</strong><p>${esc(generationError)}</p><button id="retry-generation" class="secondary-button">Réessayer ${icon('restart')}</button></div>`;
  $('#narrator-label').textContent = busy ? 'L’IA écrit…' : generationError ? 'Narrateur indisponible' : narrator.ready ? 'Narrateur Codex' : 'Connexion au narrateur';
  $('#narrator-info').classList.toggle('is-writing', busy);
  $('#adventure-view').setAttribute('aria-busy', String(busy));
  $('#restart-button').disabled = busy;
  document.querySelectorAll('[data-choice]').forEach(button => {
    const choice = state.scene?.choices[Number(button.dataset.choice)];
    button.disabled = busy || !!pendingRequest || !narrator.ready || !choice || !!unavailableReason(state, choice);
    button.classList.toggle('chosen', busy && pendingRequest?.action === 'choose' && Number(button.dataset.choice) === pendingRequest.choiceIndex);
  });
  if ($('#next-journey')) $('#next-journey').disabled = busy || !!pendingRequest || !narrator.ready;
  document.querySelectorAll('#inventory button').forEach(button => { button.disabled = busy || !!pendingRequest; });
}

async function connectNarrator() {
  const response = await fetch('/api/status', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Le serveur IA est inaccessible. Relancez node server.mjs puis rechargez la page.');
  narrator = await response.json();
  requestToken = narrator.token;
  if (!narrator.ready) throw new Error(narrator.message);
}

async function runTurn(request) {
  if (busy) return;
  busy = true; generationError = ''; pendingRequest = request; writingStarted = Date.now();
  try { localStorage.setItem(SAVE_KEY + '.pending', JSON.stringify(request)); } catch { /* In-memory retry remains available. */ }
  renderGeneration();
  writingTimer = setInterval(() => { const seconds = $('#writing-seconds'); if (seconds) seconds.textContent = Math.floor((Date.now() - writingStarted) / 1000); }, 1000);
  try {
    if (!requestToken || !narrator.ready) await connectNarrator();
    let response = await fetch('/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lisiere-Token': requestToken }, body: JSON.stringify(request), signal: AbortSignal.timeout(320000) });
    if (response.status === 403) {
      await connectNarrator();
      response = await fetch('/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lisiere-Token': requestToken }, body: JSON.stringify(request), signal: AbortSignal.timeout(320000) });
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'La génération a échoué.');
    const restored = restoreGame(JSON.stringify(data.state));
    if (!restored?.scene) throw new Error('La scène reçue est invalide. Votre partie précédente est conservée.');
    state = restored;
    save();
    pendingRequest = null;
    try { localStorage.removeItem(SAVE_KEY + '.pending'); } catch { /* The completed state is kept in memory. */ }
    changeView('adventure');
  } catch (error) {
    generationError = error.name === 'TimeoutError' ? 'La réponse prend trop de temps. Réessayez : votre décision et vos ressources sont conservées.' : error.message;
  } finally {
    clearInterval(writingTimer); busy = false;
    render();
    if (!generationError && activeView === 'adventure' && !$('#modal').open) {
      const heading = $('#scene-title'); heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true });
      const panel = $('.story-panel'); panel.classList.remove('entering'); void panel.offsetWidth; panel.classList.add('entering');
      if (window.innerWidth < 801 || panel.getBoundingClientRect().top < -50) panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  }
}

function newRequest(action, choiceIndex) { return { action, choiceIndex, requestId: crypto.randomUUID(), ...(action !== 'start' ? { state: structuredClone(state) } : {}) }; }

function showNarratorInfo() {
  const g = state.generation;
  showModal(`<div class="eyebrow">LE MAÎTRE DU JEU</div><h2>Une histoire écrite en direct.</h2><p>À chaque décision, <strong>Codex</strong> invente la suite à partir de votre situation, du choix effectué, de ses effets et de la mémoire du voyage.</p><p><strong>Modèle :</strong> ${esc(g?.model || narrator.model || 'en attente de la première génération')}<br><strong>Dernière génération :</strong> ${g ? (g.durationMs / 1000).toLocaleString('fr', { maximumFractionDigits: 1 }) + ' s' : 'aucune'}<br><strong>Scènes jouées :</strong> ${state.scene ? state.turn + 1 : 0}</p>${g ? `<p class="modal-note">Génération ${esc(g.requestId)}<br>${g.attempts === 2 ? 'La réponse a été corrigée après validation.' : 'Réponse validée dès le premier essai.'}</p>` : ''}<details class="memory-details"><summary>Mémoire de l’histoire</summary><p>${esc(state.memory || 'La mémoire se construira avec votre première scène.').replaceAll('\n', '<br>')}</p></details><p class="modal-note">Ce POC utilise votre connexion Codex et son quota. Les textes ne proviennent pas d’un catalogue de scènes. Une erreur est affichée si l’IA ne répond pas.</p>`);
}

function changeView(view) {
  activeView = view;
  document.querySelectorAll('.content-view').forEach(el => { el.hidden = el.id !== `${view}-view`; });
  document.querySelectorAll('[data-view]').forEach(el => {
    const current = el.dataset.view === view;
    el.classList.toggle('active', current);
    if (current) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
}

function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3400); }
function showModal(html) { $('#modal-content').innerHTML = html; $('#modal').showModal(); }
function showHelp() {
  showModal(`<img class="modal-emblem" src="/assets/emblem.svg" alt=""/><div class="eyebrow">BIENVENUE DANS LES BOIS</div><h2>Vous êtes le début de l’histoire.</h2><p>Incarnez <strong>Aëlin</strong>. Le narrateur IA invente votre quête, vos rencontres et leurs suites pendant que vous jouez.</p><div class="help-steps"><div class="help-step"><span>01</span><p><strong>Lisez et choisissez.</strong><br>Utilisez les boutons ou les touches 1, 2 et 3. L’IA écrit ensuite une nouvelle situation qui découle de votre décision.</p></div><div class="help-step"><span>02</span><p><strong>Prenez soin de votre personnage.</strong><br>Les coûts et probabilités sont affichés avant de choisir. Cliquez sur une potion pour récupérer jusqu’à 7 points de vitalité.</p></div><div class="help-step"><span>03</span><p><strong>Écrivez votre parcours.</strong><br>Cinq étapes de progression mènent à la résolution de votre quête. Le journal, la carte et la mémoire du narrateur conservent votre histoire.</p></div></div><p class="modal-note">Chaque scène fait appel à votre accès Codex. Le temps d’écriture est réel. La partie n’avance qu’après réception et validation de la réponse. Votre sauvegarde reste dans ce navigateur.</p><button class="secondary-button" id="help-start">Le sentier m’attend ${icon('arrow')}</button>`);
  $('#help-start').addEventListener('click', () => $('#modal').close());
}

function restart() {
  if (busy) return;
  showModal(`<div class="eyebrow">UN NOUVEAU DÉPART</div><h2>Une nouvelle page ?</h2><p>Votre aventure actuelle et son journal seront remplacés. Aëlin retrouvera toutes ses forces et de nouveaux chemins l’attendront.</p><div class="modal-actions"><button class="quiet-button" id="cancel-restart">Garder mon aventure</button><button class="secondary-button" id="confirm-restart">Recommencer ${icon('restart')}</button></div>`);
  $('#cancel-restart').addEventListener('click', () => $('#modal').close());
  $('#confirm-restart').addEventListener('click', () => { $('#modal').close(); changeView('adventure'); runTurn(newRequest('start')); });
}

async function toggleSound() {
  const button = $('#sound-button');
  try {
    if (!sound) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Audio indisponible');
      const context = new AudioContext();
      const master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      [110, 164.81, 220, 261.63].forEach((frequency, i) => {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency; oscillator.detune.value = i * 2;
        gain.gain.value = .022 / (i + 1); oscillator.connect(gain); gain.connect(master); oscillator.start();
      });
      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const channel = buffer.getChannelData(0); let last = 0;
      for (let i = 0; i < channel.length; i++) { last = (last + .018 * (Math.random() * 2 - 1)) / 1.018; channel[i] = last * 2; }
      const wind = context.createBufferSource(); wind.buffer = buffer; wind.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 450;
      const windGain = context.createGain(); windGain.gain.value = .055;
      wind.connect(filter); filter.connect(windGain); windGain.connect(master); wind.start();
      sound = { context, master };
    }
    await sound.context.resume();
    soundEnabled = !soundEnabled;
    sound.master.gain.cancelScheduledValues(sound.context.currentTime);
    sound.master.gain.setTargetAtTime(soundEnabled ? 1 : 0, sound.context.currentTime, .35);
    button.innerHTML = icon(soundEnabled ? 'volume' : 'volume-off');
    button.setAttribute('aria-pressed', String(soundEnabled));
    button.setAttribute('aria-label', soundEnabled ? 'Désactiver l’ambiance sonore' : 'Activer l’ambiance sonore');
    toast(soundEnabled ? 'Ambiance de la forêt activée.' : 'Ambiance sonore désactivée.');
  } catch { toast('L’ambiance sonore n’est pas disponible dans ce navigateur.'); }
}

function makeChoice(index) {
  if (busy || pendingRequest || activeView !== 'adventure' || $('#modal').open) return;
  const choice = state.scene?.choices[index];
  if (!choice || state.status !== 'playing') return;
  const reason = unavailableReason(state, choice);
  if (reason) { toast(reason); return; }
  runTurn(newRequest('choose', index));
}

hydrateIcons();
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
document.querySelectorAll('[data-return]').forEach(button => button.addEventListener('click', () => changeView('adventure')));
$('#help-button').addEventListener('click', showHelp);
$('#narrator-info').addEventListener('click', showNarratorInfo);
$('#restart-button').addEventListener('click', restart);
$('#sound-button').addEventListener('click', toggleSound);
$('#modal-close').addEventListener('click', () => $('#modal').close());
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const rect = $('#modal').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('#modal').close(); } });
$('#choices').addEventListener('click', event => {
  const choice = event.target.closest('[data-choice]');
  if (choice) makeChoice(Number(choice.dataset.choice));
  if (event.target.closest('#next-journey') && !pendingRequest) runTurn(newRequest(state.status === 'complete' ? 'continue' : 'start'));
});
$('#generation-status').addEventListener('click', async event => {
  if (!event.target.closest('#retry-generation')) return;
  if (pendingRequest || !state.scene) return runTurn(pendingRequest || newRequest('start'));
  try { await connectNarrator(); generationError = ''; } catch (error) { generationError = error.message; }
  renderGeneration();
});
$('#inventory').addEventListener('click', event => {
  const button = event.target.closest('[data-item]'); if (!button || busy || pendingRequest) return;
  const id = button.dataset.item;
  if (id === 'potion') {
    const result = drinkPotion(state);
    if (result.error) toast(result.error);
    else { state = result.state; renderStats(); save(); toast(`Potion utilisée : +${result.heal} vitalité.`); }
  } else {
    const item = ITEMS[id];
    showModal(`<div class="eyebrow">DANS VOTRE BESACE</div><h2>${esc(item.name)}</h2><p>${id === 'dagger' ? 'Une lame de voyage, conservée depuis votre départ. Le narrateur connaît votre équipement et peut en tenir compte dans les situations proposées.' : 'Un éclat d’ambre découvert pendant votre voyage. Le narrateur connaît cet objet et garde la mémoire de son origine.'}</p><p class="modal-note">Quantité : ${state.inventory[id]} · ${esc(item.description)}</p>`);
  }
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (['1', '2', '3'].includes(event.key) && activeView === 'adventure' && !$('#modal').open) { event.preventDefault(); makeChoice(Number(event.key) - 1); }
});
render();
changeView('adventure');
try {
  await connectNarrator();
  renderGeneration();
  if (pendingRequest) await runTurn(pendingRequest);
  else if (!state.scene) await runTurn(newRequest('start'));
} catch (error) { generationError = error.message; renderGeneration(); }
