/**
 * 手牌分析 — 基于 syanten 库（纯数字阵列，无字符串操作）
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

/** 手牌 → 数字阵列 [m1..m9, p1..p9, s1..s9, z1..z7] */
export function tilesToHai(tiles: Tile[]): number[][] {
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

// 快速判定：仅标准形（不查七对子/国士）
const syantenFast = (hai: number[][]) => (syantenLib as any).syanten(hai);
// 完整判定：标准形 + 七对子 + 国士
const syantenAll = (hai: number[][]) => (syantenLib as any).syantenAll(hai);

// ---- 兼容类型 ----
export interface Group { type: 'sequence'|'triplet'|'pair'; tileKey: string; suit?: TileSuit; value?: number }
export interface MahjongDivision { pair: Group; groups: Group[]; tileCounts: TileCount }
export interface TenpaiInfo { waitTiles: Tile[]; divisions: MahjongDivision[] }

// ---- isWinningHand ----
export function isWinningHand(tiles: Tile[], _melds: Meld[] = []): boolean {
  return syantenAll(tilesToHai(tiles)) === -1;
}

// ---- findMahjongDivisions ----
export function findMahjongDivisions(tiles: Tile[], _melds: Meld[] = []): MahjongDivision[] {
  return syantenAll(tilesToHai(tiles)) === -1
    ? [{ pair:{type:'pair',tileKey:''}, groups:[], tileCounts:{} }] : [];
}

// ---- checkTenpai (13 tiles) ----
export function checkTenpai(hand: Tile[], _melds: Meld[] = []): TenpaiInfo | null {
  if (hand.length !== 13) return null;
  const hai = tilesToHai(hand);
  if (syantenFast(hai) !== 0) return null;

  const waitTiles: Tile[] = [];
  const suits: TileSuit[] = ['m','p','s','z'];
  for (let si = 0; si < 4; si++) {
    const max = si < 3 ? 9 : 7;
    for (let v = 0; v < max; v++) {
      if (hai[si][v] >= 4) continue;
      hai[si][v]++;
      if (syantenFast(hai) === -1) waitTiles.push({ id: -1, suit: suits[si], value: v + 1 });
      hai[si][v]--;
    }
  }
  return waitTiles.length > 0 ? { waitTiles, divisions: [] } : null;
}

// ---- findTenpaiDiscards (14 tiles, 循环内纯数字阵列操作) ----
export function findTenpaiDiscards(hand: Tile[], _melds: Meld[] = []): Map<number, TenpaiInfo> {
  const result = new Map<number, TenpaiInfo>();
  if (hand.length < 14) return result;

  const hai = tilesToHai(hand);
  for (const t of hand) {
    const si = t.suit === 'm' ? 0 : t.suit === 'p' ? 1 : t.suit === 's' ? 2 : 3;
    hai[si][t.value - 1]--;
    if (syantenFast(hai) === 0) {
      // 听牌了：找等待牌（34 次内循环）
      const waitTiles: Tile[] = [];
      const suits: TileSuit[] = ['m','p','s','z'];
      for (let si2 = 0; si2 < 4; si2++) {
        const max = si2 < 3 ? 9 : 7;
        for (let v = 0; v < max; v++) {
          if (hai[si2][v] >= 4) continue;
          hai[si2][v]++;
          if (syantenFast(hai) === -1) waitTiles.push({ id: -1, suit: suits[si2], value: v + 1 });
          hai[si2][v]--;
        }
      }
      if (waitTiles.length > 0) result.set(t.id, { waitTiles, divisions: [] });
    }
    hai[si][t.value - 1]++;
  }
  return result;
}

// ---- Re-exports ----
export interface EvaluationResult { yaku: any[]; totalHan: number; fu: number; divisions: any[] }
export { riichiCheckWin as checkWin } from './riichi-check';
