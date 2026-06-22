import type { Tile, Meld, GameState, Player, AvailableActions, ChiOption, HandResult, WinResult } from './types';
import { Wind, MeldType, GamePhase, TOUHOU_CHARACTERS, INITIAL_SCORE, WINDS, DEFAULT_ENERGY_MAX, DEFAULT_ENERGY_PER_DISCARD, DEFAULT_ENERGY_PER_DRAW, DEFAULT_ENERGY_PER_MELD, DEFAULT_ENERGY_PER_RIICHI, DEFAULT_ENERGY_PER_WIN, DEFAULT_SWAP_ENERGY_COST } from './types';
import { createTileDeck, shuffleArray, sortHand, tileKey, findTiles, isTerminalHonor } from './tiles';
import { checkTenpai, isWinningHand, tilesToHai } from './hand';
import { checkMahjongStatus } from '../../utils/syanten.js';
import { riichiCheckWin as checkWin } from './riichi-check';
import { calculateScore, calculatePayouts } from './scoring';
import { debugLog } from '../debug/debugLog';
import { getAllRequirements, tryMakeTenpai } from './abilities';

export function createInitialState(characters?: { name: string }[], dealerWind?: Wind, gameLength = 4, initialScore = INITIAL_SCORE): GameState {
  const deck = shuffleArray(createTileDeck());
  const deadWall = deck.slice(0, 14);
  const wall = deck.slice(14);
  const doraIndicators = [deadWall[4]];

  // 随机庄家
  const actualDealer = dealerWind ?? Math.floor(Math.random() * 4) as Wind;

  const players: Player[] = WINDS.map((wind) => ({
    name: characters ? characters[wind].name : TOUHOU_CHARACTERS[wind].name,
    wind,
    hand: [],
    melds: [],
    discards: [],
    discardsSize: 0,
    isRiichi: false,
    isDoubleRiichi: false,
    riichiDiscardIndex: -1,
    riichiTurnStart: -1,
    score: initialScore,
    isDealer: wind === actualDealer,
    isHuman: wind === Wind.EAST,
    tenpai: false,
    hasCalled: false,
    restrictedDiscardKeys: [],
    energy: 0,  // 每局开始重置（组队模式由 useGame 恢复）
    energyMax: DEFAULT_ENERGY_MAX,
    energyPerDiscard: DEFAULT_ENERGY_PER_DISCARD,
    energyPerDraw: DEFAULT_ENERGY_PER_DRAW,
    energyPerMeld: DEFAULT_ENERGY_PER_MELD,
    energyPerRiichi: DEFAULT_ENERGY_PER_RIICHI,
    energyPerWin: DEFAULT_ENERGY_PER_WIN,
    abilityUseCount: 0,
    swapEnergyCost: DEFAULT_SWAP_ENERGY_COST,
    frozenByCirno: false,
    skipNextDraw: false,
    hideDiscards: 0,
    seeNextDraw: false,
    abilityUsedThisHand: 0,
    dollCount: 0,
    deathDoraIds: [],
    jokerSuit: null,
  }));

  // 配牌：先处理能力需求，再随机分配剩余牌
  const playerNames = players.map(p => p.name);
  const playerUseCounts = players.map(p => p.abilityUseCount);
  const requirements = getAllRequirements(playerNames, playerUseCounts);

  if (requirements.length > 0) {
    // 有配牌需求：从牌山中预留给对应玩家
    const wallPool = [...wall];
    const reserved: { wind: number; tiles: Tile[]; playerIndex?: number }[] = [];

    // ── 第一步：处理配牌即听牌，必须最先从完整牌山拿牌 ──
    for (const req of requirements) {
      if (req.tenpai) {
        const result = tryMakeTenpai([], wallPool); // 空手牌，从完整牌山构建
        if (result.used > 0) {
          reserved.push({ wind: req.wind, tiles: result.hand, playerIndex: req.playerIndex });
        }
      }
    }

    // ── 第二步：处理普通配牌需求 ──
    for (const req of requirements) {
      if (req.tenpai) continue; // 已在上一步处理
      const taken: Tile[] = [];
      const gs = req.groupSize || 1;
      // 按组处理：每组必须全部找到才取，否则全组跳过
      for (let g = 0; g < req.tiles.length; g += gs) {
        const group = req.tiles.slice(g, g + gs);
        const groupTiles: Tile[] = [];
        const poolCopy = [...wallPool];
        let allFound = true;
        for (const rt of group) {
          const idx = poolCopy.findIndex(t => t.suit === rt.suit && t.value === rt.value);
          if (idx >= 0) {
            groupTiles.push(poolCopy[idx]);
            poolCopy.splice(idx, 1);
          } else {
            allFound = false;
            break;
          }
        }
        if (allFound) {
          // 全组找到，正式从 wallPool 中移除
          for (const rt of group) {
            const idx = wallPool.findIndex(t => t.suit === rt.suit && t.value === rt.value);
            if (idx >= 0) {
              taken.push(wallPool[idx]);
              wallPool.splice(idx, 1);
            }
          }
        }
      }
      if (taken.length > 0) {
        reserved.push({ wind: req.wind, tiles: taken, playerIndex: req.playerIndex });
      }
    }

    // 先给有需求的玩家发预留牌，再随机发剩余
    const remaining = shuffleArray(wallPool);

    // 按优先级发预留牌（reserved 已按 useCount 降序）
    // wind < 0: 大妖精等特殊需求，牌不进入手牌而是用作限制标记
    for (const r of reserved) {
      if (r.wind < 0) {
        // wind=-2: 对其他3位玩家的 restrictedDiscardKeys 各加牌
        const abilityUser = r.playerIndex ?? 0;
        for (let j = 0; j < 4; j++) {
          if (j === abilityUser) continue;
          const keys = r.tiles.map(t => `${t.value}${t.suit}`);
          players[j].restrictedDiscardKeys = [...new Set([...players[j].restrictedDiscardKeys, ...keys])];
        }
      } else {
        players[r.wind].hand = [...r.tiles];
      }
    }

    // 补足到13张
    let ri = 0;
    for (let i = 0; i < 4; i++) {
      const needed = 13 - players[i].hand.length;
      if (needed > 0) {
        players[i].hand.push(...remaining.slice(ri, ri + needed));
        ri += needed;
      }
      players[i].hand = sortHand(players[i].hand);
    }

    // 配牌完成，重置能力计数
    for (const p of players) p.abilityUseCount = 0;

    const remainingWall = remaining.slice(ri);
    return {
      wall: remainingWall,
      deadWall,
      doraIndicators,
      uraDoraIndicators: [deadWall[5]],
      players,
      currentPlayer: actualDealer,
      turn: 0,
      phase: GamePhase.DRAWING,
      roundWind: Wind.EAST,
      honba: 0,
      riichiSticks: 0,
      kanCount: 0,
      handCount: 0,
      actionsAvailable: WINDS.map(() => emptyActions()),
      turnHistory: [],
      dealerIndex: actualDealer,
      furitenPlayers: [],
      claimedDiscardTileIds: [],
      gameLength,
      reimuCharm: false,
      sniperReserve: null,
      totalAbilityUses: 0,
      seeAllHands: false,
    };
  }

  // 无配牌需求：原逻辑
  let idx = 0;
  for (let i = 0; i < 4; i++) {
    players[i].hand = sortHand(wall.slice(idx, idx + 13));
    idx += 13;
  }
  const remainingWall = wall.slice(idx);

  return {
    wall: remainingWall,
    deadWall,
    doraIndicators,
    uraDoraIndicators: [deadWall[5]],
    players,
    currentPlayer: actualDealer,
    turn: 0,
    phase: GamePhase.DRAWING,
    roundWind: Wind.EAST,
    honba: 0,
    riichiSticks: 0,
    kanCount: 0,
    handCount: 0,
    actionsAvailable: WINDS.map(() => emptyActions()),
    turnHistory: [],
    dealerIndex: actualDealer,
    furitenPlayers: [],
    claimedDiscardTileIds: [],
    gameLength,
    reimuCharm: false,
    sniperReserve: null,
    totalAbilityUses: 0,
    seeAllHands: false,
  };
}

