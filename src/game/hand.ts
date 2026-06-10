/**
 * 手牌分析 — 基于 utils/syanten.js（工业级回溯引擎）
 */
import { checkMahjongStatus } from '../../utils/syanten.js';
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

/** 手牌 → 4行2D阵列 */
export function tilesToHai(tiles: Tile[]): number[][] {
  const hai: number[][] = [ [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0] ];
  for (const t of tiles) {
    const si = t.suit==='m'?0:t.suit==='p'?1:t.suit==='s'?2:3;
    hai[si][t.value-1]++;
  }
  return hai;
}

function keyToTile(k: string): Tile {
  const suit = k.slice(-1) as TileSuit;
  return { id: -1, suit, value: parseInt(k.slice(0, -1)) };
}

// ---- 兼容类型 ----
export interface Group { type:'sequence'|'triplet'|'pair'; tileKey:string; suit?:TileSuit; value?:number }
export interface MahjongDivision { pair:Group; groups:Group[]; tileCounts:TileCount }
export interface TenpaiInfo { waitTiles: Tile[]; divisions: MahjongDivision[] }

// ---- isWinningHand ----
export function isWinningHand(tiles: Tile[], _melds: Meld[] = []): boolean {
  return checkMahjongStatus(tilesToHai(tiles)) === -1;
}

// ---- findMahjongDivisions ----
export function findMahjongDivisions(tiles: Tile[], _melds: Meld[] = []): MahjongDivision[] {
  return isWinningHand(tiles) ? [{ pair:{type:'pair',tileKey:''}, groups:[], tileCounts:{} }] : [];
}

// ---- checkTenpai (supports melded hands: 13/10/7/4/1 tiles) ----
export function checkTenpai(hand: Tile[], _melds: Meld[] = []): TenpaiInfo | null {
  // Melds reduce hand size: expected = 13 - 3 * meldCount
  const meldGroups = _melds.length;
  const expected = 13 - meldGroups * 3;
  if (hand.length !== expected) return null;
  const result = checkMahjongStatus(tilesToHai(hand));
  if (typeof result === 'object' && result.status === 0) {
    const waits = result.info?.[0]?.waits || [];
    return { waitTiles: waits.map((k: string) => keyToTile(k)), divisions: [] };
  }
  return null;
}

// ---- findTenpaiDiscards (14 tiles) ----
export function findTenpaiDiscards(hand: Tile[], _melds: Meld[] = []): Map<number, TenpaiInfo> {
  const result = new Map<number, TenpaiInfo>();
  const engResult = checkMahjongStatus(tilesToHai(hand));
  if (typeof engResult !== 'object' || engResult.status !== 0) return result;

  for (const sol of engResult.info || []) {
    if (sol.discard === 'none') continue;
    const tile = hand.find(t => {
      const k = `${t.value}${t.suit}`;
      return k === sol.discard;
    });
    if (!tile || result.has(tile.id)) continue;
    result.set(tile.id, {
      waitTiles: (sol.waits || []).map((k: string) => keyToTile(k)),
      divisions: [],
    });
  }
  return result;
}

// ---- Re-exports ----
export interface EvaluationResult { yaku: any[]; totalHan: number; fu: number; divisions: any[] }
export { riichiCheckWin as checkWin } from './riichi-check';
export { canWinBySyanten } from './riichi-check';
