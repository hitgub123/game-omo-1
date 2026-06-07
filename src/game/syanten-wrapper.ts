/**
 * syanten 库封装 — 向聴数 / 牌理計算
 * 替换手写的 checkTenpai / findTenpaiDiscards
 */
import syanten from 'syanten';
import type { Tile, TileSuit } from '../game/types';
import type { TenpaiInfo } from '../game/hand';
import { tileDisplayName } from './tiles';

// syanten 格式: [m1..m9], [p1..p9], [s1..s9], [z1..z7]
function tilesToHai(tiles: Tile[]): number[][] {
  const hai: number[][] = [
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ];
  for (const t of tiles) {
    const si = t.suit === 'm' ? 0 : t.suit === 'p' ? 1 : t.suit === 's' ? 2 : 3;
    hai[si][t.value - 1]++;
  }
  return hai;
}

function keyToTile(k: string): Tile {
  // k format: "1m", "9s", "7z" etc
  const suit = k[k.length - 1] as TileSuit;
  const value = parseInt(k.slice(0, -1));
  return { id: -1, suit, value };
}

/** 检查手牌向聴数（0=聴牌, -1=和了） */
export function syantenShanten(hand: Tile[]): number {
  const hai = tilesToHai(hand);
  return syanten.syanten(hai);
}

/** 获取 14 张手牌的牌理分析（每张牌打出后的等待牌） */
export function syantenHairi(hand: Tile[]): Map<string, Map<string, number>> {
  const hai = tilesToHai(hand);
  const result = syanten.hairi(hai);
  if (!result || result.now !== 0) return new Map();

  // result format: { "discardTile": { "waitTile": count, ... }, ... }
  // Keys are like "1m", "2p", "7z"
  const map = new Map<string, Map<string, number>>();
  for (const [discard, waits] of Object.entries(result)) {
    if (discard === 'now') continue;
    const waitMap = new Map<string, number>();
    for (const [w, count] of Object.entries(waits as object)) {
      waitMap.set(w, count as number);
    }
    map.set(discard, waitMap);
  }
  return map;
}

/** 用 syanten 检查聴牌 */
export function syantenCheckTenpai(hand: Tile[]): TenpaiInfo | null {
  if (hand.length !== 13) return null;
  const hai = tilesToHai(hand);
  const s = syanten.syanten(hai);
  if (s !== 0) return null;

  // 聴牌 → 遍历所有可能的等待牌
  const waitTiles: Tile[] = [];
  for (const suit of ['m','p','s','z'] as TileSuit[]) {
    const maxV = suit === 'z' ? 7 : 9;
    for (let v = 1; v <= maxV; v++) {
      const testTiles = [...hand, { id: -1, suit, value: v } as Tile];
      if (syanten.syanten(tilesToHai(testTiles)) === -1) {
        waitTiles.push({ id: -1, suit, value: v });
      }
    }
  }
  if (waitTiles.length === 0) return null;
  return { waitTiles, divisions: [] };
}

/** 用 syanten 找出 14 张手牌中打出后能聴牌的牌 */
export function syantenFindTenpaiDiscards(hand: Tile[]): Map<number, TenpaiInfo> {
  const result = new Map<number, TenpaiInfo>();
  for (let i = 0; i < hand.length; i++) {
    const remaining = [...hand.slice(0, i), ...hand.slice(i + 1)];
    if (remaining.length !== 13) continue;
    const tenpai = syantenCheckTenpai(remaining);
    if (tenpai) result.set(hand[i].id, tenpai);
  }
  return result;
}

/**
 * 立直选牌提示：对 14 张手牌，返回每张可打牌 → [等待牌显示名] 的映射
 */
export function syantenRiichiHints(hand: Tile[]): Map<number, string[]> {
  const result = new Map<number, string[]>();
  const hai = tilesToHai(hand);
  try {
    const hairiResult = syanten.hairi(hai);
    if (!hairiResult || hairiResult.now !== 0) return result;

    // Build a lookup from tile key to tile ID
    const tileIdByKey = new Map<string, number>();
    for (const t of hand) {
      tileIdByKey.set(`${t.value}${t.suit}`, t.id);
    }

    for (const [discard, waits] of Object.entries(hairiResult)) {
      if (discard === 'now') continue;
      const tileId = tileIdByKey.get(discard);
      if (tileId === undefined) continue;

      const waitNames: string[] = [];
      for (const w of Object.keys(waits as object)) {
        waitNames.push(tileDisplayName(keyToTile(w)));
      }
      if (waitNames.length > 0) result.set(tileId, waitNames);
    }
  } catch {}
  return result;
}