// ---- Draw ----
export function drawTile(state: GameState): GameState {
  if (state.wall.length === 0) return executeDraw(state);

  // 铃仙狙击：如果预留了牌且当前玩家是目标，从牌山中找牌
  let wall = [...state.wall];
  let drawnTile: Tile;
  let sniperUsed = false;

  if (state.sniperReserve && state.sniperReserve.targetWind === state.currentPlayer) {
    const { suit, value } = state.sniperReserve;
    const idx = wall.findIndex(t => t.suit === suit && t.value === value);
    if (idx >= 0) {
      drawnTile = wall[idx];
      wall.splice(idx, 1);
      sniperUsed = true;
    } else {
      drawnTile = wall.shift()!;
    }
  } else {
    drawnTile = wall.shift()!;
  }

  const isLastDraw = wall.length === 0;
  const players = state.players.map(p => ({ ...p, hand: [...p.hand] }));
  const player = players[state.currentPlayer];
  player.hand = [...player.hand, drawnTile];

  const actions = getDrawActions(player, state, state.currentPlayer, drawnTile);
  const hasActions = actions.canRiichi || actions.canTsumo || actions.canAnkan || actions.canKakan || actions.canNineOrphans;
  // console.log(`[DRAW] ${player.name}(${state.currentPlayer}) 摸牌 牌山:${wall.length} 手牌:${player.hand.length} 有动作:${hasActions}`);

  return {
    ...state,
    wall,
    players,
    drawnTile,
    phase: hasActions ? GamePhase.ACTION_PROMPT : GamePhase.DISCARDING,
    actionsAvailable: WINDS.map((_, i) => i === state.currentPlayer ? actions : emptyActions()),
    turn: state.turn + 1,
    turnHistory: [...state.turnHistory, { type: 'draw' as const, player: state.currentPlayer, tile: drawnTile }],
    furitenPlayers: state.furitenPlayers.filter(p => {
      // 立直玩家的永久振听不因摸牌解除（见逃后整局不能荣和）
      // 非立直玩家轮到自己摸牌时临时振听解除
      if (p === state.currentPlayer && !state.players[p].isRiichi) return false;
      return true;
    }),
    isRinshan: false,
    isLastDraw,
    sniperReserve: sniperUsed ? null : state.sniperReserve,
  };
}

