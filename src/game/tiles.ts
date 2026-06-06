import type { Tile, TileSuit } from './types';

export function createTileDeck(): Tile[] {
  const deck: Tile[] = [];
  let id = 0;
  const suits: TileSuit[] = ['m', 'p', 's'];
  for (const suit of suits) {
    for (let val = 1; val <= 9; val++) {
      for (let c = 0; c < 4; c++) {
        deck.push({ id: id++, suit, value: val });
      }
    }
  }
  for (let val = 1; val <= 7; val++) {
    for (let c = 0; c < 4; c++) {
      deck.push({ id: id++, suit: 'z' as TileSuit, value: val });
    }
  }
  return deck;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function tileKey(t: Tile): string {
  return `${t.suit}${t.value}`;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

export function findTiles(hand: Tile[], tile: Tile): Tile[] {
  return hand.filter(t => sameTile(t, tile));
}

export function tileCompare(a: Tile, b: Tile): number {
  const suitOrder: TileSuit[] = ['m', 'p', 's', 'z'];
  const sa = suitOrder.indexOf(a.suit);
  const sb = suitOrder.indexOf(b.suit);
  if (sa !== sb) return sa - sb;
  if (a.value !== b.value) return a.value - b.value;
  return a.id - b.id;
}

export function sortHand(hand: Tile[]): Tile[] {
  return [...hand].sort(tileCompare);
}

export function isTerminalHonor(t: Tile): boolean {
  if (t.suit === 'z') return true;
  return t.value === 1 || t.value === 9;
}

export function isMiddleTile(t: Tile): boolean {
  if (t.suit === 'z') return false;
  return t.value >= 2 && t.value <= 8;
}

export function isDragonTile(t: Tile): boolean {
  return t.suit === 'z' && t.value >= 5;
}

export function isYakuhaiTile(t: Tile, roundWind: number, seatWind: number): boolean {
  if (isDragonTile(t)) return true;
  if (t.suit === 'z' && t.value === roundWind + 1) return true;
  if (t.suit === 'z' && t.value === seatWind + 1) return true;
  return false;
}

export function removeTile(hand: Tile[], tile: Tile): Tile[] {
  const idx = hand.findIndex(t => t.id === tile.id);
  if (idx === -1) return hand;
  const h = [...hand];
  h.splice(idx, 1);
  return h;
}

export function removeTiles(hand: Tile[], tiles: Tile[]): Tile[] {
  let h = [...hand];
  for (const t of tiles) h = removeTile(h, t);
  return h;
}

export function tileDisplayName(t: Tile): string {
  const names: Record<string, string[]> = {
    m: ['一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬'],
    p: ['一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒'],
    s: ['一索','二索','三索','四索','五索','六索','七索','八索','九索'],
    z: ['東','南','西','北','白','發','中'],
  };
  return names[t.suit]?.[t.value - 1] ?? '?';
}

export function tileKeyDisplayName(key: string): string {
  const suit = key[0];
  const val = parseInt(key[1]);
  if (suit === 'z') {
    return ['東','南','西','北','白','發','中'][val - 1] || '?';
  }
  const numNames = ['一','二','三','四','五','六','七','八','九'];
  const suits: Record<string, string> = { m:'萬', p:'筒', s:'索' };
  return numNames[val - 1] + suits[suit];
}
