/**
 * abilities.ts — 角色超能力系统
 *
 * 能力类型：
 *   dealing   — 配牌系：影响下局初始手牌（早苗、大妖精）
 *   instant   — 即时效果：改变游戏状态（妖梦、文、铃仙）
 *   modifier  — 游戏规则修改：需要协同 gameEngine（灵梦、琪露诺、魔理沙、咲夜）
 *
 * 能量槽规则（doc/abilities.md）：
 *   上限 100，摸牌+2 鸣牌+5 立直+10 和牌+15
 *   每局开始重置为0
 */

import type { Tile, GameState, Wind } from './types';

// ═══════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════

export interface RequiredTile {
  suit: 'm' | 'p' | 's' | 'z';
  value: number;
}

export interface HandRequirement {
  wind: number;
  useCount: number;
  tiles: RequiredTile[];
}

export interface AbilityDef {
  cost: number;
  type: 'dealing' | 'instant' | 'modifier';
  maxLevel?: number;  // 0 = 无上限
  description: string;
}

export interface AbilityResult {
  ok: boolean;
  message: string;
  state?: GameState;
}

// ═══════════════════════════════════════════
// 角色能力注册表
// ═══════════════════════════════════════════

const REGISTRY: Record<string, AbilityDef> = {
  '博丽灵梦': {
    cost: 100,
    type: 'modifier',
    description: '博丽护符：自己打出的牌无法被鸣牌（吃碰杠）。',
  },
  '雾雨魔理沙': {
    cost: 100,
    type: 'modifier',
    description: 'ミニ八卦炉：每发动一次，立直和牌时多翻一张里宝牌。',
  },
  '十六夜咲夜': {
    cost: 100,
    type: 'modifier',
    description: '时间操作：弃牌后再进行一次摸牌+弃牌（额外一巡）。',
  },
  '魂魄妖梦': {
    cost: 100,
    type: 'instant',
    description: '剣術：其他每人减60能量，不足变0。',
  },
  '东风谷早苗': {
    cost: 100,
    type: 'dealing',
    maxLevel: 0,
    description: '奇跡：奇数次→字牌对子，偶数次→对子升暗刻。',
  },
  '琪露诺': {
    cost: 100,
    type: 'modifier',
    description: '氷結：所有对手下一次摸牌必须自摸切（暗杠/立直/和牌除外）。',
  },
  '铃仙·优昙华院·因幡': {
    cost: 100,
    type: 'instant',
    description: '狙击：听牌后可发动，指定一名玩家摸到铃仙要的和牌。',
  },
  '射命丸文': {
    cost: 100,
    type: 'instant',
    description: '風速：用一张风牌（东南西北）与牌山交换。',
  },
  '大妖精': {
    cost: 100,
    type: 'dealing',
    maxLevel: 0,
    description: '妖精の加護：下局其他玩家各有一张牌不得打出。不限制鸣牌。',
  },
};

// ═══════════════════════════════════════════
// 配牌系
// ═══════════════════════════════════════════

const HONORS_ALL: RequiredTile[] = [
  { suit: 'z', value: 1 }, { suit: 'z', value: 2 },
  { suit: 'z', value: 3 }, { suit: 'z', value: 4 },
  { suit: 'z', value: 5 }, { suit: 'z', value: 6 },
  { suit: 'z', value: 7 },
];

export function getHandRequirement(name: string, useCount: number): HandRequirement | null {
  const def = REGISTRY[name];
  if (!def || def.type !== 'dealing' || useCount <= 0) return null;

  // 东风谷早苗
  if (name === '东风谷早苗') {
    const tiles: RequiredTile[] = [];
    let pairs = 0;
    let triplets = 0;
    for (let i = 1; i <= useCount; i++) {
      if (i % 2 === 1) pairs++;
      else { pairs--; triplets++; }
    }
    let hi = 0;
    for (let i = 0; i < triplets; i++) {
      const h = HONORS_ALL[hi % 7];
      tiles.push(h, h, h);
      hi++;
    }
    for (let i = 0; i < pairs; i++) {
      const h = HONORS_ALL[hi % 7];
      tiles.push(h, h);
      hi++;
    }
    if (tiles.length > 0) return { wind: -1, useCount, tiles };
    return null;
  }

  // 大妖精：下局其他 3 个玩家各拿 useCount 张"死牌"（不得打出）
  if (name === '大妖精') {
    const tiles: RequiredTile[] = [];
    for (let p = 0; p < 3; p++) {
      for (let i = 0; i < useCount; i++) {
        tiles.push(HONORS_ALL[(p * useCount + i) % 7]);
      }
    }
    if (tiles.length > 0) return { wind: -2, useCount, tiles };
    return null;
  }

  return null;
}

export function getAllRequirements(
  playerNames: string[],
  useCounts: number[],
): HandRequirement[] {
  const reqs: HandRequirement[] = [];
  for (let i = 0; i < playerNames.length; i++) {
    const req = getHandRequirement(playerNames[i], useCounts[i]);
    if (req) { req.wind = i; reqs.push(req); }
  }
  reqs.sort((a, b) => b.useCount - a.useCount);
  return reqs;
}

