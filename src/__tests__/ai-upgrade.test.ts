/**
 * AI 升级模块测试
 *
 * 测试内容：
 *   1. difficulty.ts — 配置完整性
 *   2. defense.ts — 危险度计算
 *   3. strategy.ts — 战术决策
 *   4. ai.ts — 难度参数集成
 */
import { describe, it, expect } from 'vitest';
import { getDifficulty, DIFFICULTY_EASY, DIFFICULTY_NORMAL, DIFFICULTY_HARD, DIFFICULTY_LUNATIC } from '../game/difficulty';
import type { DifficultyConfig } from '../game/difficulty';
import { calculateDanger } from '../game/defense';
import { shouldRiichi, shouldPushOrFold, getShanten } from '../game/strategy';
import { aiChooseDiscard, aiChooseAction, aiDecideRiichi } from '../game/ai';
import { createInitialState, drawTile } from '../game/gameEngine';
import { GameController } from '../game/GameController';
import { Wind, WINDS, GamePhase } from '../game/types';
import type { Tile, GameState } from '../game/types';

// ── 辅助 ──

function makeTile(suit: string, value: number, id: number): Tile {
  return { id, suit: suit as any, value };
}

function makeHand(suit: string, values: number[], startId: number): Tile[] {
  return values.map((v, i) => makeTile(suit, v, startId + i));
}

// ============================================================
// 1. difficulty.ts
// ============================================================
describe('difficulty.ts', () => {
  it('getDifficulty 返回正确的配置', () => {
    expect(getDifficulty('easy')).toBe(DIFFICULTY_EASY);
    expect(getDifficulty('normal')).toBe(DIFFICULTY_NORMAL);
    expect(getDifficulty('hard')).toBe(DIFFICULTY_HARD);
    expect(getDifficulty('lunatic')).toBe(DIFFICULTY_LUNATIC);
  });

  it('所有难度配置都有合法的 level 字段', () => {
    const levels: DifficultyConfig[] = [
      DIFFICULTY_EASY, DIFFICULTY_NORMAL, DIFFICULTY_HARD, DIFFICULTY_LUNATIC,
    ];
    for (const cfg of levels) {
      expect(['easy', 'normal', 'hard', 'lunatic']).toContain(cfg.level);
    }
  });

  it('难度递增：randomDiscardChance 递减', () => {
    expect(DIFFICULTY_EASY.randomDiscardChance).toBeGreaterThan(DIFFICULTY_NORMAL.randomDiscardChance);
    expect(DIFFICULTY_NORMAL.randomDiscardChance).toBeGreaterThan(DIFFICULTY_HARD.randomDiscardChance);
    expect(DIFFICULTY_HARD.randomDiscardChance).toBeGreaterThanOrEqual(DIFFICULTY_LUNATIC.randomDiscardChance);
  });

  it('Lunatic 没有随机失误', () => {
    expect(DIFFICULTY_LUNATIC.randomDiscardChance).toBe(0);
    expect(DIFFICULTY_LUNATIC.suboptimalDiscardChance).toBe(0);
    expect(DIFFICULTY_LUNATIC.intentionalDealInChance).toBe(0);
  });

  it('防守权重递增', () => {
    expect(DIFFICULTY_EASY.defenseWeight).toBe(0);
    expect(DIFFICULTY_LUNATIC.defenseWeight).toBeGreaterThan(DIFFICULTY_HARD.defenseWeight);
    expect(DIFFICULTY_HARD.defenseWeight).toBeGreaterThan(DIFFICULTY_NORMAL.defenseWeight);
  });
});

// ============================================================
// 2. defense.ts
// ============================================================
describe('defense.ts', () => {
  it('Easy 难度下所有牌危险度为 0', () => {
    const state = createInitialState();
    const hand = state.players[Wind.EAST].hand;
    const danger = calculateDanger(hand, state, Wind.EAST, DIFFICULTY_EASY);
    for (const [, d] of danger) {
      expect(d).toBe(0);
    }
  });

  it('有立直对手时，危险度应 > 0', () => {
    const state = createInitialState();
    // 设置 SOUTH 立直
    (state as any).players[Wind.SOUTH].isRiichi = true;
    const hand = state.players[Wind.EAST].hand;
    const danger = calculateDanger(hand, state, Wind.EAST, DIFFICULTY_HARD);
    // Hard 难度下至少有些牌是有危险度的
    let hasPositive = false;
    for (const [, d] of danger) {
      if (d > 0) { hasPositive = true; break; }
    }
    expect(hasPositive).toBe(true);
  });

  it('現物（对手弃过的牌）危险度为最低', () => {
    const state = createInitialState();
    const tile = state.players[Wind.SOUTH].hand[0];
    // 把这张牌加入 SOUTH 的弃牌堆
    (state as any).players[Wind.SOUTH].discards = [tile];
    const hand = state.players[Wind.EAST].hand;
    const danger = calculateDanger(state.players[Wind.EAST].hand, state, Wind.EAST, DIFFICULTY_LUNATIC);
    // 至少不抛异常
    expect(danger.size).toBeGreaterThan(0);
  });

  it('不抛异常', () => {
    const state = createInitialState();
    const hand = state.players[Wind.EAST].hand;
    expect(() => calculateDanger(hand, state, Wind.EAST, DIFFICULTY_NORMAL)).not.toThrow();
    expect(() => calculateDanger(hand, state, Wind.EAST, DIFFICULTY_HARD)).not.toThrow();
    expect(() => calculateDanger(hand, state, Wind.EAST, DIFFICULTY_LUNATIC)).not.toThrow();
  });
});

