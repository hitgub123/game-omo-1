/** Shared tile SVG pool — loaded at build time, zero runtime requests */
export const svgPool: Record<string, string> = import.meta.glob(
  '/src/assets/tiles/*.svg',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

export const SEASON_NAMES = ['chun', 'xia', 'qiu', 'dong', 'mei', 'lan', 'ju', 'zu'] as const;

/** Load a tile face SVG by key like "5m", "1z" etc. */
export function loadTileSvg(key: string): string {
  const path = Object.keys(svgPool).find(p => p.endsWith('/' + key + '.svg'));
  return path ? svgPool[path] : '';
}

/** Pick a random season SVG for this game's tile backs */
export function pickGameBackSvg(): string {
  const name = SEASON_NAMES[Math.floor(Math.random() * SEASON_NAMES.length)];
  const path = Object.keys(svgPool).find(p => p.endsWith('/' + name + '.svg'));
  return path ? svgPool[path] : '';
}

export function sanitizeSvg(raw: string): string {
  return raw.replace(/<\?xml[^>]*\?>/, '').trim();
}

// Stable cache: same suit+value → same {__html} object reference
const htmlCache = new Map<string, { __html: string }>();

/** Returns a stable {__html} object for dangerouslySetInnerHTML */
export function getTileInnerHtml(suit: string, value: number): { __html: string } {
  const key = `${value}${suit}`;
  let cached = htmlCache.get(key);
  if (!cached) {
    const raw = loadTileSvg(key);
    cached = { __html: sanitizeSvg(raw || '') };
    htmlCache.set(key, cached);
  }
  return cached;
}

/** Stable cached tile back SVG — set once per game */
let cachedBackSvg = '';

export function getCachedBackSvg(): string {
  if (!cachedBackSvg) {
    cachedBackSvg = pickGameBackSvg();
  }
  return cachedBackSvg;
}

export function resetBackSvgCache(): void {
  cachedBackSvg = '';
}
