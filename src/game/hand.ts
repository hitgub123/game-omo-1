/**
 * 手牌分析 — 基于 syanten 库
 */
import syantenLib from 'syanten';
import type { Tile, TileSuit, Meld } from '../game/types';
import { tileKey } from '../game/tiles';

export type TileCount = Record<string, number>;

export function getTileCounts(tiles: Tile[]): TileCount {
  const counts: TileCount = {};
  for (const t of tiles) {
    const k = tileKey(t);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

const syanten = syantenLib.syantenAll;

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

// ---- Group / Division types (kept for backward compat) ----
export interface Group {
  type: 'sequence' | 'triplet' | 'pair';
  tileKey: string;
  suit?: TileSuit;
  value?: number;
}
export interface MahjongDivision {
  pair: Group;
  groups: Group[];
  tileCounts: TileCount;
}
export interface TenpaiInfo {
  waitTiles: Tile[];
  divisions: MahjongDivision[];
}

// ---- isWinningHand (14 tiles) ----
export function isWinningHand(tiles: Tile[], _melds: Meld[] = []): boolean {
  const hai = tilesToHai(tiles);
  return syanten(hai) === -1;
}

// ---- findMahjongDivisions (stub for backward compat) ----
export function findMahjongDivisions(tiles: Tile[], _melds: Meld[] = []): MahjongDivision[] {
  const hai = tilesToHai(tiles);
  return syanten(hai) === -1 ? [{ pair: { type:'pair' as const, tileKey:'' }, groups: [], tileCounts:{} }] : [];
}

// ---- checkTenpai (13 tiles, syanten=0) ----
export function checkTenpai(hand: Tile[], _melds: Meld[] = []): TenpaiInfo | null {
  if (hand.length !== 13) return null;
  const hai = tilesToHai(hand);
  if (syanten(hai) !== 0) return null;

  const waitTiles: Tile[] = [];
  for (let si = 0; si < 4; si++) {
    const suit = (['m','p','s','z'] as TileSuit[])[si];
    const max = si < 3 ? 9 : 7;
    for (let v = 0; v < max; v++) {
      if (hai[si][v] >= 4) continue;
      const test = hai.map(r => [...r]);
      test[si][v]++;
      if (syanten(test) === -1) {
        waitTiles.push({ id: -1, suit, value: v + 1 });
      }
    }
  }
  if (waitTiles.length === 0) return null;
  return { waitTiles, divisions: [] };
}

// ---- findTenpaiDiscards (14 tiles → which discard gives tenpai) ----
export function findTenpaiDiscards(hand: Tile[], _melds: Meld[] = []): Map<number, TenpaiInfo> {
  const result = new Map<number, TenpaiInfo>();
  for (let i = 0; i < hand.length; i++) {
    const remaining = [...hand.slice(0, i), ...hand.slice(i + 1)];
    if (remaining.length === 13) {
      const tenpai = checkTenpai(remaining);
      if (tenpai) result.set(hand[i].id, tenpai);
    }
  }
  return result;
}

// ---- Re-exports ----
export interface EvaluationResult {
  yaku: any[];
  totalHan: number;
  fu: number;
  divisions: any[];
}
export { riichiCheckWin as checkWin } from './riichi-check';
