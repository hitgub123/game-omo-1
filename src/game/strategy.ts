/**
 * strategy.ts — AI 战术决策模块
 *
 * 负责：
 *   1. 立直判断 (shouldRiichi)
 *   2. 鸣牌判断 (shouldCall)
 *   3. 推/缩判断 (shouldFold / shouldPush)
 */

import type { Tile, GameState, Wind } from './types';
import { tileKey, isDragonTile, isMiddleTile, isTerminalHonor, isYakuhaiTile } from './tiles';
import { getTileCounts, tilesToHai } from './hand';
import { checkMahjongStatus } from '../../utils/syanten.js';
import { WINDS } from './types';
import type { DifficultyConfig } from './difficulty';
import { calculateDanger } from './defense';

// ── 1. 向听数 ──

/**
 * 计算手牌向听数
 * 返回 -1 = 已和牌, 0 = 听牌, 1+ = 一向听以上
 */
export function getShanten(hand: Tile[], _melds?: Tile[][]): number {
  const hai = tilesToHai(hand);
  const result = checkMahjongStatus(hai);
  if (typeof result === 'object') return 0;
  return result as number;
}

// ── 2. 立直判断 ──

export interface RiichiJudgment {
  should: boolean;
  reason: string;
}

export function shouldRiichi(
  hand: Tile[],
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig,
): RiichiJudgment {
  const hai = tilesToHai(hand);
  const result = checkMahjongStatus(hai);

  if (typeof result !== 'object' || !result.info) {
    return { should: false, reason: 'noten' };
  }

  let totalWaits = 0;
  const uniqueWaits = new Set<string>();
  for (const info of result.info) {
    for (const w of info.waits) {
      if (!uniqueWaits.has(w)) { uniqueWaits.add(w); totalWaits++; }
    }
  }

  if (totalWaits < config.riichiMinWaits) {
    return { should: false, reason: `waits ${totalWaits} < min ${config.riichiMinWaits}` };
  }

  if (Math.random() > config.riichiProbability) {
    return { should: false, reason: 'probability check failed' };
  }

  if (config.riichiRequireValue) {
    const hasDora = state.doraIndicators.some(di =>
      hand.some(t => t.suit === di.suit && t.value === (di.value === 9 ? 1 : di.value + 1))
    );
    const hasTanyao = hand.every(t => t.suit !== 'z' && !isTerminalHonor(t));
    const hasYakuhai = hasHonorTriplet(hand);

    if (!hasDora && !hasTanyao && !hasYakuhai && totalWaits <= 2) {
      return { should: false, reason: 'low hand value' };
    }
  }

  return { should: true, reason: 'ok' };
}

// ── 3. 鸣牌判断 ──

export type MeldAction = 'pon' | 'chi' | 'kan';

/**
 * 鸣牌后是否有役（简化判断：役牌刻子 or 断幺九）
 */
function hasYakuAfterMeld(
  hand: Tile[],
  discarded: Tile,
  meldType: MeldAction,
  state: GameState,
  playerWind: Wind,
): boolean {
  // 模拟鸣牌后的手牌
  const key = tileKey(discarded);
  let testHand: Tile[];
  if (meldType === 'pon') {
    testHand = removeTilesByKey(hand, key, 2);
  } else {
    testHand = removeTilesByKey(hand, key, 2);
  }
  if (testHand.length !== hand.length - 2) return false; // 牌不够？不可能

  // 1. 检查鸣牌后是否有役牌刻子（含本次鸣的牌）
  const counts = new Map<string, number>();
  for (const t of testHand) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
  // 本次鸣牌形成的刻子
  const meldCount = (counts.get(key) ?? 0) + 3; // 鸣的3张
  if (meldCount >= 3) {
    if (isYakuhaiTile(discarded, state.roundWind, playerWind)) return true;
  }
  // 手牌中已有的役牌刻子
  for (const [k, c] of counts) {
    if (c >= 3 && k[0] === 'z') {
      const val = parseInt(k.slice(1));
      const t = { id: -1, suit: 'z' as const, value: val };
      if (isYakuhaiTile(t, state.roundWind, playerWind)) return true;
    }
  }

  // 2. 检查是否为断幺九（全部中张牌 2-8）
  const allTiles = [...testHand, discarded, discarded, discarded]; // 鸣牌后手牌等效
  const isTanyao = allTiles.every(t =>
    t.suit !== 'z' && t.value >= 2 && t.value <= 8
  );
  if (isTanyao) return true;

  return false;
}

