'use client';

/**
 * Clean, consistent drawings for the lab equipment. They are used instead of photographs: a search for
 * "ice" or "container" returns whatever happens to be on Commons, while these always show the thing, in one
 * style, with no licence, no loading and no relevance problem.
 */

const STROKE = '#334155';

function Art({ id }: { id: string }) {
  switch (id) {
    case 'ice':
      return (
        <>
          <rect x="8" y="30" width="26" height="26" rx="4" fill="#bae6fd" stroke="#0284c7" strokeWidth="2" />
          <rect x="30" y="22" width="26" height="26" rx="4" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
          <path d="M13 36l7-3M36 28l7-3" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'container':
      return (
        <>
          <path d="M16 14h32l-4 40a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3z" fill="#e0f2fe" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M19 26h26" stroke="#7dd3fc" strokeWidth="2" />
          <path d="M22 18v26" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        </>
      );
    case 'location':
      return (
        <>
          <rect x="10" y="10" width="44" height="44" rx="4" fill="#f0f9ff" stroke={STROKE} strokeWidth="2.5" />
          <path d="M32 10v44M10 32h44" stroke={STROKE} strokeWidth="2" />
          <circle cx="21" cy="21" r="6" fill="#fbbf24" />
          <path d="M43 15v12M37 21h12M39 17l8 8M47 17l-8 8" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'lid':
      return (
        <>
          <ellipse cx="32" cy="38" rx="22" ry="8" fill="#94a3b8" stroke={STROKE} strokeWidth="2.5" />
          <path d="M26 32c0-6 12-6 12 0" fill="none" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'stopwatch':
      return (
        <>
          <rect x="28" y="6" width="8" height="6" rx="1" fill={STROKE} />
          <circle cx="32" cy="36" r="20" fill="#fff" stroke={STROKE} strokeWidth="3" />
          <path d="M32 36V23M32 36l9 5" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="36" r="2.5" fill={STROKE} />
        </>
      );
    case 'thermometer':
      return (
        <>
          <rect x="27" y="6" width="10" height="38" rx="5" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="32" cy="48" r="9" fill="#ef4444" stroke={STROKE} strokeWidth="2.5" />
          <rect x="30" y="22" width="4" height="26" fill="#ef4444" />
          <path d="M40 14h5M40 22h5M40 30h5" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'balance':
      return (
        <>
          <rect x="8" y="44" width="48" height="12" rx="3" fill="#cbd5e1" stroke={STROKE} strokeWidth="2.5" />
          <rect x="16" y="38" width="32" height="6" rx="2" fill="#94a3b8" stroke={STROKE} strokeWidth="2" />
          <rect x="22" y="48" width="20" height="5" rx="1.5" fill="#0f172a" />
          <text x="32" y="52.2" textAnchor="middle" fontSize="4.5" fill="#4ade80" fontFamily="monospace">0.0 g</text>
        </>
      );
    case 'magnet':
      return (
        <>
          <path d="M14 10h12v26a6 6 0 0 0 12 0V10h12v26a18 18 0 0 1-36 0z" fill="#dc2626" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="14" y="10" width="12" height="9" fill="#e2e8f0" stroke={STROKE} strokeWidth="2" />
          <rect x="38" y="10" width="12" height="9" fill="#e2e8f0" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 'torch':
      return (
        <>
          <rect x="10" y="26" width="30" height="14" rx="3" fill="#475569" stroke={STROKE} strokeWidth="2.5" />
          <path d="M40 24l12-6v28l-12-6z" fill="#fde68a" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M55 24l6-3M55 32h7M55 40l6 3" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'ruler':
      return (
        <>
          <rect x="6" y="22" width="52" height="20" rx="2" fill="#fde047" stroke={STROKE} strokeWidth="2.5" />
          <path d="M14 22v8M22 22v5M30 22v8M38 22v5M46 22v8" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 'sugar':
      return (
        <>
          <rect x="10" y="32" width="20" height="20" rx="3" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
          <rect x="34" y="32" width="20" height="20" rx="3" fill="#f8fafc" stroke={STROKE} strokeWidth="2.5" />
          <rect x="22" y="12" width="20" height="20" rx="3" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
          <path d="M26 17l6-2M14 38l5-2M38 38l6-2" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'water':
      return <path d="M32 8C22 24 14 31 14 41a18 18 0 0 0 36 0C50 31 42 24 32 8z" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="2.5" strokeLinejoin="round" />;
    case 'beaker':
      return (
        <>
          <path d="M14 10h36M17 10l3 44a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3l3-44" fill="#e0f2fe" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 30h24" fill="none" stroke="#7dd3fc" strokeWidth="2" />
          <path d="M20 26h6M20 36h6M20 46h6" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'spoon':
      return (
        <>
          <ellipse cx="32" cy="16" rx="9" ry="11" fill="#e2e8f0" stroke={STROKE} strokeWidth="2.5" />
          <path d="M32 27v31" stroke={STROKE} strokeWidth="5" strokeLinecap="round" />
          <path d="M32 27v31" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'cylinder':
      return (
        <>
          <path d="M22 8h20v42a2 2 0 0 1-2 2H24a2 2 0 0 1-2-2z" fill="#e0f2fe" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="16" y="52" width="32" height="6" rx="2" fill="#94a3b8" stroke={STROKE} strokeWidth="2" />
          <path d="M22 16h7M22 24h5M22 32h7M22 40h5" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
          <rect x="24" y="34" width="16" height="16" fill="#7dd3fc" opacity="0.7" />
        </>
      );
    case 'lens':
      return (
        <>
          <circle cx="26" cy="26" r="16" fill="#e0f2fe" stroke={STROKE} strokeWidth="3" />
          <path d="M38 38l18 18" stroke={STROKE} strokeWidth="6" strokeLinecap="round" />
          <path d="M18 22a10 10 0 0 1 8-8" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
    case 'plant':
      return (
        <>
          <path d="M32 56V30" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M32 40c-12 0-16-8-16-16 12 0 16 6 16 16z" fill="#4ade80" stroke="#166534" strokeWidth="2" strokeLinejoin="round" />
          <path d="M32 32c12 0 16-8 16-16-12 0-16 6-16 16z" fill="#86efac" stroke="#166534" strokeWidth="2" strokeLinejoin="round" />
        </>
      );
    case 'pot':
      return (
        <>
          <path d="M14 26h36l-5 28a3 3 0 0 1-3 2.5H22a3 3 0 0 1-3-2.5z" fill="#c2410c" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="11" y="20" width="42" height="9" rx="2" fill="#ea580c" stroke={STROKE} strokeWidth="2.5" />
        </>
      );
    case 'soil':
      return (
        <>
          <path d="M6 38c6-10 14-14 26-14s20 4 26 14v12H6z" fill="#78350f" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="22" cy="42" r="2.5" fill="#a16207" /><circle cx="36" cy="38" r="2.5" fill="#a16207" /><circle cx="44" cy="46" r="2.5" fill="#a16207" /><circle cx="28" cy="48" r="2" fill="#a16207" />
        </>
      );
    case 'seed':
      return (
        <>
          <ellipse cx="32" cy="34" rx="12" ry="17" fill="#d97706" stroke={STROKE} strokeWidth="2.5" transform="rotate(25 32 34)" />
          <path d="M26 24c4 2 8 6 10 12" stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      );
    case 'lamp':
      return (
        <>
          <path d="M20 8h24l8 22H12z" fill="#fde047" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="29" y="30" width="6" height="22" fill="#94a3b8" stroke={STROKE} strokeWidth="2" />
          <rect x="18" y="52" width="28" height="6" rx="2" fill="#64748b" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 'battery':
      return (
        <>
          <rect x="8" y="20" width="44" height="26" rx="4" fill="#fbbf24" stroke={STROKE} strokeWidth="2.5" />
          <rect x="52" y="28" width="6" height="10" rx="1.5" fill={STROKE} />
          <path d="M20 33h10M25 28v10M36 33h10" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'bulb':
      return (
        <>
          <path d="M32 6a16 16 0 0 0-9 29c2 2 3 4 3 7h12c0-3 1-5 3-7A16 16 0 0 0 32 6z" fill="#fef08a" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="25" y="42" width="14" height="10" rx="2" fill="#94a3b8" stroke={STROKE} strokeWidth="2" />
          <path d="M27 24l5 8 5-8" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'ball':
      return (
        <>
          <circle cx="32" cy="32" r="22" fill="#ef4444" stroke={STROKE} strokeWidth="2.5" />
          <path d="M18 24c4-6 10-8 16-8" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
        </>
      );
    case 'string':
      return (
        <>
          <path d="M8 22c10-14 18 14 28 0s14 8 20-4" stroke="#b45309" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M8 40c10-14 18 14 28 0s14 8 20-4" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      );
    case 'weight':
      return (
        <>
          <path d="M20 22h24l8 32H12z" fill="#64748b" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M26 22a6 6 0 0 1 12 0" stroke={STROKE} strokeWidth="3" fill="none" />
          <text x="32" y="46" textAnchor="middle" fontSize="11" fill="#fff" fontFamily="sans-serif" fontWeight="bold">100g</text>
        </>
      );
    case 'ramp':
      return (
        <>
          <path d="M6 52L56 52 56 18z" fill="#fcd34d" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M14 46L48 26" stroke="#b45309" strokeWidth="2" strokeDasharray="3 4" />
        </>
      );
    case 'car':
      return (
        <>
          <path d="M8 38l6-12h28l8 12" fill="#38bdf8" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="6" y="36" width="52" height="12" rx="3" fill="#0ea5e9" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="20" cy="50" r="6" fill="#1e293b" stroke="#fff" strokeWidth="2" />
          <circle cx="46" cy="50" r="6" fill="#1e293b" stroke="#fff" strokeWidth="2" />
        </>
      );
    case 'flask':
      return (
        <>
          <path d="M26 8h12M28 8v16L10 52a3 3 0 0 0 3 5h38a3 3 0 0 0 3-5L36 24V8" fill="#e0f2fe" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 42h30l5 10H12z" fill="#7dd3fc" opacity="0.8" />
        </>
      );
    case 'testtube':
      return (
        <>
          <path d="M24 8h16v38a8 8 0 0 1-16 0z" fill="#e0f2fe" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 30h16v16a8 8 0 0 1-16 0z" fill="#a78bfa" opacity="0.8" />
          <path d="M20 8h24" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'burner':
      return (
        <>
          <path d="M26 26h12l4 24H22z" fill="#94a3b8" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="16" y="50" width="32" height="7" rx="2" fill="#475569" stroke={STROKE} strokeWidth="2" />
          <path d="M32 6c6 8 8 12 4 18-2 2-6 2-8 0-4-6-2-10 4-18z" fill="#f97316" stroke="#c2410c" strokeWidth="2" strokeLinejoin="round" />
        </>
      );
    case 'nail':
      return (
        <>
          <rect x="22" y="8" width="20" height="6" rx="2" fill="#94a3b8" stroke={STROKE} strokeWidth="2" />
          <rect x="29" y="14" width="6" height="38" fill="#cbd5e1" stroke={STROKE} strokeWidth="2" />
          <path d="M29 52l3 8 3-8z" fill="#64748b" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      );
    case 'salt':
      return (
        <>
          <rect x="16" y="22" width="32" height="34" rx="5" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
          <path d="M20 22c0-8 24-8 24 0" fill="#cbd5e1" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="28" cy="14" r="1.5" fill={STROKE} /><circle cx="36" cy="14" r="1.5" fill={STROKE} /><circle cx="32" cy="10" r="1.5" fill={STROKE} />
          <path d="M24 36h16M24 44h16" stroke="#94a3b8" strokeWidth="2" />
        </>
      );
    case 'spring':
      return (
        <path d="M32 6v6l-14 4 28 6-28 6 28 6-28 6 28 6-14 4v6" fill="none" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      );
    default:
      return <rect x="12" y="12" width="40" height="40" rx="8" fill="#e2e8f0" stroke={STROKE} strokeWidth="2.5" />;
  }
}

export function ItemArt({ id, size, label }: { id: string; size: number; label?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0">
      <Art id={id} />
    </svg>
  );
}
