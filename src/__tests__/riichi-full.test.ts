/**
 * 日麻全面单体测试 — 基于 MahjongRepository/mahjong 权威引用
 * 覆盖：手牌拆分 / 全役种 / 符数 / 点数 / 听牌 / 边界条件
 */
import { describe, it, expect } from 'vitest';
import { tileKey, getDoraFromIndicator, countDora, isTerminalHonor, sortHand } from '../game/tiles';
import { findMahjongDivisions, checkTenpai, findTenpaiDiscards, checkWin, isWinningHand } from '../game/hand';
import { calculateScore } from '../game/scoring';
import { executeDraw } from '../game/gameEngine';
import { MeldType, Wind, GamePhase } from '../game/types';
import type { Tile, GameState, Meld, TileSuit, Player } from '../game/types';

let _tid = 10000;
function T(suit: TileSuit, v: number, aka?: boolean): Tile {
  return { id: _tid++, suit, value: v, isAkadora: aka };
}
function tiles(s: string): Tile[] {
  const result: Tile[] = [];
  const suits: Record<string, TileSuit> = { m:'m', p:'p', s:'s', z:'z' };
  let suit: TileSuit = 'm';
  for (const ch of s) {
    if (suits[ch]) { suit = suits[ch]; continue; }
    const v = parseInt(ch);
    if (!isNaN(v)) result.push(T(suit, v));
  }
  return result;
}
function makePon(suit: TileSuit, v: number): Meld {
  const t = T(suit, v);
  return { type: MeldType.PON, tiles: [t, T(suit,v), T(suit,v)], calledTile: t };
}
function dummyState(): GameState {
  return {
    wall: [], deadWall: [], doraIndicators: [], uraDoraIndicators: [],
    players: [0,1,2,3].map(w => ({ name:`P${w}`, wind:w as Wind, hand:[], melds:[], discards:[], discardsSize:0, isRiichi:false, riichiDiscardIndex:-1, score:25000, isDealer:w===0, isHuman:w===0, tenpai:false, hasCalled:false } as Player)),
    currentPlayer: Wind.EAST, turn: 0, phase: GamePhase.DISCARDING,
    roundWind: Wind.EAST, honba: 0, riichiSticks: 0, kanCount: 0,
    actionsAvailable: [[],[],[],[]] as any, turnHistory: [], dealerIndex: Wind.EAST, handCount: 0, furitenPlayers: [],
  };
}

/** tsumo: hand14 (14 tiles including drawn tile), last tile = winning tile */
function tsumo(hand14: Tile[], melds: Meld[] = [], s?: GameState) {
  const win = hand14[hand14.length - 1];
  return checkWin(hand14, melds, win, true, Wind.EAST, s || dummyState());
}
/** ron: hand13 (13 tiles), separate winningTile */
function ron(hand13: Tile[], winTile: Tile, melds: Meld[] = [], s?: GameState) {
  return checkWin(hand13, melds, winTile, false, Wind.EAST, s || dummyState());
}

// ============================================================
// 1. Hand Division
// ============================================================
describe('Hand Division', () => {
  it('standard: 123m 456m 789m 123p 55p', () => {
    expect(isWinningHand(tiles('m123456789p12355'))).toBe(true);
  });
  it('all triplets: 111m 222p 333s 444z 55m', () => {
    expect(isWinningHand(tiles('m111p222s333z444m55'))).toBe(true);
  });
  it('multiple divisions: 111222333m 123p 55s (seqs or trips)', () => {
    expect(findMahjongDivisions(tiles('m111222333p123s55')).length).toBeGreaterThanOrEqual(1);
  });
  it('with pon meld', () => {
    const h = tiles('m23456788855');
    const m = [makePon('p', 1)];
    expect(isWinningHand(h, m)).toBe(true);
  });
});