export function getDrawActions(player: Player, state: GameState, playerWind: Wind, drawnTile: Tile): AvailableActions {
  const actions: AvailableActions = {
    canChi: false, chiOptions: [], canPon: false, canKan: false,
    canRon: false, canTsumo: false, canRiichi: false, canAnkan: false,
    canKakan: false, canNineOrphans: false,
  };

  if (drawnTile) {
    // 立直玩家和非立直玩家统一用 checkWin 判定（避免 isWinningHand 和 riichiCheckWin 不一致）
    const winCheck = checkWin(player.hand, player.melds, drawnTile, true, playerWind, state);
    actions.canTsumo = winCheck !== null;
    if (!winCheck && drawnTile) {
      console.debug('[BUG] tsumo check failed', {
        hand: player.hand.map(t => t.suit + t.value).join(''),
        drawnTile: drawnTile.suit + drawnTile.value,
        meldCount: player.melds.length,
        handLen: player.hand.length,
        hasKakan: player.melds.some(m => m.type === 'pon' && player.hand.some(t => t.suit === m.tiles[0].suit && t.value === m.tiles[0].value)),
      });
    }
  }

  // ── [DEBUG] 立直按钮判定日志 → game.log ──
  const riichiReasons: string[] = [];
  if (!player.hasCalled && !player.isRiichi && state.wall.length >= 4 && player.score >= 1000) {
    const engResult = checkMahjongStatus(tilesToHai(player.hand));
    const isTenpai = typeof engResult === 'object' || engResult === -1;
    actions.canRiichi = isTenpai;
    if (isTenpai) {
      riichiReasons.push('手牌听牌(门清+够1000点+牌山>=4)');
      if (typeof engResult === 'object') {
        const infoCount = (engResult as any).info?.length ?? 0;
        riichiReasons.push(`听牌选择数=${infoCount}`);
      } else if (engResult === -1) {
        riichiReasons.push('已和牌形(可打一张弃和立直)');
      }
    } else {
      riichiReasons.push(`听牌NG: syanten返回${JSON.stringify(engResult)}`);
    }
  } else {
    if (player.hasCalled) riichiReasons.push('已鸣牌(非门清)');
    if (player.isRiichi) riichiReasons.push('已立直');
    if (state.wall.length < 4) riichiReasons.push(`牌山不足4张(当前${state.wall.length})`);
    if (player.score < 1000) riichiReasons.push(`分数不足1000点(当前${player.score})`);
  }
  debugLog('RIICHI_CHECK', {
    player: player.name,
    wind: playerWind,
    canRiichi: actions.canRiichi,
    reason: riichiReasons.join(' | ') || '无',
    hasCalled: player.hasCalled,
    isRiichi: player.isRiichi,
    wall: state.wall.length,
    score: player.score,
  });

  if (!player.hasCalled && state.turn === 0) {
    const uniqueTermHonors = new Set(player.hand.filter(t => isTerminalHonor(t)).map(t => tileKey(t)));
    actions.canNineOrphans = uniqueTermHonors.size >= 9;
  }

  const tileCounts = new Map<string, Tile[]>();
  for (const t of player.hand) {
    const k = tileKey(t);
    if (!tileCounts.has(k)) tileCounts.set(k, []);
    tileCounts.get(k)!.push(t);
  }
  for (const [, tiles] of tileCounts) {
    if (tiles.length >= 4) {
      actions.canAnkan = true;
      if (player.isRiichi) {
        // 立直后暗杠：杠材不能参与其他面子
        const hand13 = player.hand.filter(t => t.id !== state.drawnTile?.id);
        const beforeTenpai = checkTenpai(hand13);
        const withoutKan = player.hand.filter(t => !tiles.some(k => k.id === t.id));
        const dummy = [
          { id: -1, suit: tiles[0].suit, value: tiles[0].value },
          { id: -2, suit: tiles[0].suit, value: tiles[0].value },
          { id: -3, suit: tiles[0].suit, value: tiles[0].value },
        ];
        const afterKan = [...withoutKan, ...dummy];
        const afterTenpai = checkTenpai(afterKan);
        // 杠后不听牌 或 等待牌变了 → 不能杠
        if (!afterTenpai || !beforeTenpai) {
          actions.canAnkan = false;
        } else {
          const beforeWaits = new Set(beforeTenpai.waitTiles.map(t => t.suit + t.value));
          const afterWaits = new Set(afterTenpai.waitTiles.map(t => t.suit + t.value));
          if (beforeWaits.size !== afterWaits.size || [...beforeWaits].some(w => !afterWaits.has(w))) {
            actions.canAnkan = false;
          }
        }
      }
      break;
    }
  }
  for (const meld of player.melds) {
    if (meld.type === MeldType.PON) {
      if (player.hand.some(t => tileKey(t) === tileKey(meld.tiles[0]))) {
        actions.canKakan = true;
        break;
      }
    }
  }

  return actions;
}

// ---- Discard ----
export function discardTile(state: GameState, tileId: number): GameState {
  const players = state.players.map(p => ({ ...p, hand: [...p.hand], discards: [...p.discards] }));
  const player = players[state.currentPlayer];
  const idx = player.hand.findIndex(t => t.id === tileId);
  if (idx === -1) return state;

  const discarded = player.hand.splice(idx, 1)[0];
  player.hand = sortHand(player.hand);

  // 能量槽：弃牌 +energyPerDiscard
  player.energy = Math.min(player.energyMax, player.energy + player.energyPerDiscard);

  // 食替检查：不能打出鸣牌所关联的牌
  const tileKey_ = `${discarded.value}${discarded.suit}`;
  if (player.restrictedDiscardKeys.length > 0 && player.restrictedDiscardKeys.includes(tileKey_)) {
    player.hand.push(discarded);
    player.hand = sortHand(player.hand);
    return state; // 拒绝弃牌，状态不变
  }
  if (player.isRiichi && player.riichiDiscardIndex === -1) {
    player.riichiDiscardIndex = player.discards.length;
  }
  player.discards.push(discarded);

  // ── 梅蒂欣毒素：其他角色弃牌时-2能量 ──
  for (const p of players) {
    if (p.name === '梅蒂欣·梅兰可莉' && p.wind !== state.currentPlayer) {
      players[state.currentPlayer].energy = Math.max(0, players[state.currentPlayer].energy - 2);
      break;
    }
  }

  // Check responses from other players
  const actionsAvailable = WINDS.map((wind) => {
    if (wind === state.currentPlayer) return emptyActions();
    return getResponseActions(players[wind], discarded, state, wind, state.currentPlayer);
  });

  const hasActions = actionsAvailable.some(a => a.canRon || a.canPon || a.canChi || a.canKan);
  const newState: GameState = {
    ...state,
    players,
    lastDiscard: discarded,
    lastDiscardPlayer: state.currentPlayer,
    phase: GamePhase.ACTION_PROMPT,
    actionsAvailable,
    drawnTile: undefined,
    turnHistory: [...state.turnHistory, { type: 'discard' as const, player: state.currentPlayer, tile: discarded }],
    isRinshan: false,
  };

  if (!hasActions) {
    // 四风连打检查（无响应时）
    const fourWindResult = checkFourWindDraw(newState, discarded);
    if (fourWindResult) return fourWindResult;
    return nextTurn(newState);
  }
  return newState;
}

function getResponseActions(
  player: Player, discarded: Tile, state: GameState, playerWind: Wind, discarderWind: Wind,
): AvailableActions {
  const actions: AvailableActions = {
    canChi: false, chiOptions: [], canPon: false, canKan: false,
    canRon: false, canTsumo: false, canRiichi: false, canAnkan: false,
    canKakan: false, canNineOrphans: false,
  };

  const testHand = [...player.hand, discarded];
  // 统一用 checkWin 判定（和实际执行一致，避免按钮亮了但点不了）
  if (player.isRiichi) {
    const winCheck = checkWin(player.hand, player.melds, discarded, false, playerWind, state);
    actions.canRon = winCheck !== null;
  } else {
    // riichiCheckWin 内含 syanten 快速预检，无需在外面包一层
    const winCheck = checkWin(player.hand, player.melds, discarded, false, playerWind, state);
    actions.canRon = winCheck !== null;
  }

  // 振听检查
  if (actions.canRon) {
    // 一般振听：弃牌中有等待牌
    const tenpai = checkTenpai(player.hand, player.melds);
    if (tenpai) {
      const discardKeys = new Set(player.discards.map(d => tileKey(d)));
      const hasFuritenDiscard = tenpai.waitTiles.some(w => discardKeys.has(tileKey(w)));
      if (hasFuritenDiscard) actions.canRon = false;
    }
    // 临时/永久振听
    if (state.furitenPlayers.includes(playerWind)) {
      actions.canRon = false;
    }
  }

  // 立直后只能荣和，不能鸣牌
  if (player.isRiichi) return actions;

  const matching = findTiles(player.hand, discarded);
  if (matching.length >= 2) actions.canPon = true;
  if (matching.length >= 3) actions.canKan = true;

  const nextPlayer = (discarderWind + 1) % 4;
  if (playerWind === nextPlayer && discarded.suit !== 'z') {
    const chiOpts = getChiOptions(player.hand, discarded);
    if (chiOpts.length > 0) { actions.canChi = true; actions.chiOptions = [chiOpts]; }
  }

  // 小野塚小町距離：其他玩家禁止吃（可碰杠）
  for (const p of state.players) {
    if (p.name === '小野塚小町' && p.wind !== playerWind) {
      actions.canChi = false; actions.chiOptions = [];
      break;
    }
  }

  // 灵梦护符：灵梦打出的牌不可被鸣牌（吃碰杠），但可荣和
  if (state.reimuCharm && state.players[discarderWind].name === '博丽灵梦') {
    actions.canChi = false; actions.chiOptions = [];
    actions.canPon = false; actions.canKan = false;
  }

  return actions;
}