// ═══════════════════════════════════════════
// 即时能力执行（妖梦、文、铃仙）
// ═══════════════════════════════════════════

export function executeInstantAbility(
  name: string,
  state: GameState,
  playerWind: Wind,
  targetWind?: Wind,
  extraTile?: { suit: string; value: number },
): AbilityResult {
  const def = REGISTRY[name];
  if (!def || def.type !== 'instant') {
    return { ok: false, message: '该角色无即时能力' };
  }

  const player = state.players[playerWind];
  if (player.energy < def.cost) {
    return { ok: false, message: `能量不足${def.cost}` };
  }

  const players = state.players.map(p => ({ ...p }));
  players[playerWind].energy -= def.cost;
  players[playerWind].abilityUseCount++;

  // ── 妖梦：其他每人 -60 能量 ──
  if (name === '魂魄妖梦') {
    for (let i = 0; i < 4; i++) {
      if (i !== playerWind) {
        players[i].energy = Math.max(0, players[i].energy - 60);
      }
    }
    return {
      ok: true,
      message: `⚔️ ${player.name} 发动剣術！其他玩家能量-60`,
      state: { ...state, players },
    };
  }

  // ── 文：风牌换牌山 ──
  if (name === '射命丸文') {
    if (!extraTile) return { ok: false, message: '需要选择一张风牌' };
    const { suit, value } = extraTile;
    if (suit !== 'z' || value < 1 || value > 4) {
      return { ok: false, message: '只能交换风牌（东南西北）' };
    }
    // 从手牌中找到这张风牌
    const idx = player.hand.findIndex(
      t => t.suit === suit && t.value === value && !t.isAkadora
    );
    if (idx === -1) return { ok: false, message: '手牌中没有这张风牌' };

    const wall = [...state.wall];
    if (wall.length === 0) return { ok: false, message: '牌山已空' };

    const windTile = player.hand[idx];
    const newTile = wall.shift()!;  // 从牌山顶摸一张

    players[playerWind].hand = [...player.hand];
    players[playerWind].hand.splice(idx, 1, newTile);

    // 风牌回到牌山底
    wall.push(windTile);

    return {
      ok: true,
      message: `🍃 ${player.name} 发动風速！${windTile.value}${windTile.suit} → ${newTile.value}${newTile.suit}`,
      state: { ...state, players, wall },
    };
  }

  // ── 铃仙：狙击（预留在 GameState.sniperReserve，实际抽牌在 drawTile 处理） ──
  if (name === '铃仙·优昙华院·因幡') {
    if (!extraTile) return { ok: false, message: '需要指定和牌' };
    if (targetWind === undefined) return { ok: false, message: '需要指定目标玩家' };

    // 检查是否听牌
    const { checkTenpai } = require('./hand');
    const tenpai = checkTenpai(player.hand, player.melds);
    if (!tenpai) return { ok: false, message: '未听牌，无法发动狙击' };

    // 检查指定的牌是否在听牌范围内
    const tileKey = `${extraTile.value}${extraTile.suit}`;
    const isWait = tenpai.waitTiles.some(
      (t: Tile) => `${t.value}${t.suit}` === tileKey
    );
    if (!isWait) return { ok: false, message: `${tileKey} 不是你等着的牌` };

    return {
      ok: true,
      message: `🎯 ${player.name} 发动狙击！目标：${state.players[targetWind].name} 摸到 ${tileKey}`,
      state: {
        ...state,
        players,
        sniperReserve: {
          tileKey,
          suit: extraTile.suit,
          value: extraTile.value,
          targetWind,
        },
      },
    };
  }

  return { ok: true, message: `${name} 发动能力`, state: { ...state, players } };
}

// ═══════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════

export function getAbilityDef(name: string): AbilityDef | null {
  return REGISTRY[name] ?? null;
}

export function getAbilityCost(name: string): number {
  return REGISTRY[name]?.cost ?? 100;
}

export function getAbilityType(name: string): string {
  return REGISTRY[name]?.type ?? 'instant';
}

/** 需要选择对手的能力 */
export function needsOpponentTarget(name: string): boolean {
  return name === '铃仙·优昙华院·因幡';
}

/** 需要选择牌的能力 */
export function needsTileSelect(name: string): boolean {
  return name === '射命丸文' || name === '铃仙·优昙华院·因幡';
}

/** 获取可用的风牌 */
export function getWindTiles(hand: Tile[]): Tile[] {
  return hand.filter(
    t => t.suit === 'z' && t.value >= 1 && t.value <= 4 && !t.isAkadora
  );
}

/** 获取铃仙可选的 target winds（除自己外的其他玩家，或自己） */
export function getSniperTargets(state: GameState, playerWind: Wind): { wind: Wind; name: string }[] {
  return state.players
    .map((p, i) => ({ wind: i as Wind, name: p.name }))
    .filter((_, i) => true);  // 包括自己
}
