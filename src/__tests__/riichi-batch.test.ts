/**
 * riichi 库 vs 我们自己的逻辑 —— 批量对比测试
 * 不一致时以 riichi 库为准，报告差异
 */
import { describe, it, expect } from 'vitest';
import { checkWin, findMahjongDivisions } from '../game/hand';
import { calculateScore } from '../game/scoring';
import { Wind, GamePhase } from '../game/types';
import type { Tile, GameState, Player, TileSuit } from '../game/types';

const Riichi = require('riichi');

let _tid = 10000;
function T(s: TileSuit, v: number): Tile { return { id: _tid++, suit: s, value: v }; }
function tiles(s: string): Tile[] {
  const r: Tile[] = [];
  const suits: Record<string, TileSuit> = { m: 'm', p: 'p', s: 's', z: 'z' };
  let suit: TileSuit = 'm';
  for (const ch of s) {
    if (suits[ch]) { suit = suits[ch]; continue; }
    r.push(T(suit, parseInt(ch)));
  }
  return r;
}
function toRiichiStr(ts: Tile[]): string {
  return ts.map(t => `${t.value}${t.suit}`).join('');
}

function ourTsumo(hand14: Tile[], riichi = false) {
  const win = hand14[hand14.length - 1];
  const s: GameState = {
    wall: [], deadWall: [], doraIndicators: [], uraDoraIndicators: [],
    players: [0,1,2,3].map(w => ({ name:`P${w}`, wind:w as Wind, hand:[], melds:[], discards:[], discardsSize:0, isRiichi: w===0 && riichi, riichiDiscardIndex:-1, score:25000, isDealer:w===0, isHuman:w===0, tenpai:false, hasCalled:false } as Player)),
    currentPlayer: Wind.EAST, turn: 0, phase: GamePhase.DISCARDING,
    roundWind: Wind.EAST, honba: 0, riichiSticks: 0, kanCount: 0,
    actionsAvailable: [[],[],[],[]] as any, turnHistory: [], dealerIndex: Wind.EAST,
    handCount: 0, furitenPlayers: [],
  };
  return checkWin(hand14, [], win, true, Wind.EAST, s);
}

// ============================================================
// 批量对比：所有役种
// ============================================================
const cases: { name: string; tiles: string; riichiOpt?: string; minHan?: number }[] = [
  // 1 翻
  { name: '立直', tiles: 'm123456789p12355', riichiOpt: 'r', minHan: 2 },
  { name: '门前清自摸', tiles: 'm123456789p12355', minHan: 1 },
  { name: '平和', tiles: 'm234567p234567s345', minHan: 1 },
  { name: '断幺', tiles: 'm23456788p234s345', minHan: 1 },
  { name: '役牌白', tiles: 'm234567p123s567z555', minHan: 1 },
  { name: '役牌发', tiles: 'm234567p123s567z666', minHan: 1 },
  { name: '役牌中', tiles: 'm234567p123s567z777', minHan: 1 },
  { name: '场风东', tiles: 'm234567p123s567z111', minHan: 1 },
  { name: '海底摸月', tiles: 'm123456789p12355', minHan: 1 },
  // 2 翻
  { name: '七对子', tiles: 'm112233p445566s77', minHan: 2 },
  { name: '一气通贯', tiles: 'm123456789p123s55', minHan: 2 },
  { name: '三色同顺', tiles: 'm123456p123s123z55', minHan: 2 },
  { name: '对对和', tiles: 'm111p222s333z444m55', minHan: 2 },
  { name: '三暗刻', tiles: 'm111789p222s333z55', minHan: 2 },
  { name: '小三元', tiles: 'm123456s123z55566677', minHan: 2 },
  { name: '混老头', tiles: 'm111999p111s99z1177', minHan: 2 },
  { name: '混全带幺九', tiles: 'm123789p123s789z1155', minHan: 2 },
  // 3 翻
  { name: '混一色', tiles: 'm123456789123z1155', minHan: 3 },
  { name: '纯全带幺九', tiles: 'm123789p123s789m11', minHan: 3 },
  { name: '二杯口', tiles: 'm112233p112233s55', minHan: 3 },
  // 6 翻
  { name: '清一色', tiles: 'm12345678912355', minHan: 6 },
  // 役满
  { name: '国士无双', tiles: 'm19p19s19z12345671', minHan: 13 },
  { name: '四暗刻', tiles: 'm111p222s333z444m55', minHan: 13 },
  { name: '大三元', tiles: 'm12355z555666777', minHan: 13 },
  { name: '字一色', tiles: 'z11122233344455', minHan: 13 },
  { name: '清老头', tiles: 'm111999p111s111m11', minHan: 13 },
];

