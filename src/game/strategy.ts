/**
 * strategy.ts — AI 战术决策模块
 *
 * 负责：
 *   1. 立直判断 (shouldRiichi)
 *   2. 鸣牌判断 (shouldCall)
 *   3. 推/缩判断 (shouldFold / shouldPush)
 */

import type { Tile, GameState, Wind } from './types';
import { tileKey, isDragonTile, isMiddleTile, isTerminalHonor } from './tiles';
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
  // 使用 utils/syanten.js 引擎
  const hai = tilesToHai(hand);
  const result = checkMahjongStatus(hai);
  if (typeof result === 'object') return 0; // { status: 0, info: [...] } = 听牌
  return result as number; // -1 和牌, 0 听牌, 1+ 向听
}

// ── 2. 立直判断 ──

export interface RiichiJudgment {
  should: boolean;
  reason: string;
}

/**
 * 判断是否立直
 * 对比 aiDecideRiichi — 增加难度参数控制
 */
export function shouldRiichi(
  hand: Tile[],
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig,
): RiichiJudgment {
  // 检查是否能立直（手牌13张 = 未摸牌，用 syanten 判断听牌）
  const hai = tilesToHai(hand);
  const result = checkMahjongStatus(hai);

  // 不在听牌状态
  if (typeof result !== 'object' || !result.info) {
    return { should: false, reason: 'noten' };
  }

  // 检查待牌数
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

  // 概率判定
  if (Math.random() > config.riichiProbability) {
    return { should: false, reason: 'probability check failed' };
  }

  // Hard/Lunatic: 检查打点
  if (config.riichiRequireValue) {
    // 简单估算：有宝牌或断幺等高价值牌型才立直
    const hasDora = state.doraIndicators.some(di =>
      hand.some(t => t.suit === di.suit && t.value === (di.value === 9 ? 1 : di.value + 1))
    );
    const hasTanyao = hand.every(t => t.suit !== 'z' && !isTerminalHonor(t));
    const hasYakuhai = hasHonorTriplet(hand);

    if (!hasDora && !hasTanyao && !hasYakuhai && totalWaits <= 2) {
      // 低打点 + 少待牌 → 不立直
      return { should: false, reason: 'low hand value' };
    }
  }

  // Lunatic: 检查危险度（有人立直时缩）
  if (config.level === 'lunatic') {
    for (const w of WINDS) {
      if (w === playerWind) continue;
      if (state.players[w].isRiichi) {
        // 有人立直，检查安全弃牌
        const danger = calculateDanger(hand, state, playerWind, config);
        const safeCount = hand.filter(t => (danger.get(tileKey(t)) ?? 0.5) < 0.3).length;
        if (safeCount === 0) {
          return { should: false, reason: 'no safe discard (lunatic)' };
        }
      }
    }
  }

  return { should: true, reason: 'ok' };
}

// ── 3. 鸣牌判断 ──

export type MeldAction = 'pon' | 'chi' | 'kan';

/**
 * 判断是否鸣牌
 */
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
    // 东/南/西/北 + 自风/圈风翻倍判断
    if (isDragonTile(discarded)) return Math.random() < config.callThresholdPon + 0.2;
    if (isMiddleTile(discarded)) {
      // 鸣中张牌能否减少向听
      const testHand = removeTilesByKey(hand, tileKey(discarded), 2);
      if (testHand.length === hand.length - 2) {
        const shantenAfter = getShanten(testHand);
        if (shantenAfter < shantenBefore) return Math.random() < config.callThresholdPon;
      }
      return Math.random() < (config.callThresholdPon * 0.5);
    }
    // 幺九牌碰了役牌或减少向听
    if (isTerminalHonor(discarded)) {
      // 幺九牌碰了可能会破坏手牌形状
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
    // 吃牌一般只在能减少向听或不破坏好形时才做
    const testHand = removeTilesByKey(hand, tileKey(discarded), 2);
    if (testHand.length === hand.length - 2) {
      const shantenAfter = getShanten(testHand);
      // 减少向听 → 高概率
      if (shantenAfter < shantenBefore) return Math.random() < config.callThresholdChi;
      // 向听不变 → Low 概率（除非已经副露过）
      if (shantenAfter === shantenBefore && state.players[playerWind].hasCalled) {
        return Math.random() < config.callThresholdChi * 0.5;
      }
    }
    return Math.random() < config.callThresholdChi * 0.2;
  }

  if (meldType === 'kan') {
    // 大明杠：如果不是役牌或不减少向听，一般不杠
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

/**
 * 判断应该进攻还是防守
 */
export function shouldPushOrFold(
  hand: Tile[],
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig,
): PushFold {
  if (!config.defenseEnabled) return 'push';

  // 检查是否有对手立直
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

  // 对手副露较多 → 危险
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
  // 手牌中有4张一样的牌
  const counts = getTileCounts(hand);
  for (const c of Object.values(counts)) {
    if (c >= 4) {
      // 立直后暗杠要看是否改变听牌形状
      return Math.random() < (config.level === 'lunatic' ? 0.3 : 0.5);
    }
  }
  return false;
}

// ── 辅助 ──

/** 检查是否有役牌对子 */
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

/** 从手牌中移除指定 key 的 n 张牌 */
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

/** 比较 tileKey */
function sameTileKey(t: Tile, d: Tile): boolean {
  return t.suit === d.suit && t.value === d.value;
}