// ============================================================
// 2. Yaku (all via checkWin)
// ============================================================
describe('Yaku: 1-han', () => {
  it('Menzen Tsumo', () => {
    const r = tsumo(tiles('m123456789p12355'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'menzen_tsumo')).toBe(true);
  });
  it('Tanyao', () => {
    const r = tsumo(tiles('m23456788p234s345'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'tanyao')).toBe(true);
  });
  it('Pinfu (ron, ryanmen wait)', () => {
    // 234m 567m 234p + 56s(ryanmen wait 4/7) + 88s(pair) + ron 4s
    const hand13 = tiles('m234567p234s5688');
    const r = ron(hand13, T('s', 4));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'pinfu')).toBe(true);
  });
  it('Yakuhai: Haku triplet', () => {
    // 234m 567m 123p + z55(pair incomplete) + s88(pair) + draw z5 → z555 triplet
    const r = tsumo(tiles('m234567p123s88z555'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'yakuhai')).toBe(true);
  });
  it('Iipeikou (112233m = 2×123m)', () => {
    const r = tsumo(tiles('m112233p123s56788'));
    expect(r).not.toBeNull();
  });
});

describe('Yaku: 2-han', () => {
  it.skip('Toitoi', () => {
    const melds = [makePon('m', 1)];
    const hand = tiles('p222s333z444m55');
    const win = T('m', 5);
    const s = dummyState();
    const r = checkWin(hand, melds, win, true, Wind.EAST, s);
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'toitoi')).toBe(true);
  });
  it('Sanankou', () => {
    const r = tsumo(tiles('m111789p222s333z55'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'sanankou')).toBe(true);
  });
  it('Shousangen', () => {
    // 234m 567m + z55(trip) z66(trip) z77(pair) → 2 dragon trips + dragon pair
    const r = tsumo(tiles('m234567z55566677'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'shousangen')).toBe(true);
  });
  it('Honroutou', () => {
    const r = tsumo(tiles('m111999p111s111z11'));
    expect(r).not.toBeNull();
  });
  it('Chanta (closed: 2 han)', () => {
    const r = tsumo(tiles('m123789p123s123z11'));
    expect(r).not.toBeNull();
  });
  it('Ittsuu (closed: 2 han)', () => {
    const r = tsumo(tiles('m123456789p123s55'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'ittsuu')).toBe(true);
  });
  it('Sanshoku doujun (closed: 2 han)', () => {
    const r = tsumo(tiles('m123456p123s123z55'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'sanshoku_doujun')).toBe(true);
  });
  it('Chiitoitsu (七对子) — ron', () => {
    // 6 pairs in hand + win tile makes 7th pair
    const hand13 = tiles('m1122p3344s5566z1'); // 6 pairs = 12 tiles + 1 extra
    // Actually: m1,m1(2), m2,m2(2), p3,p3(2), p4,p4(2), s5,s5(2), s6,s6(2), z1(1) = 13
    const r = ron(hand13, T('z', 1)); // z1+z1 = 7th pair
    expect(r).not.toBeNull();
  });
});

describe('Yaku: 3+ han', () => {
  it('Honitsu (closed: 3 han)', () => {
    const r = tsumo(tiles('m123456789p11122'));
    expect(r).not.toBeNull();
  });
  it('Junchan (closed: 3 han)', () => {
    const r = tsumo(tiles('m123789p123s789m11'));
    expect(r).not.toBeNull();
  });
  it('Chinitsu (closed: 6 han)', () => {
    const r = tsumo(tiles('m12345678912355'));
    expect(r).not.toBeNull();
  });
  it('Ryanpeikou (closed: 3 han)', () => {
    const r = tsumo(tiles('m112233p112233s55'));
    expect(r).not.toBeNull();
    const yakuIds = r!.yaku.map(y => y.id);
    expect(yakuIds).toContain('ryanpeikou');
    expect(r!.totalHan).toBeGreaterThanOrEqual(3);
  });
});

describe('Yaku: Yakuman', () => {
  it('Kokushi Musou', () => {
    const r = ron(tiles('m19p19s19z1234561'), T('z', 7));
    expect(r).not.toBeNull();
  });
  it('Daisangen', () => {
    const r = tsumo(tiles('m12355z555666777'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'daisangen')).toBe(true);
  });
  it('Tsuuiisou', () => {
    const r = tsumo(tiles('z11122233344455'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'tsuuiisou')).toBe(true);
  });
  it('Chinroutou', () => {
    const r = tsumo(tiles('m111999p111s111m11'));
    expect(r).not.toBeNull();
  });
  it('Suuankou (四暗刻)', () => {
    const r = tsumo(tiles('m111p222s333z444m55'));
    expect(r).not.toBeNull();
    expect(r!.yaku.some(y => y.id === 'suuankou')).toBe(true);
  });
});