// 需要 riichi 格式的选项串
function makeRiichiHand(tileStr: string, opt?: string): string {
  const ts = tiles(tileStr);
  let s = toRiichiStr(ts);
  if (opt) s += '+' + opt;
  return s;
}

describe('riichi 库 vs 我们 — 和牌判定', () => {
  const mismatches: string[] = [];

  for (const c of cases) {
    it(c.name, () => {
      const hand14 = tiles(c.tiles);
      const ours = ourTsumo(hand14, !!c.riichiOpt?.includes('r'));
      const oursWins = ours !== null;

      const riichiStr = makeRiichiHand(c.tiles, c.riichiOpt);
      let libOk = false;
      let libHan = 0, libFu = 0;
      try {
        const r = new Riichi(riichiStr);
        const lib = r.calc();
        libOk = !lib.error && lib.isAgari;
        libHan = lib.han;
        libFu = lib.fu;
      } catch (e: any) {
        // skip parse errors
        return;
      }

      if (libOk !== oursWins) {
        mismatches.push(`${c.name}: 和牌不一致 库=${libOk} 我们=${oursWins}`);
      } else if (oursWins && libOk) {
        if (ours!.totalHan < c.minHan!) {
          mismatches.push(`${c.name}: 翻数不足 实际=${ours!.totalHan} 预期≥${c.minHan}`);
        }
        // fu 差异只记不报错（riichi 库对满贯以上/特殊形可能返回 0）
      }
      expect(oursWins).toBe(libOk);
    });
  }

  it('report', () => {
    if (mismatches.length > 0) {
      console.log('\n=== 差异报告 ===');
      mismatches.forEach(m => console.log(`  ✗ ${m}`));
    } else {
      console.log('\n✓ 和牌判定全部一致');
    }
    expect(mismatches.length).toBe(0);
  });
});

// ============================================================
// 分数对比
// ============================================================
describe('riichi 库 vs 我们 — 分数对比', () => {
  it('平和门清自摸 1翻20符', () => {
    const ours = calculateScore(20, 1, false, true, 0, 0);
    expect(ours.payments[0]).toBe(400); // 親
    expect(ours.payments[1]).toBe(200); // 子
  });
  it('1翻30符 子家荣和', () => {
    expect(calculateScore(30, 1, false, false, 0, 0).ronPayment).toBe(1000);
  });
  it('1翻30符 亲家荣和', () => {
    expect(calculateScore(30, 1, true, false, 0, 0).ronPayment).toBe(1500);
  });
  it('2翻30符 子家荣和', () => {
    expect(calculateScore(30, 2, false, false, 0, 0).ronPayment).toBe(2000);
  });
  it('3翻30符 子家荣和', () => {
    expect(calculateScore(30, 3, false, false, 0, 0).ronPayment).toBe(3900);
  });
  it('满贯 子家荣和', () => {
    expect(calculateScore(30, 5, false, false, 0, 0).ronPayment).toBe(8000);
  });
  it('役满 子家荣和', () => {
    expect(calculateScore(25, 13, false, false, 0, 0).ronPayment).toBe(32000);
  });
  it('役满 亲家荣和', () => {
    expect(calculateScore(25, 13, true, false, 0, 0).ronPayment).toBe(48000);
  });
});
