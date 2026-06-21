/**
 * ai.ts — AI 决策主入口
 *
 * 整合防守、进攻、策略三大模块，接收 DifficultyConfig 控制难度。
 * P0: 弃牌以向听数为首要标准，次优才看评分。
 */

import type { Tile, GameState, Wind } from './types';
import { tileKey, isTerminalHonor, isMiddleTile, isDragonTile, isYakuhaiTile } from './tiles';
import { tilesToHai } from './hand';
import { checkMahjongStatus } from '../../utils/syanten.js';

import type { DifficultyConfig } from './difficulty';
import { DIFFICULTY_NORMAL } from './difficulty';
import { calculateDanger } from './defense';
import {
  shouldRiichi,
  shouldCallMeld,
  shouldPushOrFold,
  shouldAnkan,
  getShanten,
} from './strategy';

// ── 1. 弃牌 ──

/**
 * AI 选择弃牌
 * @param hand 手牌
 * @param _melds 副露（未使用，保留签名兼容）
 * @param state 牌局
 * @param playerWind 玩家风位
 * @param config 难度配置（默认 Normal）
 */
export function aiChooseDiscard(
  hand: Tile[],
  _melds: any,
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig = DIFFICULTY_NORMAL,
): Tile {
  // Easy: 随机弃牌
  if (config.randomDiscardChance > 0 && Math.random() < config.randomDiscardChance) {
    return hand[Math.floor(Math.random() * hand.length)];
  }

  // 计算危险度（防守）
  const dangerMap = calculateDanger(hand, state, playerWind, config);

  // 推/缩判断
  const pushFold = shouldPushOrFold(hand, state, playerWind, config);

  // 对每张牌算三个值：打出后的向听数 + 进攻评分 + 待牌剩余枚数
  const scored = hand.map(t => {
    const remaining = hand.filter(h => h.id !== t.id);
    const shanten = getShanten(remaining);
    let offense = scoreDiscardTile(t, hand, state, playerWind, config);
    const danger = dangerMap.get(tileKey(t)) ?? 0;

    // 听牌时：计算待牌总剩余枚数，剩余越多越该保留此弃牌路径
    if (shanten === 0) {
      const hai = tilesToHai(remaining);
      const tenpaiResult = checkMahjongStatus(hai);
      if (typeof tenpaiResult === 'object' && tenpaiResult.info) {
        const uniqueWaits = new Set<string>();
        for (const sol of tenpaiResult.info) {
          for (const w of sol.waits) uniqueWaits.add(w);
        }
        // 统计每张待牌的可见枚数
        let totalRemain = 0;
        for (const w of uniqueWaits) {
          const suit = w.slice(-1) as import('./types').TileSuit;
          const val = parseInt(w.slice(0, -1));
          let visible = 0;
          for (const p of state.players) {
            for (const d of p.discards) if (d.suit === suit && d.value === val) visible++;
            for (const m of p.melds) for (const mt of m.tiles) if (mt.suit === suit && mt.value === val) visible++;
          }
          for (const di of state.doraIndicators) if (di.suit === suit && di.value === val) visible++;
          // 自己手牌中的该牌也算可见
          const inHand = hand.filter(h => h.suit === suit && h.value === val).length;
          visible += inHand;
          totalRemain += Math.max(0, 4 - visible);
        }
        // 剩余枚数越多越优先（×3 让枚数差影响大于牌自身分差）
        offense += totalRemain * 5;
      }
    }

    return { tile: t, shanten, offense, danger };
  });

  // P0: 以向听数为首要排序（越低越好），同向听数内按评分升序（低分先弃）
  scored.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    // 防守调整
    let aScore = a.offense;
    let bScore = b.offense;
    if (pushFold === 'fold') {
      aScore -= a.danger * 100;
      bScore -= b.danger * 100;
    } else if (pushFold === 'ambiguous') {
      aScore -= a.danger * 30;
      bScore -= b.danger * 30;
    } else {
      aScore -= a.danger * 3;
      bScore -= b.danger * 3;
    }
    return aScore - bScore;  // 升序：低分在前 → 优先弃掉价值最低的牌
  });

  // 次优选择（模拟失误）
  if (config.suboptimalDiscardChance > 0 && Math.random() < config.suboptimalDiscardChance) {
    const topN = Math.min(3, scored.length);
    return scored[Math.floor(Math.random() * topN)].tile;
  }

  return scored[0].tile;
}

// ── 2. 响应动作选择 ──

