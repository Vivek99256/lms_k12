/**
 * Colour families, card styles and shapes for the colourful dashboard.
 *
 * Each accent is one hue used at fixed steps — a 50 tint (or a 50→white gradient) for
 * the outer box, white for the inner area, a 100/200 hairline, a 500→600 gradient icon
 * tile with a white glyph, and 700–950 ink for text — so every pairing keeps WCAG AA
 * contrast. Colour carries a section's identity; meaning (present/absent, collected/
 * outstanding) is always repeated in text.
 *
 * Class strings are written out in full because Tailwind only generates classes it
 * can see literally in the source.
 */
export type Accent = 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet' | 'teal' | 'orange';

export type AccentStyle = {
  /** Flat tinted outer box with hairline border. */
  card: string;
  /** Soft gradient outer box (tint fading to white). */
  cardGradient: string;
  /** Section header band. */
  band: string;
  /** Hairline border only (for white "bordered" cards). */
  border: string;
  /** 4px accent strip (top or left edge). */
  strip: string;
  /** Gradient icon tile with coloured soft shadow. */
  iconSolid: string;
  /** Soft icon tile for small/inline icons. */
  iconSoft: string;
  /** Title / label ink. */
  label: string;
  /** Headline figure ink. */
  value: string;
  /** Secondary ink on the tint. */
  muted: string;
  /** Inner chip (hint pill, legend chip). */
  chip: string;
  /** Interactive hover (tint + border + coloured shadow). */
  hover: string;
  /** Focus ring. */
  ring: string;
  /** Legend / status dot. */
  dot: string;
  /** Chart colours (hex — chart.js cannot read Tailwind classes). */
  chart: { bar: string; barLight: string; hover: string; grid: string; tick: string };
};

export const ACCENTS: Record<Accent, AccentStyle> = {
  indigo: {
    card: 'bg-indigo-50 border-indigo-200',
    cardGradient: 'bg-gradient-to-br from-indigo-50 via-white to-white border-indigo-200',
    band: 'bg-gradient-to-r from-indigo-50 to-white border-indigo-100',
    border: 'border-indigo-200',
    strip: 'bg-indigo-500',
    iconSolid: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25',
    iconSoft: 'bg-indigo-100 text-indigo-700',
    label: 'text-indigo-900',
    value: 'text-indigo-950',
    muted: 'text-indigo-700',
    chip: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
    hover: 'hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10',
    ring: 'focus-visible:ring-indigo-500/50',
    dot: 'bg-indigo-500',
    chart: { bar: '#4f46e5', barLight: '#a5b4fc', hover: '#3730a3', grid: '#e0e7ff', tick: '#4338ca' },
  },
  emerald: {
    card: 'bg-emerald-50 border-emerald-200',
    cardGradient: 'bg-gradient-to-br from-emerald-50 via-white to-white border-emerald-200',
    band: 'bg-gradient-to-r from-emerald-50 to-white border-emerald-100',
    border: 'border-emerald-200',
    strip: 'bg-emerald-500',
    iconSolid: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25',
    iconSoft: 'bg-emerald-100 text-emerald-700',
    label: 'text-emerald-900',
    value: 'text-emerald-950',
    muted: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    hover: 'hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10',
    ring: 'focus-visible:ring-emerald-500/50',
    dot: 'bg-emerald-500',
    chart: { bar: '#059669', barLight: '#6ee7b7', hover: '#065f46', grid: '#d1fae5', tick: '#047857' },
  },
  amber: {
    card: 'bg-amber-50 border-amber-200',
    cardGradient: 'bg-gradient-to-br from-amber-50 via-white to-white border-amber-200',
    band: 'bg-gradient-to-r from-amber-50 to-white border-amber-100',
    border: 'border-amber-200',
    strip: 'bg-amber-400',
    iconSolid: 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md shadow-amber-500/25',
    iconSoft: 'bg-amber-100 text-amber-800',
    label: 'text-amber-950',
    value: 'text-amber-950',
    muted: 'text-amber-800',
    chip: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
    hover: 'hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/10',
    ring: 'focus-visible:ring-amber-500/50',
    dot: 'bg-amber-400',
    chart: { bar: '#f59e0b', barLight: '#fcd34d', hover: '#b45309', grid: '#fef3c7', tick: '#92400e' },
  },
  sky: {
    card: 'bg-sky-50 border-sky-200',
    cardGradient: 'bg-gradient-to-br from-sky-50 via-white to-white border-sky-200',
    band: 'bg-gradient-to-r from-sky-50 to-white border-sky-100',
    border: 'border-sky-200',
    strip: 'bg-sky-500',
    iconSolid: 'bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/25',
    iconSoft: 'bg-sky-100 text-sky-700',
    label: 'text-sky-900',
    value: 'text-sky-950',
    muted: 'text-sky-700',
    chip: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
    hover: 'hover:border-sky-300 hover:shadow-lg hover:shadow-sky-500/10',
    ring: 'focus-visible:ring-sky-500/50',
    dot: 'bg-sky-500',
    chart: { bar: '#0284c7', barLight: '#7dd3fc', hover: '#075985', grid: '#e0f2fe', tick: '#0369a1' },
  },
  rose: {
    card: 'bg-rose-50 border-rose-200',
    cardGradient: 'bg-gradient-to-br from-rose-50 via-white to-white border-rose-200',
    band: 'bg-gradient-to-r from-rose-50 to-white border-rose-100',
    border: 'border-rose-200',
    strip: 'bg-rose-500',
    iconSolid: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/25',
    iconSoft: 'bg-rose-100 text-rose-700',
    label: 'text-rose-900',
    value: 'text-rose-950',
    muted: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
    hover: 'hover:border-rose-300 hover:shadow-lg hover:shadow-rose-500/10',
    ring: 'focus-visible:ring-rose-500/50',
    dot: 'bg-rose-500',
    chart: { bar: '#e11d48', barLight: '#fda4af', hover: '#9f1239', grid: '#ffe4e6', tick: '#be123c' },
  },
  violet: {
    card: 'bg-violet-50 border-violet-200',
    cardGradient: 'bg-gradient-to-br from-violet-50 via-white to-white border-violet-200',
    band: 'bg-gradient-to-r from-violet-50 to-white border-violet-100',
    border: 'border-violet-200',
    strip: 'bg-violet-500',
    iconSolid: 'bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/25',
    iconSoft: 'bg-violet-100 text-violet-700',
    label: 'text-violet-900',
    value: 'text-violet-950',
    muted: 'text-violet-700',
    chip: 'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
    hover: 'hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10',
    ring: 'focus-visible:ring-violet-500/50',
    dot: 'bg-violet-500',
    chart: { bar: '#7c3aed', barLight: '#c4b5fd', hover: '#5b21b6', grid: '#ede9fe', tick: '#6d28d9' },
  },
  teal: {
    card: 'bg-teal-50 border-teal-200',
    cardGradient: 'bg-gradient-to-br from-teal-50 via-white to-white border-teal-200',
    band: 'bg-gradient-to-r from-teal-50 to-white border-teal-100',
    border: 'border-teal-200',
    strip: 'bg-teal-500',
    iconSolid: 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/25',
    iconSoft: 'bg-teal-100 text-teal-700',
    label: 'text-teal-900',
    value: 'text-teal-950',
    muted: 'text-teal-700',
    chip: 'bg-teal-50 text-teal-800 ring-1 ring-teal-200',
    hover: 'hover:border-teal-300 hover:shadow-lg hover:shadow-teal-500/10',
    ring: 'focus-visible:ring-teal-500/50',
    dot: 'bg-teal-500',
    chart: { bar: '#0d9488', barLight: '#5eead4', hover: '#115e59', grid: '#ccfbf1', tick: '#0f766e' },
  },
  orange: {
    card: 'bg-orange-50 border-orange-200',
    cardGradient: 'bg-gradient-to-br from-orange-50 via-white to-white border-orange-200',
    band: 'bg-gradient-to-r from-orange-50 to-white border-orange-100',
    border: 'border-orange-200',
    strip: 'bg-orange-500',
    iconSolid: 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md shadow-orange-500/25',
    iconSoft: 'bg-orange-100 text-orange-800',
    label: 'text-orange-950',
    value: 'text-orange-950',
    muted: 'text-orange-800',
    chip: 'bg-orange-50 text-orange-900 ring-1 ring-orange-200',
    hover: 'hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10',
    ring: 'focus-visible:ring-orange-500/50',
    dot: 'bg-orange-500',
    chart: { bar: '#f97316', barLight: '#fdba74', hover: '#c2410c', grid: '#ffedd5', tick: '#9a3412' },
  },
};

