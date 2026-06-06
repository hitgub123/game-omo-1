// ============================================================
// 牌的工具函数：生成、排序、判定、字符串化
// ============================================================

import { Tile, TileSuit, TOTAL_TILES, HAND_SIZE } from './types';

/** 生成一副完整的136张牌 */
export function createTileDeck(): Tile[] {
  const deck: Tile[] = [];
  let id = 0;
  const suits = [TileSuit.MAN, TileSuit.PIN, TileSuit.SOU];
  for (const suit of suits) {
    for (let val = 1; val <= 9; val++) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push({ id: id++, suit, value: val });
      }
    }
  }
  // 字牌
  for (let val = 1; val <= 7; val++) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ id: id++, suit: TileSuit.HONOR, value: val });
    }
  }
  return deck;
}

/** Fisher-Yates 洗牌 */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 牌的唯一键 "m1","p5","z3" 等 */
export function tileKey(t: Tile): string {
  return `${t.suit}${t.value}`;
}

/** 比较两张牌是否同种（忽略ID） */
export function sameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

/** 比较两张牌是否完全一致（含ID） */
export function tileEqual(a: Tile, b: Tile): boolean {
  return a.id === b.id;
}

/** 找出手牌中所有与给定牌相同的牌 */
export function findTiles(hand: Tile[], tile: Tile): Tile[] {
  return hand.filter(t => sameTile(t, tile));
}

/** 牌的顺序比较函数（用于排序） */
export function tileCompare(a: Tile, b: Tile): number {
  const suitOrder = [TileSuit.MAN, TileSuit.PIN, TileSuit.SOU, TileSuit.HONOR];
  const sa = suitOrder.indexOf(a.suit);
  const sb = suitOrder.indexOf(b.suit);
  if (sa !== sb) return sa - sb;
  if (a.value !== b.value) return a.value - b.value;
  return a.id - b.id;
}

/** 手牌排序 */
export function sortHand(hand: Tile[]): Tile[] {
  return [...hand].sort(tileCompare);
}

/** 将牌编码为适合hash的字符串（用于缓存等） */
export function handToCode(hand: Tile[]): string {
  const counts: Record<string, number> = {};
  for (const t of hand) {
    const k = tileKey(t);
    counts[k] = (counts[k] || 0) + 1;
  }
  const parts: string[] = [];
  const suits = [TileSuit.MAN, TileSuit.PIN, TileSuit.SOU, TileSuit.HONOR];
  for (const suit of suits) {
    const maxVal = suit === TileSuit.HONOR ? 7 : 9;
    for (let v = 1; v <= maxVal; v++) {
      const k = `${suit}${v}`;
      const c = counts[k] || 0;
      if (c > 0) parts.push(`${k}:${c}`);
    }
  }
  return parts.join(',');
}

/** 牌是否为幺九牌（1/9/字牌） */
export function isTerminalHonor(t: Tile): boolean {
  if (t.suit === TileSuit.HONOR) return true;
  return t.value === 1 || t.value === 9;
}

/** 牌是否为中张牌（2-8） */
export function isMiddleTile(t: Tile): boolean {
  if (t.suit === TileSuit.HONOR) return false;
  return t.value >= 2 && t.value <= 8;
}

/** 牌是否为数牌 */
export function isSuitedTile(t: Tile): boolean {
  return t.suit !== TileSuit.HONOR;
}

/** 牌是否为字牌 */
export function isHonorTile(t: Tile): boolean {
  return t.suit === TileSuit.HONOR;
}

/** 是否是三元牌（白发中） */
export function isDragonTile(t: Tile): boolean {
  return t.suit === TileSuit.HONOR && t.value >= 5;
}

/** 是否是役牌（场风/自风/三元牌） */
export function isYakuhaiTile(t: Tile, roundWind: number, seatWind: number): boolean {
  if (isDragonTile(t)) return true;
  // 场风
  if (t.suit === TileSuit.HONOR && t.value === roundWind + 1) return true;
  // 自风
  if (t.suit === TileSuit.HONOR && t.value === seatWind + 1) return true;
  return false;
}

/** 从手牌中移除指定牌 */
export function removeTile(hand: Tile[], tile: Tile): Tile[] {
  const idx = hand.findIndex(t => t.id === tile.id);
  if (idx === -1) return hand;
  const h = [...hand];
  h.splice(idx, 1);
  return h;
}

/** 从手牌中移除一组牌 */
export function removeTiles(hand: Tile[], tiles: Tile[]): Tile[] {
  let h = [...hand];
  for (const t of tiles) {
    h = removeTile(h, t);
  }
  return h;
}

/** 用牌名描述一个牌（如"三万"、"东"） */
export function tileDisplayName(t: Tile): string {
  const names: Record<string, string[]> = {
    m: ['一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬'],
    p: ['一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒'],
    s: ['一索','二索','三索','四索','五索','六索','七索','八索','九索'],
    z: ['東','南','西','北','白','發','中'],
  };
  return names[t.suit]?.[t.value - 1] ?? '?';
}

/** 用 HTML 渲染一张牌（装饰用 span） */
export function tileToHtml(t: Tile): string {
  const charMap: Record<string, Record<number, string>> = {
    m: { 1:'一萬',2:'二萬',3:'三萬',4:'四萬',5:'五萬',6:'六萬',7:'七萬',8:'八萬',9:'九萬' },
    p: { 1:'一筒',2:'二筒',3:'三筒',4:'四筒',5:'五筒',6:'六筒',7:'七筒',8:'八筒',9:'九筒' },
    s: { 1:'一索',2:'二索',3:'三索',4:'四索',5:'五索',6:'六索',7:'七索',8:'八索',9:'九索' },
    z: { 1:'東',2:'南',3:'西',4:'北',5:'白',6:'發',7:'中' },
  };
  const label = charMap[t.suit]?.[t.value] ?? '?';
  const suitClass = `tile-${t.suit}`;
  return `<span class="tile ${suitClass}">${label}</span>`;
}

/** 获取 tileKey 对应的中文显示名 */
export function tileKeyDisplayName(key: string): string {
  const suits: Record<string, string> = { m:'萬', p:'筒', s:'索' };
  const suit = key[0];
  const val = parseInt(key[1]);
  if (suit === 'z') {
    return ['東','南','西','北','白','發','中'][val - 1] || '?';
  }
  const numNames = ['一','二','三','四','五','六','七','八','九'];
  return numNames[val - 1] + suits[suit];
}
