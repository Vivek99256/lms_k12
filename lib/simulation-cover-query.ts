/**
 * Turns what a simulation (or its chapter / topic) is called into photo-search phrases, so a card with no cover of its own still gets a real
 * picture that fits its topic. Pure and deterministic: the same words always give the same phrases, which is what lets the CDN cache the
 * picture once per topic. Nothing here knows which simulations, chapters or topics exist - a new one works the moment it has a name.
 *
 * Order matters: the most specific phrase comes first and the generic subject/classroom phrases are the last resort.
 */

export interface CoverContext {
  title?: string | null
  subtitle?: string | null
  summary?: string | null
  category?: string | null
  tags?: readonly string[] | null
  /** The chapter or topic the card is shown under, when the page knows it. */
  chapter?: string | null
  subject?: string | null
}

/** A topic word (or words) and the photo phrases that picture it. First match wins the first phrase; later matches add more. */
const CONCEPTS: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  // physics
  [/\bpendul/, ['pendulum swinging', 'pendulum clock']],
  [/\b(projectile|trajectory|cannon|parabol)/, ['cannon ball', 'archery arrow flight']],
  [/\b(ramp|incline|slope|plank)/, ['ball rolling ramp', 'wooden ramp']],
  [/\b(retina|eye|vision|lens|sight)\b/, ['human eye close up', 'eye iris macro']],
  [/\b(friction|brake)/, ['brake disc friction', 'rubbing hands friction']],
  [/\b(force|push|pull|newton|inertia)/, ['tug of war rope team', 'pushing force']],
  [/\b(motion|velocity|speed|acceleration|distance|displacement)/, ['sprinter track start', 'car speed road']],
  [/\b(sound|wave|vibrat|echo|pitch|acoustic)/, ['water drop ripple', 'sound wave speaker']],
  [/\b(light|reflect|refract|prism|optic|mirror|spectrum|rainbow)/, ['prism light spectrum', 'light beam rainbow']],
  [/\b(circuit|current|electric|voltage|battery|resist)/, ['electronic circuit board', 'light bulb glowing']],
  [/\bmagnet/, ['magnet iron filings', 'horseshoe magnet']],
  [/\b(heat|temperature|thermal|thermomet)/, ['thermometer heat', 'hot metal glowing']],
  [/\b(combustion|flame|fire|burn)/, ['candle flame close up', 'bonfire flame']],
  [/\b(energy|work|lever|pulley|machine|gear)/, ['simple machine gears', 'lever pulley']],
  [/\b(gravity|orbit|planet|solar system|star|galaxy|astronom)/, ['solar system planets', 'night sky stars']],
  [/\b(pressure|fluid|buoyan|float)/, ['water pressure bubbles', 'ship floating water']],
  // chemistry
  [/\b(acid|base|alkali|indicator|ph\b)/, ['chemistry beakers colour', 'litmus paper chemistry']],
  [/\b(atom|molecule|element|periodic|matter|particle)/, ['chemistry laboratory glassware', 'science molecule model']],
  [/\b(mixture|separat|filtrat|solution|distill)/, ['filtration laboratory', 'beaker solution']],
  [/\b(metal|non-metal|corrosion|rust)/, ['metal iron industrial', 'copper metal']],
  [/\b(coal|petroleum|fuel|oil)/, ['coal mine', 'oil refinery']],
  [/\b(plastic|fibre|fiber|polymer|synthetic)/, ['plastic bottles recycling', 'colourful fabric fibres']],
  [/\b(pollution|environment|waste|conservation)/, ['environment nature protection', 'recycling green earth']],
  // biology
  [/\b(cell|tissue|microscop|organelle)/, ['microscope laboratory', 'biology microscope slide']],
  [/\b(photosynth|leaf|leaves|plant|botan|chlorophyll)/, ['green leaf sunlight', 'plant leaves close up']],
  [/\b(reproduc|flower|pollinat|seed|germinat)/, ['flower pollination bee', 'seedling sprouting soil']],
  [/\b(microorganism|bacteria|virus|germ|fung)/, ['petri dish bacteria', 'microbiology laboratory']],
  [/\b(digest|nutrition|food|diet|health)/, ['healthy food vegetables fruit', 'balanced diet meal']],
  [/\b(heart|blood|circulat|respirat|breath|lung|body|organ|adolescen)/, ['human anatomy model', 'stethoscope doctor']],
  [/\b(animal|wildlife|biodivers|species|classif)/, ['wildlife animals nature', 'forest animals']],
  [/\b(ecosystem|habitat|forest)/, ['forest ecosystem green', 'jungle canopy']],
  // earth, geography, social science
  [/\b(atmosphere|climate|weather|cloud|rain|monsoon)/, ['clouds sky', 'rain storm weather']],
  [/\b(earthquake|volcan|plate|rock|erosion|landform|mountain|surface)/, ['rock layers landscape', 'mountain landscape']],
  [/\b(soil|land use)/, ['soil earth hands', 'farm soil']],
  [/\b(river|water|ocean|sea|lake|drainage)/, ['river water flowing', 'ocean waves']],
  [/\b(agricultur|crop|farm|irrigat|harvest)/, ['farm field harvest', 'wheat field']],
  [/\b(industr|factory|manufactur)/, ['factory industry', 'industrial plant']],
  [/\b(resource|mineral|mining)/, ['natural resources landscape', 'mine minerals']],
  [/\b(map|latitude|longitude|globe|geograph|continent)/, ['world map globe', 'atlas map']],
  [/\b(democra|election|vote|parliament|constitution|government|citizen)/, ['voting ballot election', 'parliament building']],
  [/\b(econom|market|price|trade|money|demand|supply|choice)/, ['market stalls shopping', 'coins money economy']],
  [/\b(history|ancient|empire|colonial|medieval|civilis|civiliz|revolt|rebel|freedom|national movement)/, ['historic fort architecture', 'old manuscript book']],
  [/\b(human resource|population|people|society|culture)/, ['crowd people city', 'community people together']],
  // maths
  [/\b(fraction|ratio|proportion|percent|decimal)/, ['pizza slices fractions', 'measuring cups']],
  [/\b(geometry|triangle|angle|circle|polygon|quadrilateral|shape|symmetry|construction)/, ['geometry compass ruler', 'geometric shapes']],
  [/\b(algebra|equation|variable|expression|polynomial|linear|quadratic)/, ['chalkboard mathematics equations', 'balance scale weights']],
  [/\b(integer|number|multiple|factor|prime|divisib|cube|square root)/, ['numbers abacus', 'colourful numbers blocks']],
  [/\b(statistic|data|graph|chart|mean|median|average)/, ['bar chart graph', 'data analysis charts']],
  [/\b(probabil|chance|dice|random)/, ['dice game', 'playing cards chance']],
  [/\b(area|perimeter|volume|mensuration|surface area)/, ['floor tiles pattern', 'measuring tape ruler']],
  // languages
  [/\b(poem|poetry|story|prose|literature|reading|novel|chapter)/, ['open book reading', 'library books']],
  [/\b(grammar|writing|essay|letter|vocabulary|sentence)/, ['writing pencil notebook', 'fountain pen paper']],
]

