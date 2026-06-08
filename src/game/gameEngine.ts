import type { Tile, Meld, GameState, Player, AvailableActions, ChiOption, HandResult, WinResult } from './types';
import { Wind, MeldType, GamePhase, TOUHOU_CHARACTERS, INITIAL_SCORE, WINDS } from './types';
import { createTileDeck, shuffleArray, sortHand, tileKey, findTiles, isTerminalHonor } from './tiles';
import { findTenpaiDiscards, checkTenpai } from './hand';
import { riichiCheckWin as checkWin } from './riichi-check';
import { calculateScore, calculatePayouts } from './scoring';

export function createInitialState(): GameState {
  const deck = shuffleArray(createTileDeck());
  const deadWall = deck.slice(0, 14);
  const wall = deck.slice(14);
  const doraIndicators = [deadWall[4]];

  const players: Player[] = WINDS.map((wind) => ({
    name: TOUHOU_CHARACTERS[wind].name,
    wind,
    hand: [],
    melds: [],
    discards: [],
    discardsSize: 0,
    isRiichi: false,
    riichiDiscardIndex: -1,
    score: INITIAL_SCORE,
    isDealer: wind === Wind.EAST,
    isHuman: wind === Wind.EAST,
    tenpai: false,
    hasCalled: false,
  }));

  // 配牌：每人13张，庄家先摸第14张
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
    uraDoraIndicators: [],
    players,
    currentPlayer: Wind.EAST,
    turn: 0,
    phase: GamePhase.DRAWING,
    roundWind: Wind.EAST,
    honba: 0,
    riichiSticks: 0,
    kanCount: 0,
    handCount: 0,
    actionsAvailable: WINDS.map(() => emptyActions()),
    turnHistory: [],
    dealerIndex: Wind.EAST,
    furitenPlayers: [],
  };
}

// ---- Draw ----
export function drawTile(state: GameState): GameState {
  if (state.wall.length === 0) return executeDraw(state);
  const wall = [...state.wall];
  const drawnTile = wall.shift()!;
  const players = state.players.map(p => ({ ...p, hand: [...p.hand] }));
  const player = players[state.currentPlayer];
  player.hand = [...player.hand, drawnTile];

  const actions = getDrawActions(player, state, state.currentPlayer, drawnTile);
  const hasActions = actions.canRiichi || actions.canTsumo || actions.canAnkan || actions.canKakan || actions.canNineOrphans;
  console.log(`[DRAW] ${player.name}(${state.currentPlayer}) 摸牌 牌山:${wall.length} 手牌:${player.hand.length} 有动作:${hasActions}`);

  return {
    ...state,
    wall,
    players,
    drawnTile,
    phase: hasActions ? GamePhase.ACTION_PROMPT : GamePhase.DISCARDING,
    actionsAvailable: WINDS.map((_, i) => i === state.currentPlayer ? actions : emptyActions()),
    turn: state.turn + 1,
    turnHistory: [...state.turnHistory, { type: 'draw' as const, player: state.currentPlayer, tile: drawnTile }],
    furitenPlayers: state.furitenPlayers.filter(p => p !== state.currentPlayer),
  };
}

function getDrawActions(player: Player, state: GameState, playerWind: Wind, drawnTile: Tile): AvailableActions {
  const actions: AvailableActions = {
    canChi: false, chiOptions: [], canPon: false, canKan: false,
    canRon: false, canTsumo: false, canRiichi: false, canAnkan: false,
    canKakan: false, canNineOrphans: false,
  };

  if (drawnTile) {
    const winCheck = checkWin(player.hand, player.melds, drawnTile, true, playerWind, state);
    actions.canTsumo = winCheck !== null && winCheck.yaku.length > 0;
  }

  if (!player.hasCalled && !player.isRiichi && state.wall.length >= 4 && player.score >= 1000) {
    const tenpaiCheck = findTenpaiDiscards(player.hand, player.melds);
    actions.canRiichi = tenpaiCheck.size > 0;
  }

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
  if (player.isRiichi && player.riichiDiscardIndex === -1) {
    player.riichiDiscardIndex = player.discards.length;
  }
  player.discards.push(discarded);

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
  };

  if (!hasActions) return nextTurn(newState);
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
  const winCheck = checkWin(testHand, player.melds, discarded, false, playerWind, state);
  actions.canRon = winCheck !== null && winCheck.yaku.length > 0;

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
      return drawAfterKan({ ...state, players, lastDiscard: undefined }, playerWind, meld);
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
  };
}