function getChiOptions(hand: Tile[], discarded: Tile): ChiOption[] {
  const options: ChiOption[] = [];
  const v = discarded.value;
  const suit = discarded.suit;

  for (const start of [v - 2, v - 1, v]) {
    if (start < 1 || start > 7) continue;
    if (v < start || v > start + 2) continue;

    const otherNeeded = [start, start + 1, start + 2].filter(n => n !== v);
    const handCopy = [...hand];
    const pair: [Tile, Tile] = [null as unknown as Tile, null as unknown as Tile];
    let found = true;

    for (let i = 0; i < otherNeeded.length; i++) {
      const fIdx = handCopy.findIndex(t => t.suit === suit && t.value === otherNeeded[i]);
      if (fIdx === -1) { found = false; break; }
      pair[i] = handCopy[fIdx];
      handCopy.splice(fIdx, 1);
    }

    if (found) {
      options.push({ tiles: pair, tile1: pair[0] });
    }
  }

  return options;
}

// ---- Meld execution ----
export function executeMeld(state: GameState, playerWind: Wind, meldType: MeldType, tiles: Tile[]): GameState {
  const players = state.players.map(p => ({ ...p, hand: [...p.hand], melds: [...p.melds] }));
  const player = players[playerWind];
  const discarded = state.lastDiscard!;

  let meld: Meld;

  // 食替限制：计算鸣牌后不能打出的牌（key 集合）
  function getRestrictedKeys(): string[] {
    const keys: string[] = [`${discarded.value}${discarded.suit}`];
    if (meldType === MeldType.CHI) {
      // 顺子两端补充：如果叫的是边张，对面类型也锁
      const handVals = tiles.map(t => t.value).sort((a, b) => a - b);
      const minVal = Math.min(...handVals, discarded.value);
      const maxVal = Math.max(...handVals, discarded.value);
      if (discarded.value === minVal && maxVal - minVal === 2) {
        // 叫了低端，高端+1也被锁（如 45 叫 3 → 6 也不能打）
        keys.push(`${maxVal + 1}${discarded.suit}`);
      } else if (discarded.value === maxVal && maxVal - minVal === 2) {
        // 叫了高端，低端-1也被锁（如 45 叫 6 → 3 也不能打）
        keys.push(`${minVal - 1}${discarded.suit}`);
      }
    }
    return keys.filter(k => {
      const v = parseInt(k[0]);
      const s = k[1];
      // 过滤掉不合法值（字牌/超出1-9范围）
      if (s === 'z' || v < 1 || v > 9) return false;
      return true;
    });
  }

  switch (meldType) {
    case MeldType.PON: {
      const handTiles = tiles.slice(0, 2);
      player.hand = removeTilesFromHand(player.hand, handTiles);
      meld = { type: MeldType.PON, tiles: [...handTiles, discarded], from: state.lastDiscardPlayer, calledTile: discarded };
      break;
    }
    case MeldType.CHI: {
      player.hand = removeTilesFromHand(player.hand, tiles);
      meld = { type: MeldType.CHI, tiles: [...tiles, discarded], from: state.lastDiscardPlayer, calledTile: discarded };
      break;
    }
    case MeldType.KAN: {
      const handTiles = tiles.slice(0, 3);
      player.hand = removeTilesFromHand(player.hand, handTiles);
      meld = { type: MeldType.KAN, tiles: [...handTiles, discarded], from: state.lastDiscardPlayer, calledTile: discarded };
      return drawAfterKan({
        ...state, players, lastDiscard: undefined,
        claimedDiscardTileIds: state.lastDiscard
          ? [...state.claimedDiscardTileIds, state.lastDiscard.id]
          : state.claimedDiscardTileIds,
      }, playerWind, meld);
    }
    case MeldType.ANKAN: {
      if (tiles.length >= 4) {
        player.hand = removeTilesFromHand(player.hand, tiles.slice(0, 4));
        meld = { type: MeldType.ANKAN, tiles: tiles.slice(0, 4), calledTile: tiles[0] };
        return drawAfterKan({ ...state, players, lastDiscard: undefined }, playerWind, meld);
      }
      return state;
    }
    case MeldType.KAKAN: {
      const extra = tiles[0];
      // 抢杠检查：加杠时其他玩家可荣和
      const ronResponses = WINDS.map((wind) => {
        if (wind === playerWind) return null;
        const p = players[wind];
        const responseActions = getResponseActions(p, extra, state, wind, playerWind);
        // 荣和时 lastDiscard 指向加杠的牌
        if (responseActions.canRon) {
          return wind;
        }
        return null;
      }).filter(w => w !== null) as Wind[];

      if (ronResponses.length > 0) {
        // 抢杠：按「抢杠者右方优先」排序
        const sorted = [...ronResponses].sort((a, b) => {
          const distA = (a - playerWind + 4) % 4;
          const distB = (b - playerWind + 4) % 4;
          return distA - distB;
        });
        // 加杠牌作为荣和牌
        return executeWin({ ...state, lastDiscard: extra, lastDiscardPlayer: playerWind }, sorted[0], false);
      }

      player.hand = removeTilesFromHand(player.hand, [extra]);
      const existingIdx = player.melds.findIndex(m => m.type === MeldType.PON && tileKey(m.tiles[0]) === tileKey(extra));
      if (existingIdx >= 0) {
        const oldMeld = player.melds[existingIdx];
        meld = { type: MeldType.KAKAN, tiles: [...oldMeld.tiles, extra], from: oldMeld.from, calledTile: extra };
        player.melds.splice(existingIdx, 1);
        return drawAfterKan({ ...state, players, lastDiscard: undefined }, playerWind, meld);
      }
      return state;
    }
    default:
      return state;
  }

  player.melds.push(meld);
  player.hasCalled = true;

  // 能量槽：鸣牌 +energyPerMeld
  player.energy = Math.min(player.energyMax, player.energy + player.energyPerMeld);

  // ── 普莉兹姆利巴合奏：鸣其他玩家牌时对方付30能量 ──
  if (player.name === '普莉兹姆利巴三姐妹' && meld.from !== undefined) {
    const fromPlayer = players[meld.from];
    const tax = Math.min(fromPlayer.energy, 30);
    fromPlayer.energy -= tax;
    player.energy = Math.min(player.energyMax, player.energy + tax);
    debugLog('MELD_DBG', { event: 'prismriver_tax', from: fromPlayer.name, to: player.name, amount: tax });
  }

  // ── [DEBUG] 鸣牌日志 → game.log ──
  debugLog('MELD_DBG', {
    player: player.name,
    wind: playerWind,
    type: meldType,
    tiles: meld.tiles.map(t => t.suit + t.value).join(','),
    fromWind: state.lastDiscardPlayer,
    handLeft: player.hand.length,
    hasCalled: true,
  });

  // 食替：设置限制弃牌
  const restrictedKeys = getRestrictedKeys();
  if (restrictedKeys.length > 0) {
    player.restrictedDiscardKeys = restrictedKeys;
  }

  // Cancel ippatsu status for riichi players
  // (simplified - no ippatsu tracking)

  return {
    ...state,
    players,
    lastDiscard: undefined,
    lastDiscardPlayer: undefined,
    currentPlayer: playerWind,
    phase: GamePhase.DISCARDING,
    actionsAvailable: WINDS.map(() => emptyActions()),
    furitenPlayers: state.furitenPlayers.filter(p => state.players[p].isRiichi), // 仅保留立直玩家的永久振听
    claimedDiscardTileIds: state.lastDiscard
      ? [...state.claimedDiscardTileIds, state.lastDiscard.id]
      : state.claimedDiscardTileIds,
  };
}

