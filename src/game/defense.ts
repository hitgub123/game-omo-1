/**
 * defense.ts — 麻将防守引擎
 *
 * 计算每张牌对不同对手的危险度。
 * 危险度 0.0 = 绝对安全, 1.0 = 极度危险。
 *
 * 算法：
 *   1. 現物 (Genbutsu) — 对手弃牌中的同种牌 = 安全 (0.0)
 *   2. 筋 (Suji) — 对手弃牌的 ±3 间隔牌 = 较低风险 (0.2~0.4)
 *   3. 壁 (Kabe) — 因已见4张而无法形成顺子的牌 = 安全 (0.0~0.1)
 *   4. 字牌安全度 — 未经副露的字牌 = 中低风险 (0.15~0.4)
 *   5. 副露危险 — 对手副露附近的牌 = 高风险 (0.5~0.9)
 *   6. 宝牌加成 — 现宝牌/里宝牌附近的牌更危险
 *   7. 巡目加成 — 晚巡所有牌更危险
 */

import type { Tile, GameState, Wind } from './types';
import { tileKey } from './tiles';
import { WINDS } from './types';
import type { DifficultyConfig } from './difficulty';

// ── 对外接口 ──

export interface DangerResult {
  /** 每张牌对每位对手的危险度 (0~1) */
  perOpponent: Map<Wind, Map<string, number>>;
  /** 综合危险度（取最大对手） */
  combined: Map<string, number>;
}

/**
 * 计算弃牌危险度
 * @param hand 我方手牌
 * @param state 当前牌局
 * @param myWind 我方风位
 * @param config 难度配置
 * @returns 每张牌（tileKey → 危险度 0~1）
 */
export function calculateDanger(
  hand: Tile[],
  state: GameState,
  myWind: Wind,
  config: DifficultyConfig,
): Map<string, number> {
  if (!config.defenseEnabled) {
    // Easy: 全部返回 0（无防守）
    const result = new Map<string, number>();
    for (const t of hand) result.set(tileKey(t), 0);
    return result;
  }

  const accuracy = config.defenseAccuracy;
  const combined = new Map<string, number>();

  // 对每位对手分别计算危险度
  for (const oppWind of WINDS) {
    if (oppWind === myWind) continue;
    const perTile = calculateDangerForOpponent(hand, state, myWind, oppWind);
    for (const [key, danger] of perTile) {
      const existing = combined.get(key) ?? 0;
      // 取最大值（最危险的对手）
      combined.set(key, Math.max(existing, danger * accuracy));
    }
  }

  return combined;
}

// ── 核心算法 ──

function calculateDangerForOpponent(
  hand: Tile[],
  state: GameState,
  _myWind: Wind,
  oppWind: Wind,
): Map<string, number> {
  const result = new Map<string, number>();
  const opp = state.players[oppWind];
  const turn = state.turn;

  // 收集对手的弃牌 key 集合
  const oppDiscardKeys = new Set(opp.discards.map(d => tileKey(d)));

  // 收集全局可见牌（所有弃牌 + 副露 + 宝牌指示）
  const visibleKeys = getVisibleKeys(state);
  const tileCounts = getVisibleTileCounts(state);

  for (const tile of hand) {
    const key = tileKey(tile);
    let danger = 0.5; // 默认中等危险

    // 1. 現物检查：对手弃过的牌 = 绝对安全
    if (oppDiscardKeys.has(key)) {
      danger = 0;
      result.set(key, danger);
      continue;
    }

    // 2. 立直后的筋牌检查
    if (opp.isRiichi) {
      const sujiBonus = getSujiDanger(tile, opp, visibleKeys);
      danger += sujiBonus; // 筋度越高减得越多
    }

    // 3. 壁牌检查
    const kabeBonus = getKabeDanger(tile, tileCounts);
    danger -= kabeBonus;

    // 4. 字牌安全度
    if (tile.suit === 'z') {
      danger = getHonorDanger(tile, opp, visibleKeys);
    }

    // 5. 副露危险
    const meldDanger = getMeldDanger(tile, opp, visibleKeys);
    danger = Math.max(danger, meldDanger);

    // 6. 宝牌加成
    if (isDoraRelated(tile, state)) {
      danger = Math.min(1, danger + 0.15);
    }

    // 7. 巡目加成（晚巡整体提风险）
    if (turn > 40) danger = Math.min(1, danger + 0.1);
    else if (turn > 30) danger = Math.min(1, danger + 0.05);

    // 8. 早外（序盘打过附近牌 → 稍安全）
    if (turn < 10 && opp.discards.length >= 3) {
      const earlySuji = getEarlyOutsideBonus(tile, opp);
      danger -= earlySuji;
    }

    result.set(key, clamp(danger, 0, 1));
  }

  return result;
}

// ── 辅助函数 ──

/** 获取全局可见牌（所有弃牌 + 副露） */
function getVisibleKeys(state: GameState): Set<string> {
  const keys = new Set<string>();
  for (const p of state.players) {
    for (const d of p.discards) keys.add(tileKey(d));
    for (const m of p.melds) {
      for (const t of m.tiles) keys.add(tileKey(t));
    }
  }
  for (const di of state.doraIndicators) keys.add(tileKey(di));
  return keys;
}