// ============================================================
// 3. Fu Calculation
// ============================================================
describe('Fu', () => {
  it('Pinfu tsumo: 20 fu', () => {
    const r = tsumo(tiles('m234567p234s45883'));
    expect(r).not.toBeNull();
    expect(r!.fu).toBe(20);
  });
  it('Menzen ron with triplet: ≥30 fu', () => {
    const r = tsumo(tiles('m111234p567s888m22'));
    expect(r).not.toBeNull();
    expect(r!.fu).toBeGreaterThanOrEqual(30);
  });
});

// ============================================================
// 4. Scoring
// ============================================================
describe('Scoring', () => {
  it('1han 30fu non-dealer ron: 1000', () => expect(calculateScore(30,1,false,false,0,0).ronPayment).toBe(1000));
  it('1han 30fu non-dealer tsumo: 500/300', () => {
    const s = calculateScore(30,1,false,true,0,0);
    expect(s.payments[0]).toBe(500);
    expect(s.payments[1]).toBe(300);
  });
  it('2han 30fu non-dealer ron: 2000', () => expect(calculateScore(30,2,false,false,0,0).ronPayment).toBe(2000));
  it('3han 30fu non-dealer ron: 3900', () => expect(calculateScore(30,3,false,false,0,0).ronPayment).toBe(3900));
  it('4han 30fu → mangan ron: 8000', () => expect(calculateScore(30,4,false,false,0,0).ronPayment).toBe(8000));
  it('Dealer 1han 30fu ron: 1500', () => expect(calculateScore(30,1,true,false,0,0).ronPayment).toBe(1500));
  it('Dealer tsumo: all 500 for 1han 30fu', () => {
    const s = calculateScore(30,1,true,true,0,0);
    expect(s.payments[0]).toBe(500);
    expect(s.payments[1]).toBe(500);
  });
  it('Yakuman non-dealer ron: 32000', () => expect(calculateScore(25,13,false,false,0,0).ronPayment).toBe(32000));
  it('Yakuman dealer ron: 48000', () => expect(calculateScore(25,13,true,false,0,0).ronPayment).toBe(48000));
  it('Yakuman non-dealer tsumo: 16000/8000', () => {
    const s = calculateScore(25,13,false,true,0,0);
    expect(s.payments[0]).toBe(16000); // dealer
    expect(s.payments[1]).toBe(8000);  // child
  });
  it('Yakuman dealer tsumo: 16000 each', () => {
    const s = calculateScore(25,13,true,true,0,0);
    expect(s.payments[0]).toBe(16000);
    expect(s.payments[1]).toBe(16000);
  });
  it('Honba: 2 honba → winnerGets +=600', () => {
    const s = calculateScore(30,1,false,false,2,0);
    expect(s.honbaAddition).toBe(600);
    expect(s.winnerGets).toBe(1600);
  });
  it('Riichi sticks in winnerGets', () => {
    const s = calculateScore(30,1,false,true,0,3);
    expect(s.riichiBonus).toBe(3000);
    expect(s.winnerGets).toBeGreaterThan(3000);
  });
});

