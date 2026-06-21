/**
 * abilities.ts — 角色超能力系统
 *
 * 每个角色可拥有配牌类技能，影响每局初始配牌。
 * 配牌优先级：按能力使用次数降序。
 */

import type { Tile } from './types';

/** 一张牌的要求（花色+数字） */
export interface RequiredTile {
  suit: 'm' | 'p' | 's' | 'z';
  value: number;
}

/** 配牌需求：某个角色需要保证初始手牌中包含的牌组 */
export interface HandRequirement {
  /** 玩家风位 */
  wind: number;
  /** 使用次数（决定优先级） */
  useCount: number;
  /** 必须包含的牌 */
  tiles: RequiredTile[];
}

/**
 * 根据角色的能力使用次数，计算配牌需求
 * @param name 角色名
 * @param useCount 能力使用次数
 * @returns 该角色需要的手牌保证，或 null
 */
export function getHandRequirement(name: string, useCount: number): HandRequirement | null {
  if (useCount <= 0) return null;

  // 东风谷早苗：奇数次→字牌对子，偶数次→对子升级为暗刻
  if (name === '东风谷早苗') {
    const tiles: RequiredTile[] = [];
    const honorTiles: RequiredTile[] = [
      { suit: 'z', value: 1 }, // 東
      { suit: 'z', value: 2 }, // 南
      { suit: 'z', value: 3 }, // 西
      { suit: 'z', value: 4 }, // 北
      { suit: 'z', value: 5 }, // 白
      { suit: 'z', value: 6 }, // 發
      { suit: 'z', value: 7 }, // 中
    ];

    // 每奇数次 = 1个对子（2张相同字牌）
    // 每偶数次 = 1个暗刻（3张相同字牌）= 对子升级
    let pairs = 0;
    let triplets = 0;
    for (let i = 1; i <= useCount; i++) {
      if (i % 2 === 1) {
        pairs++;
      } else {
        pairs--; // 对子升级为暗刻
        triplets++;
      }
    }

    // 分配字牌种类（按顺序循环使用不同字牌）
    let honorIdx = 0;
    for (let i = 0; i < triplets; i++) {
      const h = honorTiles[honorIdx % honorTiles.length];
      tiles.push(h, h, h); // 暗刻=3张
      honorIdx++;
    }
    for (let i = 0; i < pairs; i++) {
      const h = honorTiles[honorIdx % honorTiles.length];
      tiles.push(h, h); // 对子=2张
      honorIdx++;
    }

    if (tiles.length > 0) {
      return { wind: -1, useCount, tiles }; // wind 由调用方设置
    }
  }

  return null;
}

/**
 * 获取所有玩家的配牌需求，按 useCount 降序排列
 */
export function getAllRequirements(
  playerNames: string[],
  useCounts: number[],
): HandRequirement[] {
  const reqs: HandRequirement[] = [];
  for (let i = 0; i < playerNames.length; i++) {
    const req = getHandRequirement(playerNames[i], useCounts[i]);
    if (req) {
      req.wind = i;
      reqs.push(req);
    }
  }
  reqs.sort((a, b) => b.useCount - a.useCount); // 高使用次数优先
  return reqs;
}
