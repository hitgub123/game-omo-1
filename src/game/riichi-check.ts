/**
 * riichi 库封装 — 替代手写的 checkWin / evaluateHand
 */
import Riichi from 'riichi';
import type { Tile, Meld, GameState, YakuInfo, Wind } from '../game/types';
import { MeldType } from '../game/types';
import type { EvaluationResult } from '../game/hand';

function tileStr(t: Tile): string { return `${t.value}${t.suit}`; }

function meldStr(m: Meld): string {
  const tiles = m.tiles.map(tileStr).join('');
  if (m.type === MeldType.ANKAN) {
    // Ankan: front two tiles face down → [XX..XX]
    return `[${tileStr(m.tiles[0])}${tileStr(m.tiles[0])}${tileStr(m.tiles[2])}${tileStr(m.tiles[3])}]`;
  }
  return `[${tiles}]`;
}

function optsStr(state: GameState, playerWind: Wind): string {
  const ops: string[] = [];
  if (state.players[playerWind].isRiichi) ops.push('r');
  // jikaze-tens, bakaze-ones: 1=E,2=S,3=W,4=N
  ops.push(`${playerWind + 1}${state.roundWind + 1}`);
  return ops.join('');
}

const YAKU_ID_MAP: Record<string, string> = {
  '立直': 'riichi', '一発': 'ippatsu', '門前清自摸和': 'menzen_tsumo',
  '平和': 'pinfu', '断幺九': 'tanyao', '一盃口': 'iipeikou',
  '海底摸月': 'haitei', '河底撈魚': 'houtei', '嶺上開花': 'rinshan', '搶槓': 'chankan',
  '自風 東': 'yakuhai', '自風 南': 'yakuhai', '自風 西': 'yakuhai', '自風 北': 'yakuhai',
  '場風 東': 'yakuhai', '場風 南': 'yakuhai', '場風 西': 'yakuhai', '場風 北': 'yakuhai',
  '白': 'yakuhai', '發': 'yakuhai', '中': 'yakuhai',
  '七対子': 'chiitoitsu', '一気通貫': 'ittsuu', '三色同順': 'sanshoku_doujun',
  '三色同刻': 'sanshoku_doukou', '混全帯么九': 'chanta', '対々和': 'toitoi',
  '三暗刻': 'sanankou', '小三元': 'shousangen', '混老頭': 'honroutou',
  '三槓子': 'sankantsu', '二盃口': 'ryanpeikou', '混一色': 'honiitsu',
  '純全帯么九': 'junchan', '清一色': 'chinitsu',
};

const YAKUMAN_NAMES = new Set([
  '国士無双', '四暗刻', '大三元', '字一色', '緑一色', '清老頭', '九蓮宝燈', '天和', '地和',
]);

export function riichiCheckWin(
  handTiles: Tile[],
  melds: Meld[],
  winningTile: Tile,
  isTsumo: boolean,
  playerWind: Wind,
  gameState: GameState,
): EvaluationResult | null {
  try {
    const parts: string[] = [];
    // 手牌
    parts.push(handTiles.map(tileStr).join(''));
    // 副露
    for (const m of melds) parts.push(meldStr(m));
    // 荣和牌（自摸时已在手牌中）
    if (!isTsumo) parts.push('+' + tileStr(winningTile));
    // 选项
    parts.push('+' + optsStr(gameState, playerWind));

    const str = parts.join('');
    const r = new Riichi(str);
    const result = r.calc();

    if (result.error || !result.isAgari) return null;

    const yaku: YakuInfo[] = [];
    if (result.yaku) {
      for (const [name, hanStr] of Object.entries(result.yaku)) {
        const han = parseInt((hanStr as string).replace('飜', ''));
        const id = YAKU_ID_MAP[name] || name.replace(/[ ・]/g, '_').toLowerCase();
        yaku.push({
          id, name, han,
          isYakuman: YAKUMAN_NAMES.has(name),
          isDoubleYakuman: false,
          hanOpen: undefined,
        });
      }
    }

    return {
      yaku,
      totalHan: result.yakuman > 0 ? result.yakuman * 13 : result.han,
      fu: result.yakuman > 0 ? 0 : result.fu,
      divisions: [],
    };
  } catch (e) {
    console.error('[riichi] error:', e);
    return null;
  }
}
