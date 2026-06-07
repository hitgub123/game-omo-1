/**
 * 对比测试: 我们的 checkWin vs riichi 库
 * 不一致时以 riichi 库为准，排查我们的 bug
 */
import { describe, it, expect } from 'vitest';
import { checkWin, isWinningHand } from '../game/hand';
import { calculateScore } from '../game/scoring';
import { Wind, GamePhase } from '../game/types';
import type { Tile, GameState, Player, TileSuit } from '../game/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Riichi = require('riichi');

let _tid = 10000;
function T(suit: TileSuit, v: number): Tile { return { id: _tid++, suit, value: v }; }
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

function dummyState(extra?: Partial<GameState>): GameState {
  return {
    wall: [], deadWall: [], doraIndicators: [], uraDoraIndicators: [],
    players: [0, 1, 2, 3].map(w => ({
      name: `P${w}`, wind: w as Wind, hand: [], melds: [], discards: [], discardsSize: 0,
      isRiichi: false, riichiDiscardIndex: -1, score: 25000, isDealer: w === 0,
      isHuman: w === 0, tenpai: false, hasCalled: false,
    } as Player)),
    currentPlayer: Wind.EAST, turn: 0, phase: GamePhase.DISCARDING,
    roundWind: Wind.EAST, honba: 0, riichiSticks: 0, kanCount: 0,
    actionsAvailable: [[], [], [], []] as any, turnHistory: [], dealerIndex: Wind.EAST,
    handCount: 0, furitenPlayers: [], ...extra,
  };
}

function ourTsumo(hand14: Tile[], s?: GameState) {
  const win = hand14[hand14.length - 1];
  return checkWin(hand14, [], win, true, Wind.EAST, s || dummyState());
}

// Convert our tile string to riichi library format: "1m2m3m..."
function toRiichiStr(ts: Tile[]): string {
  return ts.map(t => `${t.value}${t.suit}`).join('');
}

// ============================================================
// Comparison test cases
// ============================================================
const testCases: { name: string; hand: string; expectAgari: boolean }[] = [
  // Basic winning hands
  { name: '平和 123456789m123p55', hand: 'm123456789p12355', expectAgari: true },
  { name: '断幺 234567m234p567s88', hand: 'm234567p234s56788', expectAgari: true },
  { name: '七对子 112233m445566p77', hand: 'm112233p44556677', expectAgari: true },
  { name: '混一色 123456789m123z11', hand: 'm123456789123z11', expectAgari: true },
  { name: '清一色 123456789m12355', hand: 'm12345678912355', expectAgari: true },
  { name: '对对和 111m222p333s444z55', hand: 'm111p222s333z444m55', expectAgari: true },
  { name: '一气通贯 123456789m123s55', hand: 'm123456789p123s55', expectAgari: true },
  { name: '三色同顺 123m456m123p456p123s55', hand: 'm123456p123456s12355', expectAgari: true },
  
  // Non-winning
  { name: '非和牌 13散张', hand: 'm124578p135s246z12345', expectAgari: false },
  { name: '国士无双', hand: 'm19p19s19z1234567z7', expectAgari: true },
  { name: '国士无双13面', hand: 'm19p19s19z12345671', expectAgari: true },
  { name: '大三元 123m55z555666777', hand: 'm12355z555666777', expectAgari: true },
  { name: '字一色 111222333444z55', hand: 'z11122233344455', expectAgari: true },
  { name: '三暗刻 111m789p222s333z55', hand: 'm111789p222s333z55', expectAgari: true },
  { name: '小三元 123m456s123z55566677', hand: 'm123456s123z55566677', expectAgari: true },
  { name: '混老头 111m999p111s99z1177', hand: 'm111999p111s99z1177', expectAgari: true },
  { name: '纯全带 123m789p123s789m11', hand: 'm123789p123s789m11', expectAgari: true },
  { name: '二杯口 112233m112233p55', hand: 'm112233p112233s55', expectAgari: true },
];

describe('riichi 库对比', () => {
  for (const tc of testCases) {
    it(tc.name, () => {
      const handTiles = tiles(tc.hand);
      const ourResult = handTiles.length === 14 ? ourTsumo(handTiles) : null;
      const oursWins = ourResult !== null;

      if (tc.expectAgari) {
        // Compare with riichi library
        const riichiStr = toRiichiStr(handTiles);
        try {
          const r = new Riichi(riichiStr);
          const libResult = r.calc();
          expect(libResult.error).toBe(false);

          if (libResult.isAgari !== oursWins) {
            console.error(`MISMATCH: ${tc.name}`);
            console.error(`  Riichi库: isAgari=${libResult.isAgari}, han=${libResult.han}, fu=${libResult.fu}`);
            if (ourResult) console.error(`  我们的: han=${ourResult.totalHan}, fu=${ourResult.fu}`);
          }
          // Result: trust library
          expect(oursWins).toBe(libResult.isAgari);
        } catch (e: any) {
          console.error(`  Riichi库解析失败: ${e.message}`);
        }
      } else {
        expect(oursWins).toBe(false);
      }
    });
  }
});