function drawAfterKan(state: GameState, playerWind: Wind, meld: Meld): GameState {
  const players = state.players.map(p => ({ ...p, hand: [...p.hand], melds: [...p.melds] }));
  const player = players[playerWind];
  player.melds.push(meld);

  const deadWall = [...state.deadWall];
  const rinshanTile = deadWall.shift()!;
  player.hand = sortHand([...player.hand, rinshanTile]);

  // Update dora & ura dora
  const newDoraIdx = state.kanCount + 1;
  const newDora = newDoraIdx + 4 < deadWall.length ? deadWall[newDoraIdx + 4] : null;
  const newUra = newDoraIdx + 5 < deadWall.length ? deadWall[newDoraIdx + 5] : null;

  let canTsumoNow = false;
  const winCheck = checkWin(player.hand, player.melds, rinshanTile, true, playerWind, state);
  canTsumoNow = winCheck !== null;
  const engResult = checkMahjongStatus(tilesToHai(player.hand));
  const canRiichiNow = !player.hasCalled && !player.isRiichi && state.wall.length >= 4 && player.score >= 1000 && typeof engResult === 'object';

  // 暗杠判定
  let canAnkanNow = false;
  const tileCounts = new Map<string, number>();
  for (const t of player.hand) { const k = `${t.suit}${t.value}`; tileCounts.set(k, (tileCounts.get(k)||0)+1); }
  for (const [, c] of tileCounts) { if (c >= 4) { canAnkanNow = true; break; } }

  // 四杠散了检查
  const afterKanState: GameState = {
    ...state,
    players,
    deadWall,
    doraIndicators: newDora ? [...state.doraIndicators, newDora] : state.doraIndicators,
    uraDoraIndicators: newUra ? [...state.uraDoraIndicators, newUra] : state.uraDoraIndicators,
    kanCount: state.kanCount + 1,
  };
  const fourKanDraw = checkFourKanDraw(afterKanState);
  if (fourKanDraw) return fourKanDraw;

  return {
    ...afterKanState,
    currentPlayer: playerWind,
    phase: (canTsumoNow || canRiichiNow || canAnkanNow) ? GamePhase.ACTION_PROMPT : GamePhase.DISCARDING,
    actionsAvailable: WINDS.map((_, i) => i === playerWind ? {
      ...emptyActions(),
      canTsumo: canTsumoNow,
      canRiichi: canRiichiNow,
      canAnkan: canAnkanNow,
    } : emptyActions()),
    drawnTile: rinshanTile,
    turn: state.turn + 1,
    isRinshan: true,
  };
}

function removeTilesFromHand(hand: Tile[], remove: Tile[]): Tile[] {
  let h = [...hand];
  for (const t of remove) {
    const idx = h.findIndex(x => x.id === t.id);
    if (idx >= 0) h.splice(idx, 1);
  }
  return h;
}

// ---- Win ----
export function executeWin(state: GameState, playerWind: Wind, isTsumo: boolean): GameState {
  // 防止重复执行：如果已经终局或游戏结束，直接返回
  if (state.phase === GamePhase.HAND_OVER || state.phase === GamePhase.GAME_OVER) {
    debugLog('EXEC_WIN', { event: 'blocked_duplicate', phase: state.phase, playerWind, isTsumo });
    return state;
  }

  const player = state.players[playerWind];
  const winningTile = isTsumo ? state.drawnTile! : state.lastDiscard!;
  if (!winningTile) return state;

  // ── [DEBUG] executeWin 调用追踪（检测是否被重复调用） ──
  debugLog('EXEC_WIN', {
    player: player.name,
    wind: playerWind,
    isTsumo,
    phase: state.phase,
    turn: state.turn,
    wall: state.wall.length,
  });

  const evalResult = checkWin(
    isTsumo ? player.hand : [...player.hand],
    player.melds,
    winningTile,
    isTsumo,
    playerWind,
    state,
  );

  if (!evalResult) {
    debugLog('EXEC_WIN', {
      event: 'checkwin_null',
      isTsumo,
      handLen: player.hand.length,
      meldsLen: player.melds.length,
      tile: winningTile.suit + winningTile.value,
      handTiles: player.hand.map(t => t.suit + t.value).join(','),
    });
    return state;
  }

  return finishWin(state, playerWind, isTsumo, winningTile, evalResult);
}

