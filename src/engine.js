// Rules only: every scene, quest, choice and narrative consequence comes from the model.
export const SAVE_KEY = 'lisiere.ai-adventure.v2';
export const MAX_HP = 20;
export const MAX_FOCUS = 10;
export const REGIONS = [
  { id: 'forest', name: 'Forêt d’Éther', subtitle: 'Sous les branches anciennes', x: 24, y: 73 },
  { id: 'marsh', name: 'Marais des lanternes', subtitle: 'Les eaux se souviennent', x: 41, y: 53 },
  { id: 'ruins', name: 'Ruines de Valombre', subtitle: 'Les pierres ont une voix', x: 68, y: 64 },
  { id: 'heights', name: 'Les Hauts de Cendre', subtitle: 'Plus près des étoiles', x: 70, y: 28 },
  { id: 'sanctuary', name: 'Sanctuaire de l’Aube', subtitle: 'Là où tout prend racine', x: 43, y: 19 },
];
export const ITEMS = {
  dagger: { name: 'Dague de voyage', description: 'Une vieille lame, une fidèle alliée.', icon: 'sword', permanent: true },
  potion: { name: 'Potion de soin', description: 'Boire : restaure 7 points de vitalité.', icon: 'potion' },
  fragment: { name: 'Fragment d’ambre', description: 'Un éclat chaud, chargé de souvenirs.', icon: 'gem' },
};
export const CHOICE_ICONS = ['lantern', 'eye', 'footprints', 'hand', 'sparkles', 'coins', 'leaf', 'campfire', 'potion', 'book', 'bag', 'mountain', 'sword', 'gem', 'compass', 'feather', 'moon', 'map'];
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const clamp = (value, max) => Math.max(0, Math.min(max, value));

export function newGame(seed = Date.now() >>> 0) {
  return { version: 2, seed: (seed >>> 0) || 1, hp: MAX_HP, focus: MAX_FOCUS, gold: 12, inventory: { dagger: 1, potion: 2, fragment: 0 }, turn: 0, questNumber: 0, progress: 0, region: 'forest', visited: ['forest'], journal: [], mood: '', memory: '', lastResult: null, scene: null, quest: null, generation: null, status: 'playing' };
}
export const getQuest = state => state.quest || { title: 'Votre quête prend forme', description: 'Le narrateur invente votre aventure.' };
export const getScene = state => state.scene || { title: 'Une histoire encore à écrire', text: '', choices: [] };

export function validChoice(c) {
  return c && str(c.label, 3, 110) && str(c.detail, 3, 180) && CHOICE_ICONS.includes(c.icon)
    && Number.isFinite(c.chance) && c.chance >= .5 && c.chance <= 1
    && int(c.cost, 0, 3) && int(c.goldCost, 0, 8) && int(c.hp, 0, 5) && int(c.focus, 0, 3)
    && int(c.gold, 0, 6) && int(c.progress, 0, 1) && int(c.failHp, -5, -1)
    && [null, 'potion', 'fragment'].includes(c.item);
}
export function validateNarration(n, state) {
  if (!n || !str(n.title, 3, 100) || !str(n.text, 40, 4000) || !str(n.memory, 10, 6500)
      || !str(n.consequence, 0, 1200) || !REGIONS.some(r => r.id === n.region)
      || !n.quest || !str(n.quest.title, 3, 100) || !str(n.quest.description, 10, 350)
      || typeof n.questCompleted !== 'boolean' || !Array.isArray(n.choices)) throw new Error('La réponse du narrateur est incomplète.');
  if (state.quest && (n.quest.title !== state.quest.title || n.quest.description !== state.quest.description)) throw new Error('Le narrateur a changé la quête en cours.');
  if (n.questCompleted && (state.progress < 5 || state.hp <= 0)) throw new Error('La conclusion de quête est prématurée.');
  if (state.progress === 5 && state.hp > 0 && !n.questCompleted) throw new Error('Le narrateur doit conclure la quête accomplie.');
  const terminal = state.hp === 0 || n.questCompleted;
  if (terminal ? n.choices.length !== 0 : n.choices.length !== 3 || !n.choices.every(validChoice)) throw new Error('Les choix du narrateur ne respectent pas les règles.');
  if (!terminal && new Set(n.choices.map(c => c.label.toLocaleLowerCase('fr'))).size !== 3) throw new Error('Le narrateur a répété un choix.');
  if (!terminal && !n.choices.some(c => c.chance === 1 && c.cost === 0 && c.goldCost === 0 && c.progress === 1)) throw new Error('Il manque une action gratuite permettant de continuer.');
  if (state.lastResult && !n.consequence.trim()) throw new Error('Le narrateur a oublié la conséquence du choix.');
  return n;
}

export function unavailableReason(state, choice) {
  if (state.focus < choice.cost) return 'Instinct insuffisant';
  if (state.gold < choice.goldCost) return 'Or insuffisant';
  return '';
}

function random(state) {
  let n = state.seed | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
  state.seed = n >>> 0; return state.seed / 4294967296;
}