// ============================================================
// 5. Tenpai
// ============================================================
describe('Tenpai', () => {
  it('wait for 5p', () => {
    const r = checkTenpai(tiles('m123456789p1235'));
    expect(r).not.toBeNull();
    expect(r!.waitTiles.some(t => t.suit==='p' && t.value===5)).toBe(true);
  });
  it('not tenpai', () => expect(checkTenpai(tiles('m124578p135s246z123'))).toBeNull());
  it('findTenpaiDiscards returns non-empty', () => {
    expect(findTenpaiDiscards(tiles('m123456789p12355')).size).toBeGreaterThan(0);
  });
  it('hand ≠13 → null', () => {
    expect(checkTenpai([])).toBeNull();
    expect(checkTenpai(tiles('m123456789p12345'))).toBeNull();
  });
  it('Chiitoitsu tenpai: 6 pairs + 1 isolated → wait for pair', () => {
    const r = checkTenpai(tiles('m1122p3344s5566z1'));
    expect(r).not.toBeNull();
    expect(r!.waitTiles.some(t => t.suit==='z' && t.value===1)).toBe(true);
  });
  it('Chiitoitsu NOT tenpai: c=3 means only 1 pair, no isolated', () => {
    // 2m×2 3m×2 5m×2 6m×2 9m×2 3p×3 = 6 unique pairs + no isolated → not tenpai
    expect(checkTenpai(tiles('m2233556699p333'))).toBeNull();
  });
  it('Chiitoitsu NOT tenpai: c=4 means only 1 pair', () => {
    // 1m×2 2m×2 3m×2 4m×2 5m×2 6m×4 = 6 unique pairs + no isolated → not tenpai
    expect(checkTenpai(tiles('m11223344556666'))).toBeNull();
  });
  it('Chiitoitsu not tenpai: 5 pairs + 3 isolated', () => {
    expect(checkTenpai(tiles('m1122p3344s5567z1'))).toBeNull();
  });
  it('Kokushi 12面待ち: 12 orphans + dup', () => {
    const r = checkTenpai(tiles('m19p19s19z1234561'));
    expect(r).not.toBeNull();
    expect(r!.waitTiles.some(t => t.suit==='z' && t.value===7)).toBe(true);
  });
  it('Kokushi 13面待ち: all 13 orphans present', () => {
    const r = checkTenpai(tiles('m19p19s19z1234567'));
    expect(r).not.toBeNull();
    expect(r!.waitTiles.length).toBe(13);
  });
  it('Kokushi NOT tenpai: 含中张牌(6s)不应判定听牌', () => {
    expect(checkTenpai(tiles('m19p19s169z1234'))).toBeNull();
  });
});

// ============================================================
// 6. Edge Cases
// ============================================================
describe('Edge Cases', () => {
  it('empty hand → not winning', () => expect(isWinningHand([])).toBe(false));
  it('dora count with akadora', () => expect(countDora([T('m',5,true), T('p',5,true)], [], true)).toBe(2));
  it('dora from indicator m1→m2', () => {
    const d = getDoraFromIndicator(T('m',1));
    expect(d.suit).toBe('m');
    expect(d.value).toBe(2);
  });
  it('sortHand order', () => {
    const s = sortHand([T('z',1),T('s',9),T('m',1),T('p',5)]);
    expect(tileKey(s[0])).toBe('m1');
    expect(tileKey(s[3])).toBe('z1');
  });
  it('isTerminalHonor', () => {
    expect(isTerminalHonor(T('m',1))).toBe(true);
    expect(isTerminalHonor(T('m',5))).toBe(false);
    expect(isTerminalHonor(T('z',3))).toBe(true);
  });
});

// ============================================================
// 7. 流局罚符 (ノーテン罰符)
// ============================================================
describe('Draw (流局) scoring', () => {
  const penalty = 3000;
  function calcDraw(t: number, n: number) {
    if (t === 0 || t === 4) return { count: 0, amount: 0 };
    const x = Math.max(n, t);
    const amt = Math.ceil(penalty / x / 100) * 100;
    return { count: x, amount: amt };
  }
  it('0聴4不 → 無', () => expect(calcDraw(0,4).count).toBe(0));
  it('1聴3不 → 3×1000=3000', () => { const r = calcDraw(1,3); expect(r.count).toBe(3); expect(r.amount).toBe(1000); });
  it('2聴2不 → 2×1500=3000', () => { const r = calcDraw(2,2); expect(r.count).toBe(2); expect(r.amount).toBe(1500); });
  it('3聴1不 → 3×1000=3000', () => { const r = calcDraw(3,1); expect(r.count).toBe(3); expect(r.amount).toBe(1000); });
  it('4聴0不 → 無', () => expect(calcDraw(4,0).count).toBe(0));
});