function finishWin(state: GameState, playerWind: Wind, isTsumo: boolean, winningTile: Tile, evalResult: any): GameState {
  const player = state.players[playerWind];

  // ── 爱丽丝人偶：减少获胜者番数 ──
  let totalHan = evalResult.totalHan;
  const players = state.players.map(p => ({ ...p }));
  for (let i = 0; i < 4; i++) {
    if (i === playerWind) continue;
    const loser = players[i];
    if (loser.name === '爱丽丝·玛格特罗依德' && loser.dollCount > 0) {
      const reduce = Math.min(loser.dollCount, totalHan - 1);
      if (reduce > 0) {
        totalHan -= reduce;
        loser.dollCount -= reduce;
        debugLog('DOLL_DBG', { player: loser.name, dollsBefore: loser.dollCount + reduce, reduce, hanAfter: totalHan, dollsAfter: loser.dollCount });
      }
    }
  }

  const isDealerWin = player.isDealer;
  const score = calculateScore(
    evalResult.fu, totalHan, isDealerWin, isTsumo,
    state.honba, state.riichiSticks,
  );

  const payouts = calculatePayouts(
    playerWind,
    isTsumo ? null : state.lastDiscardPlayer!,
    evalResult.fu, totalHan,
    state.honba, state.riichiSticks,
    isDealerWin,
    state.dealerIndex,
  );

  // ── [DEBUG] 详细分数变动日志 → game.log ──
  const scoreBefore = state.players.map(p => p.score);
  const winType = isTsumo ? 'tsumo' : 'ron';
  const dealerTag = isDealerWin ? 'oya' : 'ko';
  debugLog('SCORE_DBG', {
    event: 'win_start',
    type: winType,
    player: player.name,
    wind: String(playerWind),
    dealer: dealerTag,
    tile: `${winningTile.suit}${winningTile.value}`,
    han: evalResult.totalHan,
    fu: evalResult.fu,
    basePts: score.basePoints,
    payments: `[${score.payments}]`,
    honba: state.honba,
    sticks: state.riichiSticks,
    scoresPre: `[${scoreBefore}]`,
  });

  for (const pay of payouts) {
    debugLog('SCORE_DBG', {
      event: 'payout',
      from: state.players[pay.from].name,
      fromWind: pay.from,
      to: state.players[pay.to].name,
      toWind: pay.to,
      amount: pay.amount,
      fromPre: players[pay.from].score,
      fromPost: players[pay.from].score - pay.amount,
      toPre: players[pay.to].score,
      toPost: players[pay.to].score + pay.amount,
    });
    players[pay.from].score -= pay.amount;
    players[pay.to].score += pay.amount;
  }
  if (state.riichiSticks > 0) {
    debugLog('SCORE_DBG', {
      event: 'riichi_return',
      player: state.players[playerWind].name,
      sticks: state.riichiSticks,
      amount: state.riichiSticks * 1000,
    });
    players[playerWind].score += state.riichiSticks * 1000;
  }
  const modifiedWinds = new Set<number>();
  for (const pay of payouts) { modifiedWinds.add(pay.from); modifiedWinds.add(pay.to); }
  if (state.riichiSticks > 0) modifiedWinds.add(playerWind);

  // ── 藤原妹红不死：被和时对方偿还4000分 ──
  for (const pay of payouts) {
    const loser = players[pay.from];
    if (loser.name === '藤原妹红' && pay.from !== playerWind) {
      const refund = Math.min(4000, players[playerWind].score);
      players[playerWind].score -= refund;
      loser.score += refund;
      debugLog('PHOENIX_DBG', { player: loser.name, from: players[playerWind].name, refund });
    }
  }

  const scoreAfter = players.map(p => p.score);
  const changes = players.map((p, i) =>
    modifiedWinds.has(i)
      ? `${p.name}:${scoreBefore[i]}→${scoreAfter[i]}(${scoreAfter[i]-scoreBefore[i] >= 0 ? '+' : ''}${scoreAfter[i]-scoreBefore[i]})`
      : `${p.name}:${scoreBefore[i]}(不变)`
  ).join('|');
  debugLog('SCORE_DBG', {
    event: 'win_end',
    scoresPost: `[${scoreAfter}]`,
    changes,
  });

  const winResult: WinResult = {
    player: playerWind,
    winningTile,
    isTsumo,
    isRon: !isTsumo,
    yaku: evalResult.yaku,
    totalHan: evalResult.totalHan,
    fu: evalResult.fu,
    basePoints: score.basePoints,
    payments: payouts.map(p => ({ player: p.to, amount: p.amount })),
    winnerGets: score.winnerGets,
    basePayment: score.winnerGets - score.honbaAddition - score.riichiBonus,
    honbaAddition: score.honbaAddition,
    riichiBonus: score.riichiBonus,
    isDealerWin,
    handTiles: player.hand,
  };

  // 收集所有分数变动
  const allPayments: { from: Wind; to: Wind; amount: number }[] = [...payouts];
  if (state.riichiSticks > 0) {
    allPayments.push({ from: -1 as Wind, to: playerWind, amount: state.riichiSticks * 1000 });
  }

  const result: HandResult = {
    type: isTsumo ? 'tsumo' : 'ron',
    winners: [playerWind],
    winResults: [winResult],
    payments: allPayments,
  };

  // ── 蕾蒂冬眠：局终能量+20×全员技能次数 ──
  for (const p of players) {
    if (p.name === '蕾蒂·霍瓦特洛克' && state.totalAbilityUses > 0) {
      const bonus = state.totalAbilityUses * 20;
      p.energy = Math.min(p.energyMax, p.energy + bonus);
      debugLog('WINTER_DBG', { player: p.name, totalUses: state.totalAbilityUses, bonus, energyAfter: p.energy });
    }
  }

  return {
    ...state, players, result, phase: GamePhase.HAND_OVER,
    actionsAvailable: WINDS.map(() => emptyActions()),  // 清空所有动作，防止 effect 二次触发
    claimedDiscardTileIds: !isTsumo && state.lastDiscard
      ? [...state.claimedDiscardTileIds, state.lastDiscard.id]
      : state.claimedDiscardTileIds,
  };
}

