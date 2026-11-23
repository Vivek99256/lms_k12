/**
 * Every picture here is one that an ordinary Windows 10 machine can draw. Newer emoji (Unicode 13 and
 * later, such as the lung or the rock) show up as an empty box there, and joined emoji such as
 * "scientist" fall apart into two faces, so neither is used. The tests enforce this.
 *
 * Pictures for the things a student names in "Create Your Own Activity".
 *
 * When the student types "ball" or "biker" they should see a ball or a biker,
 * not a box. `suggestEmoji` turns the name they typed into a picture; when it
 * does not know the word it says so (null) and the student picks one themselves
 * or pastes any emoji. Nothing is sent anywhere: this is a plain lookup.
 */

const WORDS: Record<string, string> = {
  // sky, space, weather
  sun: '☀️', moon: '🌙', star: '⭐', earth: '🌍', world: '🌍', planet: '🪐', rocket: '🚀', satellite: '🛰️', orbit: '🪐', galaxy: '🌌',
  cloud: '☁️', rain: '🌧️', snow: '❄️', ice: '🧊', fire: '🔥', flame: '🔥', water: '💧', drop: '💧', wave: '🌊', sea: '🌊', ocean: '🌊',
  wind: '💨', air: '💨', smoke: '💨', storm: '⛈️', lightning: '⚡', electricity: '⚡', spark: '⚡', rainbow: '🌈', heat: '🔥', hot: '🔥', cold: '🥶',
  // lab and tools
  thermometer: '🌡️', temperature: '🌡️', microscope: '🔬', telescope: '🔭', beaker: '⚗️', flask: '⚗️', tube: '🧪', chemical: '🧪', experiment: '🧪', lab: '🧪',
  magnet: '🧲', battery: '🔋', bulb: '💡', lamp: '💡', light: '💡', idea: '💡', stopwatch: '⏱️', timer: '⏱️', clock: '⏱️', time: '⏱️', watch: '⌚',
  scale: '⚖️', balance: '⚖️', ruler: '📏', measure: '📏', hammer: '🔨', tool: '🛠️', gear: '⚙️', machine: '⚙️', engine: '⚙️', wheel: '⚙️',
  spring: '🌀', weight: '🏋️', lever: '⚖️', rope: '➰', ramp: '📐', slope: '📐', angle: '📐', camera: '📷', phone: '📱', computer: '💻', laptop: '💻',
  tv: '📺', speaker: '🔊', sound: '🔊', music: '🎵', key: '🔑', lock: '🔒', container: '🥫', cup: '🥛', glass: '🥛', bottle: '🍾', bucket: '🥫', jar: '🥫',
  // life
  plant: '🌱', seed: '🌱', sprout: '🌱', tree: '🌳', leaf: '🍃', flower: '🌸', fruit: '🍎', apple: '🍎', banana: '🍌', egg: '🥚', milk: '🥛', bread: '🍞',
  food: '🍽️', meal: '🍽️', salt: '🧂', sugar: '🍬', oil: '🛢️', fuel: '⛽', petrol: '⛽', gas: '⛽',
  cell: '🦠', bacteria: '🦠', virus: '🦠', microbe: '🦠', dna: '🧬', gene: '🧬', brain: '🧠', heart: '❤️', eye: '👁️', ear: '👂', nose: '👃', mouth: '👄',
  hand: '✋', bone: '🦴', lung: '💨', tooth: '🦷', muscle: '💪', blood: '🩸',
  dog: '🐶', cat: '🐱', bird: '🐦', fish: '🐟', butterfly: '🦋', insect: '🐛', bug: '🐛', bee: '🐝', cow: '🐄', elephant: '🐘', frog: '🐸', snake: '🐍', horse: '🐴',
  // people and movement
  person: '🧑', people: '🧑', human: '🧑', man: '👨', woman: '👩', boy: '👦', girl: '👧', child: '🧒', baby: '👶', student: '🧒', teacher: '👩',
  scientist: '🥼', doctor: '🩺', engineer: '👷', worker: '👷', biker: '🚴', cyclist: '🚴', rider: '🚴', runner: '🏃', swimmer: '🏊', walker: '🚶', player: '🏃',
  // transport and things
  car: '🚗', bus: '🚌', truck: '🚚', train: '🚆', plane: '✈️', airplane: '✈️', aeroplane: '✈️', ship: '🚢', boat: '⛵', bicycle: '🚲', bike: '🚲', cycle: '🚲', road: '🛣️',
  ball: '⚽', football: '⚽', basketball: '🏀', cricket: '🏏', bat: '🏏', balloon: '🎈', kite: '🪁', parachute: '🪂', arrow: '➡️',
  house: '🏠', home: '🏠', school: '🏫', building: '🏢', bridge: '🌉', tower: '🗼', book: '📖', pencil: '✏️', notebook: '📓', paper: '📄',
  // land
  mountain: '⛰️', hill: '⛰️', volcano: '🌋', desert: '🏜️', island: '🏝️', river: '🏞️', rock: '⛰️', stone: '⛰️', brick: '🧱', soil: '🟫', ground: '🟫', sand: '🏖️',
  // science process
  question: '❓', hypothesis: '❓', prediction: '🔮', data: '📊', graph: '📈', chart: '📊', table: '📋', result: '✅', conclusion: '✅', observation: '👀',
  observe: '👀', model: '🧩', variable: '🎚️', control: '🎚️', record: '📝', note: '📝', plan: '🗺️', problem: '❗',
};

