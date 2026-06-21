/**
 * riichi 库封装 — 替代手写的 checkWin / evaluateHand
 * v2: 支持两立直、一发、宝牌/赤宝牌、里宝牌
 */
import Riichi from '../../utils/riichi-lib/index.js';
import type { Tile, Meld, GameState, YakuInfo, Wind } from '../game/types';
import { MeldType } from '../game/types';
import type { EvaluationResult } from '../game/hand';
import { checkMahjongStatus } from '../../utils/syanten.js';
import { tilesToHai } from './hand';

const LOG_SERVER = 'http://localhost:12345/log';

let _consecutiveFailures = 0;
const MAX_FAILURES = 3;

/** 发送调试信息到日志文件 — 连续 3 次失败后静默，成功后恢复 */
function logDebug(type: string, data: Record<string, unknown>): void {
  if (_consecutiveFailures >= MAX_FAILURES) return;
  try {
    fetch(LOG_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ time: '', type, data }]),
    }).then(() => {
      _consecutiveFailures = 0;
    }).catch(() => {
      _consecutiveFailures++;
    });
  } catch {
    _consecutiveFailures++;
  }
}

/** 转 riichi 库牌面：赤5用 '0' 表示，自动计赤宝牌 */
function tileStr(t: Tile): string {
  return `${t.isAkadora ? '0' : t.value}${t.suit}`;
}

function meldStr(m: Meld): string {
  const suit = m.tiles[0].suit;
  const nums = m.tiles.map(t => tileStr(t).slice(0, -1)).join('');
  return nums + suit;
}

/** 构建附加选项字符串 */
function optsStr(state: GameState, playerWind: Wind): string {
  const ops: string[] = [];
  const player = state.players[playerWind];

  if (player.isDoubleRiichi) {
    ops.push('w');
  } else if (player.isRiichi) {
    ops.push('r');
  }

  if (player.isRiichi && player.riichiTurnStart > 0 &&
      state.turn - player.riichiTurnStart <= 2) {
    ops.push('i');
  }

  if (state.isRinshan) {
    ops.push('k');
  }

  if (state.isLastDraw) {
    ops.push('h');
  }

  ops.push(`${state.roundWind + 1}${playerWind + 1}`);
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

/** syanten 快速判断是否能和（不调 riichi 库算分，用于亮按钮） */
export function canWinBySyanten(
  handTiles: Tile[],
  _melds: Meld[],
  winningTile: Tile,
  isTsumo: boolean,
): boolean {
  const allTiles = handTiles.filter(t => t.id !== winningTile.id);
  if (isTsumo) allTiles.push(winningTile);
  const validationTiles = [...allTiles];
  if (!isTsumo) validationTiles.push(winningTile);
  return checkMahjongStatus(tilesToHai(validationTiles)) === -1;
}

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
    const handStr = allHandTiles.map(tileStr).join('');
    parts.push(handStr);

    // 副露 — 全部带 + 前缀
    for (const m of melds) {
      if (m.type === MeldType.ANKAN) {
        // 暗杠: +44p (数字重复2次+花色1次)
        const val = tileStr(m.tiles[0]).slice(0, -1);
        parts.push('+' + val.repeat(2) + m.tiles[0].suit);
      } else if (m.type === MeldType.KAKAN || m.type === MeldType.KAN) {
        // 明杠/加杠: +7777z (数字重复4次+花色1次)
        const val = tileStr(m.tiles[0]).slice(0, -1);
        parts.push('+' + val.repeat(4) + m.tiles[0].suit);
      } else {
        parts.push('+' + meldStr(m));
      }
    }
    // 荣和牌（自摸时已在手牌中）
    if (!isTsumo) parts.push('+' + tileStr(winningTile));

    // syanten 检查牌型（只传手牌+和牌，不传副露。syanten自能处理暗杠）
    const validationTiles = [...allHandTiles];
    if (!isTsumo) validationTiles.push(winningTile);
    const syantenHai = tilesToHai(validationTiles);
    const syantenResult = checkMahjongStatus(syantenHai);
    logDebug('SYANTEN_INPUT', { tiles: validationTiles.map(tileStr).join(' ') });
    logDebug('SYANTEN_RESULT', { result: JSON.stringify(syantenResult) });
    if (syantenResult !== -1) return null;

    // syanten 说能和 → 调 riichi 库算翻/符/役
    // 选项放dora前面，riichi库按顺序解析
    parts.push('+' + optsStr(gameState, playerWind));

    if (gameState.doraIndicators.length > 0) {
      parts.push('+d' + gameState.doraIndicators.map(tileStr).join(''));
    }
    const winner = gameState.players[playerWind];
    if (winner.isRiichi && gameState.uraDoraIndicators.length > 0) {
      const uraDoras = [...gameState.uraDoraIndicators];
      // 魔理沙八卦炉：每发动一次能力，多翻一张里宝牌
      if (winner.name === '雾雨魔理沙' && winner.abilityUseCount > 0) {
        for (let i = 0; i < winner.abilityUseCount; i++) {
          uraDoras.push(uraDoras[i % uraDoras.length]);
        }
      }
      parts.push('+d' + uraDoras.map(tileStr).join(''));
    }

    const str = parts.join('');
    const r = new Riichi(str);
    const result = r.calc();
    logDebug('RIICHI_INPUT', { str });
    logDebug('RIICHI_RESULT', { isAgari: result.isAgari, yaku: JSON.stringify(result.yaku), han: result.han, fu: result.fu });

    if (result.error) return null;
    if (!result.yakuman && (!result.yaku || Object.keys(result.yaku).length === 0)) {
      logDebug('RIICHI_NO_YAKU', { str });
      return null;
    }

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