/** Last-resort phrases by school subject, so even an unrecognised topic gets a fitting picture rather than none. */
const SUBJECTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(physic)/, 'physics laboratory experiment'],
  [/(chemi)/, 'chemistry laboratory'],
  [/(biolog|life science)/, 'biology nature'],
  [/(science)/, 'science laboratory experiment'],
  [/(math)/, 'mathematics classroom blackboard'],
  [/(geograph)/, 'world map globe'],
  [/(histor)/, 'ancient monument architecture'],
  [/(civic|polity|political|social)/, 'community people learning'],
  [/(econom)/, 'market economy'],
  [/(english|hindi|language|literature|sanskrit)/, 'open book reading'],
  [/(computer|coding|technolog)/, 'computer coding screen'],
]

const DEFAULT_QUERY = 'school classroom learning'
const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'to', 'for', 'with', 'how', 'what', 'why', 'is', 'are', 'from', 'into', 'about', 'lab',
  'simulation', 'activity', 'experiment', 'introduction', 'understanding', 'exploring', 'chapter', 'around', 'us', 'our', 'basic', 'basics',
])
const MAX_QUERY_CHARS = 80
const MAX_TEXT_CHARS = 400

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS) : ''
}

function addUnique(list: string[], phrase: string): void {
  const q = phrase.trim().toLowerCase().slice(0, MAX_QUERY_CHARS)
  if (q && !list.includes(q)) list.push(q)
}

/** The plain content words of a name, for when no known topic word matched. */
function contentWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 3)
    .join(' ')
}

/**
 * The photo phrases to try, best first (at most 6). The name of the thing itself is read before its chapter, and the chapter before the
 * subject, so a "Pendulum Lab" in a "Motion" chapter is pictured as a pendulum, not as motion.
 */
export function buildCoverQueries(ctx: CoverContext): string[] {
  const own = [clean(ctx.title), clean(ctx.subtitle), ...(ctx.tags ?? []).map(clean)].filter(Boolean)
  const wider = [clean(ctx.summary), clean(ctx.category), clean(ctx.chapter)].filter(Boolean)
  const subject = clean(ctx.subject).toLowerCase() || `${clean(ctx.category)} ${clean(ctx.chapter)}`.toLowerCase()

  const out: string[] = []
  for (const group of [own, wider]) {
    for (const text of group) {
      const lower = text.toLowerCase()
      for (const [pattern, phrases] of CONCEPTS) {
        if (pattern.test(lower)) {
          for (const p of phrases) addUnique(out, p)
          if (out.length >= 4) break
        }
      }
      if (out.length >= 4) break
    }
    if (out.length >= 2) break
  }

  const plain = contentWords(clean(ctx.title)) || contentWords(clean(ctx.chapter))
  if (plain) addUnique(out, plain)
  for (const [pattern, phrase] of SUBJECTS) {
    if (pattern.test(subject)) {
      addUnique(out, phrase)
      break
    }
  }
  addUnique(out, DEFAULT_QUERY)
  return out.slice(0, 6)
}

/** The query string the cover route reads. Only what a picture can depend on is sent, so equal topics share one cached picture. */
export function coverRouteUrl(ctx: CoverContext): string {
  const params = new URLSearchParams()
  const set = (key: string, value: string | null | undefined) => {
    const v = clean(value)
    if (v) params.set(key, v.slice(0, 160))
  }
  set('t', ctx.title)
  set('s', ctx.subtitle)
  set('c', ctx.category)
  set('ch', ctx.chapter)
  set('su', ctx.subject)
  const tags = (ctx.tags ?? []).map(clean).filter(Boolean).slice(0, 6).join(',')
  set('g', tags)
  params.sort()
  return `/api/sim-cover?${params.toString()}`
}

/** Reads the route's query string back into a context. Anything missing or over-long is dropped. */
export function readCoverParams(search: URLSearchParams): CoverContext {
  const get = (key: string) => clean(search.get(key)?.slice(0, 160))
  const tags = get('g').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6)
  return { title: get('t'), subtitle: get('s'), category: get('c'), chapter: get('ch'), subject: get('su'), tags }
}