/** Pictures a student can pick from without typing, roughly in the order a science class needs them. */
export const EMOJI_CHOICES: string[] = [
  '⚽', '🏀', '🚴', '🚲', '🚗', '✈️', '🚀', '🌍', '☀️', '🌙', '⭐', '☁️', '🌧️', '❄️', '🧊', '🔥', '💧', '🌊', '💨', '⚡',
  '🌡️', '🔬', '🔭', '⚗️', '🧪', '🧲', '🔋', '💡', '⏱️', '⚖️', '📏', '⚙️', '🔨', '🛠️', '🌱', '🌳', '🍃', '🌸', '🍎', '🥚',
  '🦠', '🧬', '🧠', '❤️', '👁️', '💨', '🦴', '🐶', '🐱', '🐦', '🐟', '🦋', '🧑', '👦', '👧', '🥼', '🏠', '🏫', '⛰️', '🧱',
  '❓', '📊', '📈', '📋', '✅', '👀', '🧩', '📝',
];

const singular = (w: string): string[] => {
  const out = [w];
  if (w.endsWith('ies') && w.length > 4) out.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('es') && w.length > 3) out.push(w.slice(0, -2));
  if (w.endsWith('s') && w.length > 3) out.push(w.slice(0, -1));
  if (w.endsWith('ing') && w.length > 5) out.push(w.slice(0, -3), `${w.slice(0, -3)}e`);
  return out;
};

/** A picture for what the student typed, or null when the word is not known. */
export function suggestEmoji(name: string): string | null {
  const words = name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  // The whole phrase first ("test tube"), then each word from the last (the noun) to the first.
  const phrase = words.join(' ');
  if (WORDS[phrase]) return WORDS[phrase];
  for (const w of [...words].reverse()) {
    for (const form of singular(w)) {
      if (WORDS[form]) return WORDS[form];
    }
  }
  return null;
}

/** True for what is plausibly one or a few emoji: short, and made of pictographs. */
export function looksLikeEmoji(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 16 && /^[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}⃣]+$/u.test(t);
}

/**
 * Pictures for names that start with what has been typed so far ("bi" gives bike, biker, bicycle), so the
 * student sees choices before the word is finished. At most `limit`, each picture once.
 */
export function suggestMany(typed: string, limit = 8): { word: string; emoji: string }[] {
  const last = typed.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean).pop() ?? '';
  if (last.length < 2) return [];
  const seen = new Set<string>();
  const out: { word: string; emoji: string }[] = [];
  for (const [word, emoji] of Object.entries(WORDS)) {
    if (!word.startsWith(last) || seen.has(emoji)) continue;
    seen.add(emoji);
    out.push({ word, emoji });
    if (out.length >= limit) break;
  }
  return out;
}

/** The picture can be drawn on an ordinary Windows 10: not newer than Emoji 12.0, and not a joined sequence. */
export function drawsOnOlderSystems(emoji: string): boolean {
  if (emoji.includes('\u200D')) return false;
  const newest = [[0x1fa70, 0x1fa7a], [0x1fa80, 0x1fa82], [0x1fa90, 0x1fa95]];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x1fa70 && !newest.some(([lo, hi]) => cp >= lo && cp <= hi)) return false;
  }
  return true;
}

/** Every picture the name lookup can return (for checks). */
export const SUGGESTED_PICTURES: string[] = [...new Set(Object.values(WORDS))];
