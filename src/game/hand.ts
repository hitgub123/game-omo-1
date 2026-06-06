import type { Tile, TileSuit, Meld, YakuInfo, GameState } from './types';
import { Wind, MeldType } from './types';
import { tileKey, isTerminalHonor, countDora } from './tiles';

export type TileCount = Record<string, number>;

export function getTileCounts(tiles: Tile[]): TileCount {
  const counts: TileCount = {};
  for (const t of tiles) {
    const k = tileKey(t);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

// ---- Group types ----
export interface Group {
  type: 'sequence' | 'triplet' | 'pair';
  tileKey: string;
  suit?: TileSuit;
  value?: number;
}

export interface MahjongDivision {
  pair: Group;
  groups: Group[];
  tileCounts: TileCount;
}

// ---- Recursive search ----
function findGroupDivisions(
  counts: TileCount,
  currentGroups: Group[],
  groupsNeeded: number,
  results: { groups: Group[] }[],
): void {
  const totalRemaining = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalRemaining === 0 && groupsNeeded === 0) {
    results.push({ groups: [...currentGroups] });
    return;
  }
  if (groupsNeeded <= 0 || totalRemaining === 0) return;
  if (totalRemaining < groupsNeeded * 3 || totalRemaining > groupsNeeded * 3) return;

  // Find first tile
  let firstSuit: TileSuit = 'm';
  let firstValue = 10;
  let found = false;
  for (const suit of ['m', 'p', 's', 'z'] as TileSuit[]) {
    const maxVal = suit === 'z' ? 7 : 9;
    for (let v = 1; v <= maxVal; v++) {
      if ((counts[`${suit}${v}`] || 0) > 0) {
        firstSuit = suit;
        firstValue = v;
        found = true;
        break;
      }
    }
    if (found) break;
  }
  if (!found) return;

  const tripKey = `${firstSuit}${firstValue}`;

  // Try triplet
  if ((counts[tripKey] || 0) >= 3) {
    counts[tripKey] -= 3;
    currentGroups.push({ type: 'triplet', tileKey: tripKey, suit: firstSuit, value: firstValue });
    findGroupDivisions(counts, currentGroups, groupsNeeded - 1, results);
    currentGroups.pop();
    counts[tripKey] += 3;
  }

  // Try sequence
  if (firstSuit !== 'z' && firstValue <= 7) {
    const k2 = `${firstSuit}${firstValue + 1}`;
    const k3 = `${firstSuit}${firstValue + 2}`;
    if ((counts[k2] || 0) > 0 && (counts[k3] || 0) > 0) {
      counts[tripKey] -= 1;
      counts[k2] -= 1;
      counts[k3] -= 1;
      currentGroups.push({ type: 'sequence', tileKey: tripKey, suit: firstSuit, value: firstValue });
      findGroupDivisions(counts, currentGroups, groupsNeeded - 1, results);
      currentGroups.pop();
      counts[tripKey] += 1;
      counts[k2] += 1;
      counts[k3] += 1;
    }
  }
}

function meldsToGroups(melds: Meld[]): Group[] {
  return melds.map(m => {
    const tk = tileKey(m.tiles[0]);
    if (m.type === MeldType.CHI) {
      const vals = m.tiles.map(t => t.value);
      return { type: 'sequence' as const, tileKey: tk, suit: m.tiles[0].suit, value: Math.min(...vals) };
    }
    return { type: 'triplet' as const, tileKey: tk, suit: m.tiles[0].suit, value: m.tiles[0].value };
  });
}

export function findMahjongDivisions(tiles: Tile[], melds: Meld[] = []): MahjongDivision[] {
  const meldGroups = meldsToGroups(melds);
  const totalMelds = meldGroups.length;
  const neededGroups = 4 - totalMelds;
  const counts = getTileCounts(tiles);
  const totalRemaining = Object.values(counts).reduce((a, b) => a + b, 0);

  if (totalRemaining !== neededGroups * 3 + 2) return [];

  const results: MahjongDivision[] = [];

  for (const suit of ['m', 'p', 's', 'z'] as TileSuit[]) {
    const maxVal = suit === 'z' ? 7 : 9;
    for (let v = 1; v <= maxVal; v++) {
      const k = `${suit}${v}`;
      if ((counts[k] || 0) >= 2) {
        counts[k] -= 2;
        const pairGroup: Group = { type: 'pair', tileKey: k, suit, value: v };
        const groupResults: { groups: Group[] }[] = [];
        findGroupDivisions(counts, [], neededGroups, groupResults);
        for (const gr of groupResults) {
          results.push({ pair: pairGroup, groups: [...meldGroups, ...gr.groups], tileCounts: { ...counts } });
        }
        counts[k] += 2;
      }
    }
  }

  return results;
}

export function isWinningHand(tiles: Tile[], melds: Meld[] = []): boolean {
  return findMahjongDivisions(tiles, melds).length > 0;
}

// ---- Tenpai ----
export interface TenpaiInfo {
  waitTiles: Tile[];
  divisions: MahjongDivision[];
}

export function checkTenpai(hand: Tile[], melds: Meld[] = []): TenpaiInfo | null {
  if (hand.length !== 13) return null;
  const waitTiles: Tile[] = [];
  let allDivisions: MahjongDivision[] = [];

  for (const suit of ['m', 'p', 's', 'z'] as TileSuit[]) {
    const maxVal = suit === 'z' ? 7 : 9;
    for (let v = 1; v <= maxVal; v++) {
      const existingCount = hand.filter(t => t.suit === suit && t.value === v).length;
      if (existingCount >= 4) continue;
      const testTile: Tile = { id: -1, suit, value: v };
      const testHand = [...hand, testTile];
      const divisions = findMahjongDivisions(testHand, melds);
      if (divisions.length > 0) {
        waitTiles.push(testTile);
        allDivisions = [...allDivisions, ...divisions];
      }
    }
  }

  if (waitTiles.length === 0) return null;
  return { waitTiles, divisions: allDivisions };
}

export function findTenpaiDiscards(hand: Tile[], melds: Meld[] = []): Map<number, TenpaiInfo> {
  const result = new Map<number, TenpaiInfo>();
  for (let i = 0; i < hand.length; i++) {
    const remaining = [...hand.slice(0, i), ...hand.slice(i + 1)];
    if (remaining.length === 13) {
      const tenpai = checkTenpai(remaining, melds);
      if (tenpai) result.set(hand[i].id, tenpai);
    }
  }
  return result;
}

// ---- Yaku Context ----
export interface YakuContext {
  isRiichi: boolean;
  isIppatsu: boolean;
  isDoubleRiichi: boolean;
  isTsumo: boolean;
  isRinshan: boolean;
  isChankan: boolean;
  isHaitei: boolean;
  isHoutei: boolean;
  isTenhou: boolean;
  isChihou: boolean;
  roundWind: Wind;
  playerWind: Wind;
  honba: number;
  riichiSticks: number;
  hasCalled: boolean;
  winningTile: Tile;
  melds: Meld[];
  handTiles: Tile[];
  allTiles: Tile[];
  winGroup: Group[];
  pairGroup: Group;
  doraCount: number;         // 宝牌翻数
  doraIndicators: Tile[];    // 宝牌指示牌
}

// ---- Fu calculation ----
function checkPinfuShape(ctx: YakuContext): boolean {
  if (ctx.hasCalled) return false;
  for (const g of ctx.winGroup) {
    if (g.type !== 'sequence') return false;
  }
  const pSuit = ctx.pairGroup.tileKey[0];
  if (pSuit === 'z') return false;
  return true;
}

function fuCalc(ctx: YakuContext): number {
  const hasChiitoi = ctx.winGroup.length === 0;
  if (hasChiitoi) return 25;

  let fu = 20;
  if (!ctx.isTsumo && !ctx.hasCalled) fu += 10;
  if (ctx.isTsumo) {
    if (!checkPinfuShape(ctx)) fu += 2;
  }

  for (const g of ctx.winGroup) {
    if (g.type !== 'triplet') continue;
    const suit = g.tileKey[0] as TileSuit;
    const val = parseInt(g.tileKey[1]);
    const isTerminal = suit === 'z' || val === 1 || val === 9;
    const isConcealed = !ctx.melds.some(m =>
      (m.type === MeldType.PON || m.type === MeldType.KAN) && tileKey(m.tiles[0]) === g.tileKey
    );
    const isKan = ctx.melds.some(m =>
      (m.type === MeldType.KAN || m.type === MeldType.ANKAN || m.type === MeldType.KAKAN) &&
      tileKey(m.tiles[0]) === g.tileKey
    );
    if (isKan) {
      fu += isConcealed ? (isTerminal ? 32 : 16) : (isTerminal ? 16 : 8);
    } else {
      fu += isConcealed ? (isTerminal ? 8 : 4) : (isTerminal ? 4 : 2);
    }
  }

  const pSuit = ctx.pairGroup.tileKey[0] as TileSuit;
  const pVal = parseInt(ctx.pairGroup.tileKey[1]);
  if (pSuit === 'z') {
    if (pVal >= 5) fu += 2;
    else if (pVal === ctx.playerWind + 1) fu += 2;
    else if (pVal === ctx.roundWind + 1) fu += 2;
  }

  return Math.ceil(fu / 10) * 10;
}

// ---- Yaku checks ----
function checkKokushi(ctx: YakuContext): boolean {
  const required: string[] = [];
  for (const suit of ['m', 'p', 's'] as TileSuit[]) {
    required.push(`${suit}1`, `${suit}9`);
  }
  for (let v = 1; v <= 7; v++) required.push(`z${v}`);
  const counts = getTileCounts(ctx.allTiles);
  for (const r of required) {
    if (!counts[r] || counts[r] < 1) return false;
  }
  return ctx.allTiles.length === 14;
}

function checkSuuankou(ctx: YakuContext): boolean {
  if (ctx.hasCalled) return false;
  return ctx.winGroup.filter(g => g.type === 'triplet').length === 4;
}

function checkDaisangen(ctx: YakuContext): boolean {
  const found = new Set(ctx.winGroup.filter(g => g.type === 'triplet' && g.tileKey >= 'z5').map(g => g.tileKey));
  return found.has('z5') && found.has('z6') && found.has('z7');
}

function checkTsuuiisou(ctx: YakuContext): boolean {
  return ctx.allTiles.every(t => t.suit === 'z');
}

function checkRyuuiisou(ctx: YakuContext): boolean {
  const green = new Set(['s2','s3','s4','s6','s8','z6']);
  return ctx.allTiles.every(t => green.has(tileKey(t)));
}

function checkChinroutou(ctx: YakuContext): boolean {
  return ctx.allTiles.every(t => t.suit !== 'z' && (t.value === 1 || t.value === 9));
}

function checkChuuren(ctx: YakuContext): boolean {
  if (ctx.hasCalled) return false;
  const suits = new Set(ctx.allTiles.map(t => t.suit));
  if (suits.size !== 1) return false;
  const suit = [...suits][0];
  if (suit === 'z') return false;
  const counts = getTileCounts(ctx.allTiles);
  if ((counts[`${suit}1`] || 0) < 3) return false;
  if ((counts[`${suit}9`] || 0) < 3) return false;
  for (let i = 2; i <= 8; i++) {
    if ((counts[`${suit}${i}`] || 0) < 1) return false;
  }
  return true;
}

function checkIttsuu(ctx: YakuContext): boolean {
  const seqs = ctx.winGroup.filter(g => g.type === 'sequence') as Group[];
  for (const suit of ['m', 'p', 's'] as TileSuit[]) {
    const vals = seqs.filter(s => s.suit === suit).map(s => s.value || 0);
    if (vals.includes(1) && vals.includes(4) && vals.includes(7)) return true;
  }
  return false;
}

function checkChanta(ctx: YakuContext, pure: boolean): boolean {
  for (const g of ctx.winGroup) {
    if (g.type === 'sequence') {
      if (g.value !== 1 && g.value !== 7) return false;
    } else if (g.type === 'triplet') {
      const s = g.tileKey[0] as TileSuit;
      const v = parseInt(g.tileKey[1]);
      if (s === 'z') { if (pure) return false; }
      else if (v !== 1 && v !== 9) return false;
    }
  }
  const pSuit = ctx.pairGroup.tileKey[0] as TileSuit;
  const pVal = parseInt(ctx.pairGroup.tileKey[1]);
  if (pSuit === 'z') { if (pure) return false; }
  else if (pVal !== 1 && pVal !== 9) return false;
  if (ctx.allTiles.every(t => isTerminalHonor(t))) return false;
  return true;
}

function checkSanankou(ctx: YakuContext): boolean {
  let concealed = 0;
  for (const g of ctx.winGroup) {
    if (g.type === 'triplet') {
      const inMeld = ctx.melds.some(m =>
        (m.type === MeldType.PON || m.type === MeldType.KAN) &&
        tileKey(m.tiles[0]) === g.tileKey
      );
      if (!inMeld) concealed++;
    }
  }
  return concealed >= 3;
}

function checkShousangen(ctx: YakuContext): boolean {
  const dragonTriplets = ctx.winGroup.filter(g => g.type === 'triplet' && g.tileKey >= 'z5').length;
  const pairIsDragon = ctx.pairGroup.tileKey >= 'z5' && ctx.pairGroup.tileKey[0] === 'z';
  return dragonTriplets >= 2 && pairIsDragon;
}

function checkHonitsu(ctx: YakuContext): boolean {
  const suits = new Set(ctx.allTiles.map(t => t.suit));
  return suits.size === 2 && suits.has('z');
}

function checkChinitsu(ctx: YakuContext): boolean {
  const suits = new Set(ctx.allTiles.map(t => t.suit));
  return suits.size === 1 && !suits.has('z');
}

function checkRyanpeikou(ctx: YakuContext): boolean {
  if (ctx.hasCalled) return false;
  const seqs = ctx.winGroup.filter(g => g.type === 'sequence');
  const seqCounts = new Map<string, number>();
  for (const s of seqs) {
    const k = `${s.suit}${s.value}`;
    seqCounts.set(k, (seqCounts.get(k) || 0) + 1);
  }
  const pairs = [...seqCounts.values()].filter(c => c >= 2);
  return pairs.length >= 2 && seqs.length === 4;
}

function checkYakuhaiTriplets(ctx: YakuContext): YakuInfo | null {
  let han = 0;
  const names: string[] = [];
  for (const g of ctx.winGroup) {
    if (g.type !== 'triplet') continue;
    const s = g.tileKey[0] as TileSuit;
    const v = parseInt(g.tileKey[1]);
    if (s === 'z') {
      if (v >= 5) { han += 1; names.push(['白','發','中'][v - 5]); }
      if (v === ctx.roundWind + 1) { han += 1; names.push('圈风'); }
      if (v === ctx.playerWind + 1) { han += 1; names.push('自风'); }
    }
  }
  if (han > 0) {
    return { id: 'yakuhai', name: `役牌(${names.join('·')})`, han, isYakuman: false, isDoubleYakuman: false };
  }
  return null;
}

// ---- Evaluation ----
export interface EvaluationResult {
  yaku: YakuInfo[];
  totalHan: number;
  fu: number;
  divisions: MahjongDivision[];
}

export function evaluateHand(
  context: Omit<YakuContext, 'winGroup' | 'pairGroup'>,
  divisions: MahjongDivision[],
): EvaluationResult[] {
  if (divisions.length === 0) return [];
  const results: EvaluationResult[] = [];

  for (const div of divisions) {
    const ctx: YakuContext = { ...context, winGroup: div.groups, pairGroup: div.pair };
    const yaku: YakuInfo[] = [];

    const yakuhaiResult = checkYakuhaiTriplets(ctx);
    if (yakuhaiResult) yaku.push(yakuhaiResult);

    // Run all yaku checks
    const checkRiichi = () => ctx.isRiichi ? { id: 'riichi', name: '立直', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkIppatsu = () => ctx.isIppatsu ? { id: 'ippatsu', name: '一发', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkDaburu = () => ctx.isDoubleRiichi ? { id: 'daburu_riichi', name: '两立直', han: 2, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkTsumo = () => (ctx.isTsumo && !ctx.hasCalled) ? { id: 'menzen_tsumo', name: '门前清自摸和', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkPinfu = () => (!ctx.hasCalled && checkPinfuShape(ctx)) ? { id: 'pinfu', name: '平和', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkTanyao = () => ctx.allTiles.every(t => !isTerminalHonor(t)) ? { id: 'tanyao', name: '断幺九', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkHaitei = () => ctx.isHaitei ? { id: 'haitei', name: '海底摸月', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkHoutei = () => ctx.isHoutei ? { id: 'houtei', name: '河底捞鱼', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkRinshan = () => ctx.isRinshan ? { id: 'rinshan', name: '岭上开花', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkChankan = () => ctx.isChankan ? { id: 'chankan', name: '枪杠', han: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;

    const checkSanshoku = () => {
      const seqs = ctx.winGroup.filter(g => g.type === 'sequence') as Group[];
      for (const s of seqs) {
        const same = seqs.filter(s2 => s2.suit !== s.suit && s2.value === s.value);
        if (same.length >= 2) {
          return { id: 'sanshoku_doujun', name: '三色同顺', han: ctx.hasCalled ? 1 : 2, hanOpen: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo;
        }
      }
      return null;
    };
    const checkIttsuuYaku = () => checkIttsuu(ctx) ? { id: 'ittsuu', name: '一气通贯', han: ctx.hasCalled ? 1 : 2, hanOpen: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkChantaYaku = () => checkChanta(ctx, false) ? { id: 'chanta', name: '混全带幺九', han: ctx.hasCalled ? 1 : 2, hanOpen: 1, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkToitoi = () => ctx.winGroup.every(g => g.type === 'triplet') ? { id: 'toitoi', name: '对对和', han: 2, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkSanankouYaku = () => checkSanankou(ctx) ? { id: 'sanankou', name: '三暗刻', han: 2, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkSangenYaku = () => checkShousangen(ctx) ? { id: 'shousangen', name: '小三元', han: 2, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkHonroutou = () => {
      if (ctx.allTiles.every(t => isTerminalHonor(t)) && ctx.allTiles.some(t => t.suit === 'z')) {
        return { id: 'honroutou', name: '混老头', han: 2, isYakuman: false, isDoubleYakuman: false } as YakuInfo;
      }
      return null;
    };
    const chkHonitsu = () => checkHonitsu(ctx) ? { id: 'honiitsu', name: '混一色', han: ctx.hasCalled ? 2 : 3, hanOpen: 2, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkJunchan = () => checkChanta(ctx, true) ? { id: 'junchan', name: '纯全带幺九', han: ctx.hasCalled ? 2 : 3, hanOpen: 2, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const checkRyanpeikouYaku = () => checkRyanpeikou(ctx) ? { id: 'ryanpeikou', name: '二杯口', han: 3, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;
    const chkChinitsu = () => checkChinitsu(ctx) ? { id: 'chinitsu', name: '清一色', han: ctx.hasCalled ? 5 : 6, hanOpen: 5, isYakuman: false, isDoubleYakuman: false } as YakuInfo : null;

    // Yakuman
    const checkKokushiYaku = () => checkKokushi(ctx) ? { id: 'kokushi', name: '国士无双', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkSuuankouYaku = () => checkSuuankou(ctx) ? { id: 'suuankou', name: '四暗刻', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkDaisangenYaku = () => checkDaisangen(ctx) ? { id: 'daisangen', name: '大三元', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkTsuuiisouYaku = () => checkTsuuiisou(ctx) ? { id: 'tsuuiisou', name: '字一色', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkRyuuiisouYaku = () => checkRyuuiisou(ctx) ? { id: 'ryuuiisou', name: '绿一色', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkChinroutouYaku = () => checkChinroutou(ctx) ? { id: 'chinroutou', name: '清老头', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkChuurenYaku = () => checkChuuren(ctx) ? { id: 'chuuren', name: '九莲宝灯', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkTenhouYaku = () => ctx.isTenhou ? { id: 'tenhou', name: '天和', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;
    const checkChihouYaku = () => ctx.isChihou ? { id: 'chihou', name: '地和', han: 0, isYakuman: true, isDoubleYakuman: false } as YakuInfo : null;

    const checks = [
      checkTenhouYaku, checkChihouYaku, checkKokushiYaku, checkSuuankouYaku,
      checkDaisangenYaku, checkTsuuiisouYaku, checkRyuuiisouYaku,
      checkChinroutouYaku, checkChuurenYaku,
      checkDaburu, checkRiichi, checkIppatsu, checkTsumo, checkPinfu,
      checkTanyao, checkHaitei, checkHoutei, checkRinshan, checkChankan,
      checkSanshoku, checkIttsuuYaku, checkChantaYaku, checkToitoi,
      checkSanankouYaku, checkSangenYaku, checkHonroutou, chkHonitsu,
      checkJunchan, checkRyanpeikouYaku, chkChinitsu,
    ];

    for (const check of checks) {
      try {
        const r = check();
        if (r) {
          if (r.id === 'riichi' && yaku.some(y => y.id === 'daburu_riichi')) continue;
          if (r.id === 'daburu_riichi' && yaku.some(y => y.id === 'riichi')) continue;
          yaku.push(r);
        }
      } catch { /* skip failed checks */ }
    }

    const yakumanCount = yaku.filter(y => y.isYakuman).length;
    if (yakumanCount > 0) {
      const totalHan = yakumanCount * 13;
      const fu = ctx.isTsumo ? 20 : 25;
      results.push({ yaku, totalHan, fu, divisions: [div] });
      continue;
    }

    const totalHan = yaku.reduce((sum, y) => sum + (y.hanOpen !== undefined && ctx.hasCalled ? y.hanOpen : y.han), 0);
    const doraHan = ctx.doraCount || 0;

    // 有役（非宝牌）才有和牌资格
    if (totalHan > 0) {
      if (doraHan > 0) {
        yaku.push({ id: 'dora', name: `宝牌${doraHan}`, han: doraHan, isYakuman: false, isDoubleYakuman: false });
      }
      const finalHan = totalHan + doraHan;
      const fu = fuCalc(ctx);
      results.push({ yaku, totalHan: finalHan, fu, divisions: [div] });
    }
  }

  results.sort((a, b) => (b.totalHan * 100 + b.fu) - (a.totalHan * 100 + a.fu));
  return results.slice(0, 1);
}

// ---- Main API ----
export function checkWin(
  handTiles: Tile[],
  melds: Meld[],
  winningTile: Tile,
  isTsumo: boolean,
  playerWind: Wind,
  gameState: GameState,
): EvaluationResult | null {
  const allTiles = [...handTiles];
  if (!allTiles.some(t => t.id === winningTile.id)) {
    allTiles.push(winningTile);
  }

  const baseCtx = {
    isRiichi: gameState.players[playerWind].isRiichi,
    isIppatsu: false,
    isDoubleRiichi: false,
    isTsumo,
    isRinshan: false,
    isChankan: false,
    isHaitei: false,
    isHoutei: false,
    isTenhou: false,
    isChihou: false,
    roundWind: gameState.roundWind,
    playerWind,
    honba: gameState.honba,
    riichiSticks: gameState.riichiSticks,
    hasCalled: melds.length > 0,
    winningTile,
    melds,
    handTiles,
    allTiles,
    doraCount: 0, // filled below
  } as Omit<YakuContext, 'winGroup' | 'pairGroup'> & { doraCount: number };

  // 计算宝牌
  const doraHan = countDora(allTiles, gameState.doraIndicators, true);
  baseCtx.doraCount = doraHan;

  // Kokushi check
  const kokushiCtx: YakuContext = { ...baseCtx, winGroup: [], pairGroup: { type: 'pair', tileKey: '' } };
  if (checkKokushi(kokushiCtx)) {
    return { yaku: [{ id: 'kokushi', name: '国士无双', han: 0, isYakuman: true, isDoubleYakuman: false }], totalHan: 13, fu: 25, divisions: [] };
  }

  // Chiitoi check
  if (allTiles.length === 14 && melds.length === 0) {
    const counts = getTileCounts(allTiles);
    const pairs = Object.entries(counts).filter(([_, c]) => c === 2);
    if (pairs.length === 7) {
      return { yaku: [{ id: 'chiitoitsu', name: '七对子', han: 2, isYakuman: false, isDoubleYakuman: false }], totalHan: 2, fu: 25, divisions: [] };
    }
  }

  const divisions = findMahjongDivisions(allTiles, melds);
  if (divisions.length === 0) return null;

  const results = evaluateHand(baseCtx, divisions);
  return results.length > 0 ? results[0] : null;
}