export function shouldCallMeld(
  hand: Tile[],
  discarded: Tile,
  meldType: MeldAction,
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig,
): boolean {
  const shantenBefore = getShanten(hand);

  if (meldType === 'pon') {
    // 先检查鸣牌后是否有役
    if (!hasYakuAfterMeld(hand, discarded, 'pon', state, playerWind)) {
      return false;
    }
    if (isDragonTile(discarded)) return Math.random() < config.callThresholdPon + 0.2;
    if (isMiddleTile(discarded)) {
      const testHand = removeTilesByKey(hand, tileKey(discarded), 2);
      if (testHand.length === hand.length - 2) {
        const shantenAfter = getShanten(testHand);
        if (shantenAfter < shantenBefore) return Math.random() < config.callThresholdPon;
      }
      return Math.random() < (config.callThresholdPon * 0.5);
    }
    if (isTerminalHonor(discarded)) {
      const testHand = removeTilesByKey(hand, tileKey(discarded), 2);
      if (testHand.length === hand.length - 2) {
        const shantenAfter = getShanten(testHand);
        if (shantenAfter <= shantenBefore) return Math.random() < config.callThresholdPon * 0.8;
      }
      return Math.random() < config.callThresholdPon * 0.4;
    }
    return Math.random() < config.callThresholdPon * 0.3;
  }

  if (meldType === 'chi') {
    // 先检查吃牌后是否有役
    if (!hasYakuAfterMeld(hand, discarded, 'chi', state, playerWind)) {
      return false;
    }
    const testHand = removeTilesByKey(hand, tileKey(discarded), 2);
    if (testHand.length === hand.length - 2) {
      const shantenAfter = getShanten(testHand);
      if (shantenAfter < shantenBefore) return Math.random() < config.callThresholdChi;
      if (shantenAfter === shantenBefore && state.players[playerWind].hasCalled) {
        return Math.random() < config.callThresholdChi * 0.5;
      }
    }
    return Math.random() < config.callThresholdChi * 0.2;
  }

  if (meldType === 'kan') {
    if (isDragonTile(discarded)) return Math.random() < config.callThresholdKan + 0.2;
    const testHand = hand.filter(t => !sameTileKey(t, discarded));
    const shantenAfter = getShanten(testHand);
    if (shantenAfter < shantenBefore) return Math.random() < config.callThresholdKan;
    return Math.random() < config.callThresholdKan * 0.3;
  }

  return false;
}

// ── 4. 推/缩判断 ──

export type PushFold = 'push' | 'fold' | 'ambiguous';

export function shouldPushOrFold(
  hand: Tile[],
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig,
): PushFold {
  if (!config.defenseEnabled) return 'push';

  let maxDanger = 0;
  for (const w of WINDS) {
    if (w === playerWind) continue;
    if (state.players[w].isRiichi) {
      const danger = calculateDanger(hand, state, playerWind, config);
      for (const [, d] of danger) {
        maxDanger = Math.max(maxDanger, d);
      }
    }
  }

  for (const w of WINDS) {
    if (w === playerWind) continue;
    if (state.players[w].melds.length >= 2) {
      maxDanger = Math.max(maxDanger, 0.4 + state.players[w].melds.length * 0.1);
    }
  }

  if (maxDanger >= config.foldThreshold) return 'fold';
  if (maxDanger >= config.foldThreshold * 0.7) return 'ambiguous';
  return 'push';
}

// ── 5. 暗杠判断 ──

export function shouldAnkan(hand: Tile[], config: DifficultyConfig): boolean {
  const counts = getTileCounts(hand);
  for (const c of Object.values(counts)) {
    if (c >= 4) {
      return Math.random() < (config.level === 'lunatic' ? 0.3 : 0.5);
    }
  }
  return false;
}

// ── 辅助 ──

function hasHonorTriplet(hand: Tile[]): boolean {
  const counts = new Map<string, number>();
  for (const t of hand) {
    const k = tileKey(t);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [key, count] of counts) {
    if (count >= 3 && key.startsWith('z')) return true;
  }
  return false;
}

function removeTilesByKey(hand: Tile[], key: string, count: number): Tile[] {
  const result = [...hand];
  let removed = 0;
  for (let i = result.length - 1; i >= 0 && removed < count; i--) {
    if (tileKey(result[i]) === key) {
      result.splice(i, 1);
      removed++;
    }
  }
  return result;
}

function sameTileKey(t: Tile, d: Tile): boolean {
  return t.suit === d.suit && t.value === d.value;
}