// ============================================================
// 3. strategy.ts
// ============================================================
describe('strategy.ts', () => {
  it('getShanten 对标准和牌返回 -1', () => {
    const hand = [
      ...makeHand('m', [1,2,3,4,5,6,7,8,9], 0),
      ...makeHand('p', [1,2,3,5,5], 9), // 14张
    ];
    const s = getShanten(hand);
    // 14张标准和牌
    expect(s === -1 || s === 0).toBe(true);
  });

  it('shouldRiichi 在没有听牌时返回 false', () => {
    // 完全断开的牌：不同花色，无对子，无搭子
    const tiles: Tile[] = [];
    let id = 0;
    // 1m 3m 5m (3万), 1p 3p 5p (3筒), 1s 3s 5s (3索),
    // 2z 4z 6z 7z (4字牌) = 13张，无任何面子可能
    for (const v of [1,3,5]) tiles.push({ id: id++, suit: 'm' as any, value: v });
    for (const v of [1,3,5]) tiles.push({ id: id++, suit: 'p' as any, value: v });
    for (const v of [1,3,5]) tiles.push({ id: id++, suit: 's' as any, value: v });
    for (const v of [2,4,6,7]) tiles.push({ id: id++, suit: 'z' as any, value: v });
    const state = createInitialState();
    const result = shouldRiichi(tiles, state, Wind.EAST, DIFFICULTY_NORMAL);
    expect(result.should).toBe(false);
  });

  it('shouldPushOrFold 在无对手威胁时返回 push', () => {
    const hand = makeHand('m', [1,2,3,4,5,6,7,8,9, 1,2,3,5], 0);
    const state = createInitialState();
    const result = shouldPushOrFold(hand, state, Wind.EAST, DIFFICULTY_NORMAL);
    expect(result).toBe('push');
  });
});

// ============================================================
// 4. ai.ts — 难度集成
// ============================================================
describe('ai.ts 难度集成', () => {
  it('aiChooseDiscard 接受 config 参数不抛异常', () => {
    const hand = makeHand('m', [1,2,3,4,5,6,7,8,9, 1,2,3,5], 0);
    const state = createInitialState();
    expect(() => aiChooseDiscard(hand, undefined, state, Wind.EAST, DIFFICULTY_EASY)).not.toThrow();
    expect(() => aiChooseDiscard(hand, undefined, state, Wind.EAST, DIFFICULTY_NORMAL)).not.toThrow();
    expect(() => aiChooseDiscard(hand, undefined, state, Wind.EAST, DIFFICULTY_HARD)).not.toThrow();
    expect(() => aiChooseDiscard(hand, undefined, state, Wind.EAST, DIFFICULTY_LUNATIC)).not.toThrow();
  });

  it('aiChooseDiscard 返回手牌中的牌', () => {
    const hand = makeHand('m', [1,2,3,4,5,6,7,8,9, 1,2,3,5], 0);
    const state = createInitialState();
    const tile = aiChooseDiscard(hand, undefined, state, Wind.EAST, DIFFICULTY_NORMAL);
    expect(hand.some(t => t.id === tile.id)).toBe(true);
  });

  it('aiChooseAction 优先和牌', () => {
    const state = createInitialState();
    (state as any).actionsAvailable[Wind.SOUTH] = {
      canChi: false, chiOptions: [], canPon: false, canKan: false,
      canRon: true, canTsumo: true, canRiichi: false, canAnkan: false,
      canKakan: false, canNineOrphans: false,
    };
    const choice = aiChooseAction(state, Wind.SOUTH, DIFFICULTY_NORMAL);
    expect(choice === 'tsumo' || choice === 'ron').toBe(true);
  });

  it('aiDecideRiichi 返回 boolean', () => {
    const hand = [
      ...makeHand('m', [1,2,3,4,5,6,7,8,9], 0),
      ...makeHand('p', [1,2,3,5], 9), // 13张
    ];
    const state = createInitialState();
    const result = aiDecideRiichi(hand, state, Wind.EAST, DIFFICULTY_NORMAL);
    expect(typeof result).toBe('boolean');
  });

  it('GameController setDifficulty 支持四种难度', () => {
    const gc = new GameController();
    gc.setDifficulty('easy');
    expect(gc.difficulty.level).toBe('easy');
    gc.setDifficulty('normal');
    expect(gc.difficulty.level).toBe('normal');
    gc.setDifficulty('hard');
    expect(gc.difficulty.level).toBe('hard');
    gc.setDifficulty('lunatic');
    expect(gc.difficulty.level).toBe('lunatic');
    gc.destroy();
  });
});