/**
 * Section → colour. One place to read or change which part of the school owns which
 * hue, so a section looks the same on its card, its icon and its chart.
 */
export const SECTION_ACCENT = {
  students: 'indigo',
  staff: 'sky',
  attendance: 'emerald',
  fees: 'teal',
  admissions: 'orange',
  academics: 'violet',
  communication: 'rose',
  celebrations: 'amber',
} as const satisfies Record<string, Accent>;

/** Box silhouettes — mixed per widget so neighbouring boxes read as distinct shapes. */
export type BoxShape = 'soft' | 'leaf' | 'notch' | 'square' | 'round';

export const BOX_SHAPES: Record<BoxShape, string> = {
  soft: 'rounded-2xl',
  round: 'rounded-3xl',
  leaf: 'rounded-tl-3xl rounded-br-3xl rounded-tr-lg rounded-bl-lg',
  notch: 'rounded-tr-3xl rounded-bl-3xl rounded-tl-lg rounded-br-lg',
  square: 'rounded-lg',
};

/** Icon tile silhouettes. */
export type IconShape = 'circle' | 'squircle' | 'blob' | 'square';

export const ICON_SHAPES: Record<IconShape, string> = {
  circle: 'rounded-full',
  squircle: 'rounded-xl',
  blob: 'rounded-[42%_58%_55%_45%/48%_42%_58%_52%]',
  square: 'rounded-md',
};

/** Fixed rotation for lists whose items each need a colour (avatars). */
export const ACCENT_ORDER: Accent[] = ['indigo', 'emerald', 'amber', 'sky', 'rose', 'violet', 'teal', 'orange'];
export const ICON_SHAPE_ORDER: IconShape[] = ['squircle', 'circle', 'blob', 'square'];