// Resolves only game mechanics. The model writes what actually happens afterwards.
export function choose(previous, index) {
  if (!previous.scene || previous.status !== 'playing') return { state: previous, error: 'Aucune décision n’est disponible.' };
  const choice = previous.scene.choices[index];
  if (!choice || !Number.isInteger(index)) return { state: previous, error: 'Choix inconnu.' };
  const error = unavailableReason(previous, choice);
  if (error) return { state: previous, error };
  const state = structuredClone(previous);
  const before = { hp: state.hp, focus: state.focus, gold: state.gold };
  const roll = random(state);
  const success = roll < choice.chance;
  state.hp = clamp(state.hp + (success ? choice.hp : choice.failHp), MAX_HP);
  state.focus = clamp(state.focus - choice.cost + (success ? choice.focus : 1), MAX_FOCUS);
  state.gold = state.gold - choice.goldCost + (success ? choice.gold : 0);
  if (success && choice.item) state.inventory[choice.item]++;
  state.progress = Math.min(5, state.progress + (success ? choice.progress : 0));
  state.turn++;
  if (!state.hp) state.status = 'dead';
  state.lastResult = { success, text: '', changes: { hp: state.hp - before.hp, focus: state.focus - before.focus, gold: state.gold - before.gold }, item: success ? choice.item : null, roll: choice.chance < 1 ? Math.floor(roll * 100) + 1 : null };
  return { state, result: state.lastResult, choice };
}

export function applyNarration(pending, narration, metadata, previous = null, choice = null) {
  validateNarration(narration, pending);
  const state = structuredClone(pending);
  state.scene = { title: narration.title, text: narration.text, choices: narration.choices };
  state.quest = narration.quest;
  state.memory = narration.memory;
  state.region = narration.region;
  if (!state.visited.includes(state.region)) state.visited.push(state.region);
  state.generation = metadata;
  if (state.lastResult) state.lastResult.text = narration.consequence;
  if (narration.questCompleted) state.status = 'complete';
  if (previous && choice) {
    state.journal.push({ turn: state.turn, title: previous.scene.title, narrative: previous.scene.text, choice: choice.label, region: previous.region, ...state.lastResult });
    state.journal = state.journal.slice(-100);
  }
  return state;
}

export function continueJourney(previous) {
  if (previous.status !== 'complete') return previous;
  const state = structuredClone(previous);
  state.questNumber++; state.progress = 0; state.status = 'playing';
  state.quest = null; state.lastResult = null;
  state.hp = MAX_HP; state.focus = MAX_FOCUS; state.inventory.potion++; state.gold += 10;
  return state;
}

export function drinkPotion(previous) {
  if (!previous.scene || previous.status !== 'playing') return { state: previous, error: 'Aucune potion ne peut être utilisée maintenant.' };
  if (!previous.inventory.potion) return { state: previous, error: 'Vous n’avez plus de potion.' };
  if (previous.hp >= MAX_HP) return { state: previous, error: 'Votre vitalité est déjà au maximum.' };
  const state = structuredClone(previous); const heal = Math.min(7, MAX_HP - state.hp);
  state.hp += heal; state.inventory.potion--;
  return { state, heal };
}

export function restoreGame(raw) {
  try {
    const s = JSON.parse(raw);
    if (!s || s.version !== 2 || !int(s.seed, 1, 4294967295) || !int(s.hp, 0, MAX_HP) || !int(s.focus, 0, MAX_FOCUS)
        || !int(s.gold, 0, 1e9) || !int(s.turn, 0, 1e7) || !int(s.questNumber, 0, 1e6) || !int(s.progress, 0, 5)
        || !['playing', 'dead', 'complete'].includes(s.status) || !REGIONS.some(r => r.id === s.region)) return null;
    if ((s.status === 'playing' && s.hp === 0) || (s.status === 'dead' && s.hp !== 0)) return null;
    if (!s.inventory || !Object.keys(ITEMS).every(k => int(s.inventory[k], 0, 1e7))) return null;
    if (!Array.isArray(s.visited) || s.visited.length > 5 || !s.visited.every(id => REGIONS.some(r => r.id === id))) return null;
    if (!str(s.memory, 0, 6500) || !Array.isArray(s.journal) || s.journal.length > 100) return null;
    const validResult = r => r && typeof r.success === 'boolean' && str(r.text, 0, 1200) && r.changes && ['hp', 'focus', 'gold'].every(k => Number.isFinite(r.changes[k])) && [null, 'potion', 'fragment'].includes(r.item);
    if (!s.journal.every(e => int(e.turn, 1, 1e7) && str(e.title, 1, 100) && str(e.choice, 1, 110) && str(e.narrative, 1, 4000) && REGIONS.some(r => r.id === e.region) && validResult(e))) return null;
    if (s.lastResult !== null && !validResult(s.lastResult)) return null;
    if (s.quest !== null && (!str(s.quest?.title, 3, 100) || !str(s.quest?.description, 10, 350))) return null;
    if (s.generation !== null && (!s.generation || !str(s.generation.provider, 1, 30) || !str(s.generation.model, 1, 100) || !Number.isFinite(s.generation.durationMs) || !str(s.generation.requestId, 1, 100))) return null;
    if (s.scene !== null) {
      if (!str(s.scene?.title, 3, 100) || !str(s.scene?.text, 40, 4000) || !Array.isArray(s.scene?.choices) || !s.quest || !s.generation) return null;
      if (s.status === 'playing' ? s.scene.choices.length !== 3 || !s.scene.choices.every(validChoice) : s.scene.choices.length !== 0) return null;
    } else if (s.turn !== 0 || s.status !== 'playing') return null;
    return s;
  } catch { return null; }
}