// ---- Next turn ----
export function nextTurn(state: GameState): GameState {
  const currentPlayer = ((state.currentPlayer + 1) % 4) as Wind;
  // console.log(`[TURN] ${state.players[state.currentPlayer].name}(${state.currentPlayer}) → ${state.players[currentPlayer].name}(${currentPlayer})  牌山:${state.wall.length}`);
  return {
    ...state,
    currentPlayer,
    phase: GamePhase.DRAWING,
    actionsAvailable: WINDS.map(() => emptyActions()),
    lastDiscard: undefined,
    lastDiscardPlayer: undefined,
    players: state.players.map(p => ({ ...p, restrictedDiscardKeys: [] })),
  };
}

export function emptyActions(): AvailableActions {
  return {
    canChi: false, chiOptions: [], canPon: false, canKan: false,
    canRon: false, canTsumo: false, canRiichi: false, canAnkan: false,
    canKakan: false, canNineOrphans: false,
  };
}

// ---- Draw (流局) ----
export function executeDraw(state: GameState): GameState {
  // 检查各家是否听牌
  const tenpaiPlayers: Wind[] = [];
  const notenPlayers: Wind[] = [];
  for (const p of state.players) {
    const tenpai = checkTenpai(p.hand, p.melds);
    if (tenpai) tenpaiPlayers.push(p.wind);
    else notenPlayers.push(p.wind);
  }

  // 流局结算（ノーテン罰符）: 総額3000点
  const payments: { from: Wind; to: Wind; amount: number }[] = [];
  if (tenpaiPlayers.length > 0 && tenpaiPlayers.length < 4) {
    const n = Math.max(notenPlayers.length, tenpaiPlayers.length);
    const perPair = Math.ceil(3000 / n / 100) * 100;
    for (let i = 0; i < n; i++) {
      payments.push({
        from: notenPlayers[i % notenPlayers.length],
        to: tenpaiPlayers[i % tenpaiPlayers.length],
        amount: perPair,
      });
    }
  }

  const players = state.players.map(p => ({ ...p }));
  for (const pay of payments) {
    players[pay.from].score -= pay.amount;
    players[pay.to].score += pay.amount;
  }

  const result: HandResult = {
    type: 'draw',
    tenpaiPlayers,
    payments,
    drawReason: tenpaiPlayers.length === 0 ? '四家不听' :
                tenpaiPlayers.length === 4 ? '四家听牌' : '流局',
  };

  return { ...state, players, result, phase: GamePhase.HAND_OVER };
}

// ---- Special Draws ----

/** 九种九牌 */
export function executeNineOrphans(state: GameState, _playerWind: Wind): GameState {
  const result: HandResult = { type: 'draw', drawReason: '九种九牌', tenpaiPlayers: [] };
  return { ...state, phase: GamePhase.HAND_OVER, result, furitenPlayers: [] };
}

/** 四杠散了：合计4杠且无人独做4杠 → 流局 */
export function checkFourKanDraw(state: GameState): GameState | null {
  if (state.kanCount < 4) return null;
  let totalKan = 0;
  for (const p of state.players) {
    totalKan += p.melds.filter(m =>
      m.type === MeldType.KAN || m.type === MeldType.ANKAN || m.type === MeldType.KAKAN
    ).length;
  }
  if (totalKan < 4) return null;
  // 有人独立4杠子 → 役满，非流局
  if (Math.max(...state.players.map(p =>
    p.melds.filter(m => m.type === MeldType.KAN || m.type === MeldType.ANKAN || m.type === MeldType.KAKAN).length
  )) >= 4) return null;
  return { ...state, phase: GamePhase.HAND_OVER, result: { type: 'draw' as const, drawReason: '四杠散了', tenpaiPlayers: [] } };
}

/** 四风连打：第一巡4人弃同一风牌 */
export function checkFourWindDraw(state: GameState, discarded: Tile): GameState | null {
  if (state.turn >= 4 || state.handCount > 0) return null;
  if (discarded.suit !== 'z' || discarded.value > 4) return null;
  for (let i = 1; i <= 3; i++) {
    const prevWind = ((state.currentPlayer - i + 4) % 4) as Wind;
    const prevDiscards = state.players[prevWind].discards;
    if (prevDiscards.length !== 1) return null;
    if (prevDiscards[0].suit !== discarded.suit || prevDiscards[0].value !== discarded.value) return null;
  }
  return { ...state, phase: GamePhase.HAND_OVER, result: { type: 'draw' as const, drawReason: '四风连打', tenpaiPlayers: [] } };
}

/** 流局满贯 */
export function checkNagashiMangan(state: GameState): GameState | null {
  const nagashi: Wind[] = [];
  for (const p of state.players) {
    if (p.discards.length === 0 || p.isRiichi || p.melds.length > 0) continue;
    if (p.discards.every(t => isTerminalHonor(t))) nagashi.push(p.wind);
  }
  if (nagashi.length === 0) return null;
  return { ...state, phase: GamePhase.HAND_OVER, result: { type: 'nagashi' as const, drawReason: '流局满贯', tenpaiPlayers: nagashi } };
}

