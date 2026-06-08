/**
 * riichi 库封装 — 替代手写的 checkWin / evaluateHand
 * v2: 支持两立直、一发、宝牌/赤宝牌、里宝牌
 */
import Riichi from 'riichi';
import type { Tile, Meld, GameState, YakuInfo, Wind } from '../game/types';
import { MeldType } from '../game/types';
import type { EvaluationResult } from '../game/hand';

/** 转 riichi 库牌面：赤5用 '0' 表示，自动计赤宝牌 */
function tileStr(t: Tile): string {
  return `${t.isAkadora ? '0' : t.value}${t.suit}`;
}

function meldStr(m: Meld): string {
  const tiles = m.tiles.map(tileStr).join('');
  if (m.type === MeldType.ANKAN) {
    return `[${tileStr(m.tiles[0])}${tileStr(m.tiles[0])}${tileStr(m.tiles[2])}${tileStr(m.tiles[3])}]`;
  }
  return `[${tiles}]`;
}

/** 构建附加选项字符串 */
function optsStr(state: GameState, playerWind: Wind): string {
  const ops: string[] = [];
  const player = state.players[playerWind];

  // 立直类型: w = 两立直, r = 通常立直, 无 = 非立直
  if (player.isDoubleRiichi) {
    ops.push('w');
  } else if (player.isRiichi) {
    ops.push('r');
  }

  // 一发判定：立直后 2 回合内和牌（未被鸣牌打断时有效）
  if (player.isRiichi && player.riichiTurnStart > 0 &&
      state.turn - player.riichiTurnStart <= 2) {
    ops.push('i');
  }

  // 自风+场风: 1=E,2=S,3=W,4=N
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
    // 荣和牌去重
    const allHandTiles = handTiles.filter(t => t.id !== winningTile.id);
    if (isTsumo) allHandTiles.push(winningTile);
    // 暗杠直接混入手牌（riichi 库不认识 [xxxx] 格式）
    const ankanTiles: Tile[] = [];
    const otherMelds: Meld[] = [];
    for (const m of melds) {
      if (m.type === MeldType.ANKAN) ankanTiles.push(...m.tiles);
      else otherMelds.push(m);
    }
    const handStr = allHandTiles.map(tileStr).join('');
    parts.push(handStr);
    // 副露
    for (const m of melds) {
      if (m.type === MeldType.ANKAN) {
        parts.push('+' + tileStr(m.tiles[0]) + tileStr(m.tiles[0]));
      } else if (m.type === MeldType.KAKAN) {
        parts.push('+' + tileStr(m.tiles[0]) + tileStr(m.tiles[0]));
      } else {
        parts.push(meldStr(m));
      }
    }
    // 荣和牌（自摸时已在手牌中）
    if (!isTsumo) parts.push('+' + tileStr(winningTile));

    // ---- 添加宝牌指示牌 ----
    if (gameState.doraIndicators.length > 0) {
      const doraStr = gameState.doraIndicators.map(tileStr).join('');
      parts.push('+d' + doraStr);
    }
    // ---- 添加里宝牌指示牌（立直和牌时） ----
    const winner = gameState.players[playerWind];
    if (winner.isRiichi && gameState.uraDoraIndicators.length > 0) {
      const uraStr = gameState.uraDoraIndicators.map(tileStr).join('');
      parts.push('+d' + uraStr);
    }

    // 选项
    parts.push('+' + optsStr(gameState, playerWind));

    const str = parts.join('');
    const r = new Riichi(str);
    const result = r.calc();

    if (result.error || !result.isAgari) return null;

    const yaku: YakuInfo[] = [];
    const isYakuman = result.yakuman > 0;
    if (result.yaku) {
      for (const [name, hanStr] of Object.entries(result.yaku)) {
        const str = hanStr as string;
        const han = isYakuman ? 0 : (parseInt(str.replace('飜', '')) || 0);
        const id = YAKU_ID_MAP[name] || name.replace(/[ ・]/g, '_').toLowerCase();
        yaku.push({
          id, name, han,
          isYakuman: isYakuman || YAKUMAN_NAMES.has(name),
          isDoubleYakuman: (str.includes('ダブル') || str.includes('W')),
          hanOpen: undefined,
        });
      }
    }

    return {
      yaku,
      totalHan: isYakuman ? result.yakuman * 13 : (result.han || 0),
      fu: isYakuman ? 0 : (result.fu || 0),
      divisions: [],
    };
  } catch (e) {
    console.error('[riichi] error:', e);
    return null;
  }
}