export function aiChooseAction(
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig = DIFFICULTY_NORMAL,
): string | null {
  const actions = state.actionsAvailable[playerWind];
  if (!actions) return null;

  // 和牌始终优先（所有难度一致）
  if (actions.canTsumo) return 'tsumo';
  if (actions.canRon) return 'ron';

  // 立直
  if (actions.canRiichi) {
    const riichiJudgment = shouldRiichi(
      state.players[playerWind].hand,
      state,
      playerWind,
      config,
    );
    if (riichiJudgment.should) return 'riichi';
  }

  // 暗杠
  if (actions.canAnkan) {
    if (shouldAnkan(state.players[playerWind].hand, config)) return 'ankan';
  }

  // 鸣牌（吃碰杠）
  if (state.lastDiscard && state.lastDiscardPlayer !== playerWind) {
    if (actions.canPon) {
      const d = shouldCallMeld(state.players[playerWind].hand, state.lastDiscard, 'pon', state, playerWind, config);
      if (d) return 'pon';
    }
    if (actions.canKan) {
      const d = shouldCallMeld(state.players[playerWind].hand, state.lastDiscard, 'kan', state, playerWind, config);
      if (d) return 'kan';
    }
    if (actions.canChi) {
      const d = shouldCallMeld(state.players[playerWind].hand, state.lastDiscard, 'chi', state, playerWind, config);
      if (d) return 'chi';
    }
  }

  // 故意放铳（Easy 用）
  if (config.intentionalDealInChance > 0 && Math.random() < config.intentionalDealInChance && actions.canRon) {
    return 'ron';
  }

  return 'pass';
}

// ── 3. 立直判断（保留导出兼容） ──

export function aiDecideRiichi(
  hand: Tile[],
  state: GameState,
  playerWind: Wind,
  config: DifficultyConfig = DIFFICULTY_NORMAL,
): boolean {
  const j = shouldRiichi(hand, state, playerWind, config);
  return j.should;
}

// ── 内部：弃牌评分 ──

function scoreDiscardTile(
  tile: Tile,
  hand: Tile[],
  state: GameState,
  _playerWind: Wind,
  config: DifficultyConfig,
): number {
  let score = 0;

  // ── 字牌：役牌価値 + 対子/刻子状態 ──
  if (tile.suit === 'z') {
    const count = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
    // 计算可见枚数（全场弃牌+鸣牌+宝牌指示）
    let visible = 0;
    for (const p of state.players) {
      for (const d of p.discards) if (d.suit === tile.suit && d.value === tile.value) visible++;
      for (const m of p.melds) for (const mt of m.tiles) if (mt.suit === tile.suit && mt.value === tile.value) visible++;
    }
    for (const di of state.doraIndicators) if (di.suit === tile.suit && di.value === tile.value) visible++;
    // 包含自己手牌中的这一张
    const totalVisible = visible + count;
    const isDead = totalVisible >= 3; // 已有3+张可见，不可能成刻子/对子
    const isYakuhai = isYakuhaiTile(tile, state.roundWind, _playerWind);
    if (isDead) {
      score += isYakuhai ? 1 : 0; // 死牌几乎无价值
    } else if (count >= 3) score += isYakuhai ? 20 : 12;
    else if (count === 2) score += isYakuhai ? 14 : 8;
    else score += isYakuhai ? 6 : 2;
    return score;
  }

  // ── 5ブロック理論に基づくブロック品質 ──
  const sameCount = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
  if (sameCount >= 3) score += 20;
  else if (sameCount === 2) score += 14;
  else {
    const adj = hand.filter(t => t.suit === tile.suit && Math.abs(t.value - tile.value) === 1).length;
    const gap = hand.filter(t => t.suit === tile.suit && Math.abs(t.value - tile.value) === 2).length;
    if (adj >= 2) score += 12;
    else if (adj === 1) score += 8;
    else if (gap >= 1) score += 5;
    else score += 1; // 孤立牌
  }

  // 赤ドラ：高価値
  if (tile.isAkadora) score += 10;

  // Hard/Lunatic: 宝牌加成
  if (config.useHandValue) {
    const doraBonus = getDoraValue(tile, state);
    score += doraBonus * 3;
  }

  // Hard/Lunatic: 向听数悪化防止
  if (config.useWaitQuality) {
    const testHand = hand.filter(t => t.id !== tile.id);
    if (testHand.length === hand.length - 1) {
      const shantenBefore = getShanten(hand);
      const shantenAfter = getShanten(testHand);
      if (shantenAfter > shantenBefore) {
        score -= 15;
      }
    }
  }

  return score;
}

function getNeighborCount(hand: Tile[], tile: Tile): number {
  if (tile.suit === 'z') return 0;
  return hand.filter(t =>
    t.suit === tile.suit && Math.abs(t.value - tile.value) <= 2 && t.value !== tile.value
  ).length;
}

function getSequencePotential(hand: Tile[], tile: Tile): number {
  if (tile.suit === 'z') return 0;
  const suitHand = hand.filter(t => t.suit === tile.suit);
  const v = tile.value;
  let potential = 0;

  for (const seq of [[v-2, v-1, v], [v-1, v, v+1], [v, v+1, v+2]]) {
    if (seq[0] >= 1 && seq[2] <= 9) {
      const present = seq.filter(n => n !== v).filter(n => suitHand.some(t => t.value === n)).length;
      if (present === 2) potential += 3;
      else if (present === 1) potential += 1;
    }
  }
  return potential;
}

/** 牌值与宝牌的关系 */
function getDoraValue(tile: Tile, state: GameState): number {
  let value = 0;
  for (const di of state.doraIndicators) {
    const doraVal = di.value === 9 ? 1 : di.value + 1;
    if (tile.suit === di.suit && tile.value === doraVal) {
      value += 3; // 宝牌：高保留价值
    }
  }
  return value;
}