function drawAfterKan(state: GameState, playerWind: Wind, meld: Meld): GameState {
  const players = state.players.map(p => ({ ...p, hand: [...p.hand], melds: [...p.melds] }));
  const player = players[playerWind];
  player.melds.push(meld);

  const deadWall = [...state.deadWall];
  const rinshanTile = deadWall.shift()!;
  player.hand = sortHand([...player.hand, rinshanTile]);

  // Update dora
  const newDoraIdx = state.kanCount + 1;
  const newDora = newDoraIdx + 4 < deadWall.length ? deadWall[newDoraIdx + 4] : null;

  const winCheck = checkWin(player.hand, player.melds, rinshanTile, true, playerWind, state);

  return {
    ...state,
    players,
    deadWall,
    doraIndicators: newDora ? [...state.doraIndicators, newDora] : state.doraIndicators,
    kanCount: state.kanCount + 1,
    currentPlayer: playerWind,
    phase: winCheck ? GamePhase.ACTION_PROMPT : GamePhase.DISCARDING,
    actionsAvailable: WINDS.map((_, i) => i === playerWind ? {
      ...emptyActions(),
      canTsumo: winCheck !== null && winCheck.yaku.length > 0,
    } : emptyActions()),
    drawnTile: rinshanTile,
    turn: state.turn + 1,
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
  const player = state.players[playerWind];
  const winningTile = isTsumo ? state.drawnTile! : state.lastDiscard!;
  if (!winningTile) return state;

  const evalResult = checkWin(
    isTsumo ? player.hand : [...player.hand],
    player.melds,
    winningTile,
    isTsumo,
    playerWind,
    state,
  );

  if (!evalResult) return state;

  const isDealerWin = player.isDealer;
  const score = calculateScore(
    evalResult.fu, evalResult.totalHan, isDealerWin, isTsumo,
    state.honba, state.riichiSticks,
  );

  const payouts = calculatePayouts(
    playerWind,
    isTsumo ? null : state.lastDiscardPlayer!,
    evalResult.fu, evalResult.totalHan,
    state.honba, state.riichiSticks,
    isDealerWin,
  );

  const players = state.players.map(p => ({ ...p }));
  for (const pay of payouts) {
    players[pay.from].score -= pay.amount;
    players[pay.to].score += pay.amount;
  }
  if (state.riichiSticks > 0) {
    players[playerWind].score += state.riichiSticks * 1000;
  }

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

  return { ...state, players, result, phase: GamePhase.HAND_OVER };
}

// ---- Next turn ----
export function nextTurn(state: GameState): GameState {
  const currentPlayer = ((state.currentPlayer + 1) % 4) as Wind;
  console.log(`[TURN] ${state.players[state.currentPlayer].name}(${state.currentPlayer}) → ${state.players[currentPlayer].name}(${currentPlayer})  牌山:${state.wall.length}`);
  return {
    ...state,
    currentPlayer,
    phase: GamePhase.DRAWING,
    actionsAvailable: WINDS.map(() => emptyActions()),
    lastDiscard: undefined,
    lastDiscardPlayer: undefined,
  };
}

function emptyActions(): AvailableActions {
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
  const roundWind: Wind = newHandCount < 4 ? Wind.EAST : Wind.SOUTH;

  // 判断游戏是否结束：
  // handCount = 非连庄的轮庄次数 → 0-3东场, 4-7南场
  const anyNegative = prevState.players.some(p => p.score < 0);
  if (anyNegative || newHandCount >= 8) {
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

  // 继承分数
  const players: Player[] = WINDS.map((wind) => ({
    name: TOUHOU_CHARACTERS[wind].name,
    wind,
    hand: [],
    melds: [],
    discards: [],
    discardsSize: 0,
    isRiichi: false,
    riichiDiscardIndex: -1,
    score: prevState.players[wind].score,
    isDealer: wind === newDealer,
    isHuman: wind === Wind.EAST,
    tenpai: false,
    hasCalled: false,
  }));

  // 配牌
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
    uraDoraIndicators: [],
    players,
    currentPlayer: newDealer,
    turn: 0,
    phase: GamePhase.DRAWING,
    roundWind,
    honba: newHonba,
    riichiSticks: prevState.riichiSticks,
    kanCount: 0,
    actionsAvailable: WINDS.map(() => emptyActions()),
    turnHistory: [],
    dealerIndex: newDealer,
    handCount: newHandCount,
    furitenPlayers: [],
  };
}