/** 获取每种牌的可见枚数（用于壁牌判定） */
function getVisibleTileCounts(state: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of state.players) {
    for (const d of p.discards) {
      const k = tileKey(d);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const m of p.melds) {
      for (const t of m.tiles) {
        const k = tileKey(t);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  for (const di of state.doraIndicators) {
    const k = tileKey(di);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** 筋牌危险度：对手的弃牌 ±3 间隔的牌风险较低 */
function getSujiDanger(tile: Tile, opp: GameState['players'][0], _visibleKeys: Set<string>): number {
  if (tile.suit === 'z') return 0;
  // 收集对手所有弃牌的筋牌
  for (const d of opp.discards) {
    if (d.suit !== tile.suit) continue;
    // 筋：对手打 4，则 1 和 7 是筋牌（3间隔）
    for (const offset of [-3, 3]) {
      const sujiVal = d.value + offset;
      if (sujiVal < 1 || sujiVal > 9) continue;
      if (sujiVal === tile.value && d.suit === tile.suit) {
        // 筋牌：风险降低
        return -0.25;
      }
    }
    // 半筋：对手打 4，则 2 和 8 是半筋（±2 间隔，不太安全但仍比随机安全）
    for (const offset of [-2, 2]) {
      const hanSujiVal = d.value + offset;
      if (hanSujiVal < 1 || hanSujiVal > 9) continue;
      if (hanSujiVal === tile.value && d.suit === tile.suit) {
        return -0.1;
      }
    }
  }
  return 0;
}

/** 壁牌危険度：隣接牌が4枚見え → その牌は相対的に安全 */
function getKabeDanger(tile: Tile, tileCounts: Map<string, number>): number {
  if (tile.suit === 'z') return 0;
  let safety = 0;
  for (const offset of [-1, 1]) {
    const nv = tile.value + offset;
    if (nv < 1 || nv > 9) continue;
    const nk = `${tile.suit}${nv}`;
    const count = tileCounts.get(nk) ?? 0;
    if (count >= 4) safety = Math.max(safety, 0.15);
    else if (count >= 3) safety = Math.max(safety, 0.05);
  }
  return safety;
}

/** 字牌危险度 */
function getHonorDanger(tile: Tile, opp: GameState['players'][0], _visibleKeys: Set<string>): number {
  if (tile.suit !== 'z') return 0.5;
  const val = tile.value;
  // 场风/自风牌 → 对手可能在做役牌
  // 简化处理：
  // 中发白 → 有人碰了就危险
  // 东西南北 → 看圈风和自风
  if (val >= 5 && val <= 7) {
    // 中发白 — 如果对手有副露或立直，危险性中等
    if (opp.melds.length > 0 || opp.isRiichi) return 0.35;
    return 0.2;
  }
  // 风牌 — 相对安全
  return 0.15;
}

/** 副露危险度：对手碰/吃的牌附近很危险 */
function getMeldDanger(tile: Tile, opp: GameState['players'][0], _visibleKeys: Set<string>): number {
  if (tile.suit === 'z') {
    // 字牌副露：对手碰了的字牌不能再打
    for (const m of opp.melds) {
      if (m.type === 'pon' || m.type === 'kan') {
        if (tileKey(m.tiles[0]) === tileKey(tile)) return 0.9;
      }
    }
    return 0;
  }

  for (const m of opp.melds) {
    if (m.tiles[0].suit !== tile.suit) continue;
    const meldVals = m.tiles.map(t => t.value);
    const minVal = Math.min(...meldVals);
    const maxVal = Math.max(...meldVals);
    const tv = tile.value;

    if (m.type === 'pon' || m.type === 'kan') {
      // 对手碰了 5m，打 5m = 极度危险
      if (meldVals[0] === tv) return 0.9;
      // 附近牌也危险（可能听嵌张/边张）
      if (Math.abs(meldVals[0] - tv) <= 1) return 0.5;
    }

    if (m.type === 'chi') {
      // 对手吃了 345m，打 2m/6m 较危险（延伸听牌）
      if (tv === minVal - 1 || tv === maxVal + 1) return 0.6;
      // 顺子内嵌张危险
      if (tv >= minVal && tv <= maxVal) return 0.7;
    }
  }
  return 0;
}

/** 宝牌关联牌更危险 */
function isDoraRelated(tile: Tile, state: GameState): boolean {
  for (const di of state.doraIndicators) {
    if (di.suit !== tile.suit) continue;
    // 宝牌指示牌 +1 就是宝牌
    const doraVal = di.value === 9 ? 1 : di.value + 1;
    if (tile.value === doraVal) return true;
    // 宝牌附近的牌也略微敏感
    if (Math.abs(tile.value - doraVal) <= 1) return true;
  }
  return false;
}

/** 早外：序盘对手打过附近的牌 → 稍安全 */
function getEarlyOutsideBonus(tile: Tile, opp: GameState['players'][0]): number {
  if (tile.suit === 'z') return 0;
  for (const d of opp.discards) {
    if (d.suit !== tile.suit) continue;
    if (Math.abs(d.value - tile.value) <= 1) return 0.1;
  }
  return 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