// ---- Next hand (下一局) ----
export function createNextHand(prevState: GameState): GameState {
  const result = prevState.result;
  if (!result) return createInitialState();

  // 判断是否连庄
  const isDealerWin = result.winners?.includes(prevState.dealerIndex) ?? false;
  const isDealerTenpai = result.type === 'draw' &&
    (result.tenpaiPlayers?.includes(prevState.dealerIndex) ?? false);
  const isRenchan = isDealerWin || isDealerTenpai;

  // 计算新的庄家和本场
  let newDealer: Wind;
  let newHonba: number;
  let newHandCount: number;

  if (isRenchan) {
    newDealer = prevState.dealerIndex;
    newHonba = prevState.honba + 1;
    newHandCount = prevState.handCount;
  } else {
    newDealer = ((prevState.dealerIndex + 1) % 4) as Wind;
    newHonba = 0;
    newHandCount = prevState.handCount + 1;
  }

  // 判断场风
  const maxRounds = prevState.gameLength * 4;
  const roundWind: Wind = newHandCount < maxRounds ? (Math.floor(newHandCount / 4) as Wind) : Wind.EAST;

  // 判断游戏是否结束：
  // handCount = 非连庄的轮庄次数 → 0-3东场, 4-7南场 etc.
  const anyNegative = prevState.players.some(p => p.score < 0);
  if (anyNegative || newHandCount >= maxRounds) {
    return {
      ...prevState,
      phase: GamePhase.GAME_OVER,
      result: prevState.result,
    };
  }

  // 生成新一局
  const deck = shuffleArray(createTileDeck());
  const deadWall = deck.slice(0, 14);
  const wall = deck.slice(14);
  const doraIndicators = [deadWall[4]];

  // 继承分数和名字
  const players: Player[] = WINDS.map((wind) => ({
    name: prevState.players[wind].name,
    wind,
    hand: [],
    melds: [],
    discards: [],
    discardsSize: 0,
    isRiichi: false,
    isDoubleRiichi: false,
    riichiDiscardIndex: -1,
    riichiTurnStart: -1,
    score: prevState.players[wind].score,
    isDealer: wind === newDealer,
    isHuman: wind === Wind.EAST,
    tenpai: false,
    hasCalled: false,
    restrictedDiscardKeys: [],
    energy: prevState.players[wind].energy,  // 继承能量槽
    energyMax: prevState.players[wind].energyMax,
    energyPerDiscard: prevState.players[wind].energyPerDiscard,
    energyPerDraw: prevState.players[wind].energyPerDraw,
    energyPerMeld: prevState.players[wind].energyPerMeld,
    energyPerRiichi: prevState.players[wind].energyPerRiichi,
    energyPerWin: prevState.players[wind].energyPerWin,
    abilityUseCount: prevState.players[wind].abilityUseCount,
    swapEnergyCost: prevState.players[wind].swapEnergyCost,
    frozenByCirno: false,
    skipNextDraw: false,
    hideDiscards: 0,
    seeNextDraw: false,
    abilityUsedThisHand: 0,
    dollCount: 0,
    deathDoraIds: [],
    jokerSuit: null,
  }));

  // 配牌：先处理能力需求，再随机分配剩余牌
  const playerNames2 = players.map(p => p.name);
  const playerUseCounts2 = players.map(p => p.abilityUseCount);
  const requirements2 = getAllRequirements(playerNames2, playerUseCounts2);

  if (requirements2.length > 0) {
    const wallPool = [...wall];
    const reserved: { wind: number; tiles: Tile[]; playerIndex?: number }[] = [];

    // ── 第一步：处理配牌即听牌（wind=-3）──
    for (const req of requirements2) {
      if (req.tenpai) {
        const result = tryMakeTenpai([], wallPool);
        if (result.used > 0) {
          reserved.push({ wind: req.wind, tiles: result.hand, playerIndex: req.playerIndex });
        }
      }
    }

    // ── 第二步：处理普通配牌需求 ──
    for (const req of requirements2) {
      if (req.tenpai) continue;
      const taken: Tile[] = [];
      const gs2 = req.groupSize || 1;
      for (let g = 0; g < req.tiles.length; g += gs2) {
        const group = req.tiles.slice(g, g + gs2);
        const poolCopy2 = [...wallPool];
        let allFound2 = true;
        for (const rt of group) {
          const idx = poolCopy2.findIndex(t => t.suit === rt.suit && t.value === rt.value);
          if (idx >= 0) {
            poolCopy2.splice(idx, 1);
          } else {
            allFound2 = false;
            break;
          }
        }
        if (allFound2) {
          for (const rt of group) {
            const idx = wallPool.findIndex(t => t.suit === rt.suit && t.value === rt.value);
            if (idx >= 0) {
              taken.push(wallPool[idx]);
              wallPool.splice(idx, 1);
            }
          }
        }
      }
      if (taken.length > 0) {
        reserved.push({ wind: req.wind, tiles: taken, playerIndex: req.playerIndex });
      }
    }

    const remaining2 = shuffleArray(wallPool);
    for (const r of reserved) {
      if (r.wind < 0) {
        const abilityUser = r.playerIndex ?? 0;
        for (let j = 0; j < 4; j++) {
          if (j === abilityUser) continue;
          const keys = r.tiles.map(t => `${t.value}${t.suit}`);
          players[j].restrictedDiscardKeys = [...new Set([...players[j].restrictedDiscardKeys, ...keys])];
        }
      } else {
        players[r.wind].hand = [...r.tiles];
      }
    }
    let ri2 = 0;
    for (let i = 0; i < 4; i++) {
      const needed = 13 - players[i].hand.length;
      if (needed > 0) {
        players[i].hand.push(...remaining2.slice(ri2, ri2 + needed));
        ri2 += needed;
      }
      players[i].hand = sortHand(players[i].hand);
    }

    // 配牌完成，重置能力计数
    for (const p of players) p.abilityUseCount = 0;

    return {
      wall: remaining2.slice(ri2),
      deadWall,
      doraIndicators,
      uraDoraIndicators: [deadWall[5]],
      players,
      currentPlayer: newDealer,
      turn: 0,
      phase: GamePhase.DRAWING,
      roundWind,
      honba: newHonba,
      riichiSticks: result.winners && result.winners.length > 0 ? 0 : prevState.riichiSticks,
      kanCount: 0,
      actionsAvailable: WINDS.map(() => emptyActions()),
      turnHistory: [],
      dealerIndex: newDealer,
      handCount: newHandCount,
      furitenPlayers: [],
      gameLength: prevState.gameLength,
      claimedDiscardTileIds: [],
      reimuCharm: false,  // 护符已消耗
      sniperReserve: null,
      totalAbilityUses: 0,
      seeAllHands: false,
    };
  }

  // 无配牌需求：原逻辑
  let idx = 0;
  for (let i = 0; i < 4; i++) {
    players[i].hand = sortHand(wall.slice(idx, idx + 13));
    idx += 13;
  }
  const remainingWall = wall.slice(idx);

  return {
    wall: remainingWall,
    deadWall,
    doraIndicators,
    uraDoraIndicators: [deadWall[5]],
    players,
    currentPlayer: newDealer,
    turn: 0,
    phase: GamePhase.DRAWING,
    roundWind,
    honba: newHonba,
    riichiSticks: result.winners && result.winners.length > 0 ? 0 : prevState.riichiSticks,
    kanCount: 0,
    actionsAvailable: WINDS.map(() => emptyActions()),
    turnHistory: [],
    dealerIndex: newDealer,
    handCount: newHandCount,
    furitenPlayers: [],
    gameLength: prevState.gameLength,
    claimedDiscardTileIds: [],
    reimuCharm: false,  // 护符已消耗
    sniperReserve: null,
    totalAbilityUses: 0,
    seeAllHands: false,
  };
}
